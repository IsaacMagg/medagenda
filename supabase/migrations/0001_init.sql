-- MedAgenda — esquema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase.
--
-- Modelo: cada médico só enxerga os próprios pacientes, agendamentos e
-- consultas. Isso é garantido por RLS (Row Level Security) comparando
-- auth.uid() com a coluna doctor_id — não depende do front-end se comportar.

-- ---------------------------------------------------------------- tipos

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type public.appointment_status as enum (
      'agendada', 'confirmada', 'realizada', 'cancelada'
    );
  end if;
end $$;

-- --------------------------------------------------------------- tabelas

-- Perfil do médico. 1:1 com auth.users; o id é o próprio id do usuário.
create table if not exists public.doctors (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  email      text not null,
  crm        text not null default '',
  specialty  text not null default 'Clínica Geral',
  created_at timestamptz not null default now()
);

create table if not exists public.patients (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references public.doctors (id) on delete cascade,
  name       text not null,
  birth_date date not null,
  phone      text not null,
  email      text,
  cpf        text,
  address    text,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id               uuid primary key default gen_random_uuid(),
  doctor_id        uuid not null references public.doctors (id) on delete cascade,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  scheduled_date   date not null,
  scheduled_time   time not null,
  reason           text not null default '',
  status           public.appointment_status not null default 'agendada',
  -- quando o lembrete de WhatsApp foi disparado pela última vez
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Registro clínico do atendimento (o "como foi a consulta").
create table if not exists public.consultations (
  id             uuid primary key default gen_random_uuid(),
  doctor_id      uuid not null references public.doctors (id) on delete cascade,
  patient_id     uuid not null references public.patients (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  occurred_on    date not null,
  complaint      text not null default '',
  evolution      text not null,
  diagnosis      text not null default '',
  prescription   text not null default '',
  created_at     timestamptz not null default now()
);

-- --------------------------------------------------------------- índices

create index if not exists patients_doctor_idx
  on public.patients (doctor_id, name);
create index if not exists appointments_doctor_date_idx
  on public.appointments (doctor_id, scheduled_date, scheduled_time);
create index if not exists appointments_patient_idx
  on public.appointments (patient_id);
create index if not exists consultations_patient_idx
  on public.consultations (patient_id, occurred_on desc);

-- ------------------------------------------------------------------- RLS

alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.appointments  enable row level security;
alter table public.consultations enable row level security;

drop policy if exists "doctors: ler o próprio perfil"      on public.doctors;
drop policy if exists "doctors: criar o próprio perfil"    on public.doctors;
drop policy if exists "doctors: editar o próprio perfil"   on public.doctors;
drop policy if exists "patients: só os próprios"           on public.patients;
drop policy if exists "appointments: só os próprios"       on public.appointments;
drop policy if exists "consultations: só as próprias"      on public.consultations;

create policy "doctors: ler o próprio perfil"
  on public.doctors for select
  using (auth.uid() = id);

create policy "doctors: criar o próprio perfil"
  on public.doctors for insert
  with check (auth.uid() = id);

create policy "doctors: editar o próprio perfil"
  on public.doctors for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "patients: só os próprios"
  on public.patients for all
  using (auth.uid() = doctor_id)
  with check (auth.uid() = doctor_id);

create policy "appointments: só os próprios"
  on public.appointments for all
  using (auth.uid() = doctor_id)
  with check (auth.uid() = doctor_id);

create policy "consultations: só as próprias"
  on public.consultations for all
  using (auth.uid() = doctor_id)
  with check (auth.uid() = doctor_id);

-- ---------------------------------------------- perfil criado no cadastro

-- Ao criar o usuário no auth, cria o perfil em public.doctors usando os
-- metadados enviados no signUp (name, crm, specialty).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.doctors (id, name, email, crm, specialty)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
             split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'crm', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'specialty', ''),
             'Clínica Geral')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
