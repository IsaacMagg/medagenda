-- MedAgenda — migração de escopo: de "um médico" para "uma clínica"
--
-- O que muda:
--   • quem faz login passa a ser a CLÍNICA (a recepcionista usa essa conta);
--   • a tabela doctors deixa de ser o perfil da conta e vira o cadastro dos
--     médicos daquela clínica;
--   • pacientes/agendamentos/consultas passam a pertencer à clínica, e o
--     agendamento aponta para qual médico vai atender.
--
-- Esta migração PRESERVA os dados existentes: cada conta antiga vira uma
-- clínica, e o médico que era o dono da conta vira o primeiro médico dela.
--
-- Rode o arquivo inteiro no SQL Editor do Supabase. Está tudo em uma
-- transação: ou aplica completo, ou não aplica nada.

begin;

-- ------------------------------------------------- 0. proteção contra re-run

-- Se doctors já tem clinic_id, esta migração já rodou. Parar aqui com uma
-- mensagem clara é melhor do que dar erro no meio e deixar dúvida.
do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'doctors'
       and column_name = 'clinic_id'
  ) then
    raise exception
      'A migração 0002 já foi aplicada neste banco. Nada a fazer.';
  end if;
end $$;

-- --------------------------------------------------------------- 1. clínicas

create table if not exists public.clinics (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  cnpj       text not null default '',
  email      text not null,
  phone      text,
  created_at timestamptz not null default now()
);

-- Cada perfil de médico que existia era, na prática, uma conta. Vira clínica.
insert into public.clinics (id, name, email, created_at)
select d.id, d.name, d.email, d.created_at
  from public.doctors d
on conflict (id) do nothing;

-- ---------------------------------------------------- 2. médicos da clínica

create table if not exists public.clinic_doctors (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id) on delete cascade,
  name       text not null,
  crm        text not null default '',
  specialty  text not null default 'Clínica Geral',
  created_at timestamptz not null default now()
);

-- O médico que era dono da conta vira o primeiro médico cadastrado.
insert into public.clinic_doctors (clinic_id, name, crm, specialty, created_at)
select d.id, d.name, d.crm, d.specialty, d.created_at
  from public.doctors d;

-- ------------------------------------------------------------- 3. pacientes

-- patients.doctor_id sempre guardou o id da conta, que agora é a clínica:
-- então é só renomear e re-apontar a chave estrangeira.
alter table public.patients drop constraint if exists patients_doctor_id_fkey;
alter table public.patients rename column doctor_id to clinic_id;
alter table public.patients
  add constraint patients_clinic_id_fkey
  foreign key (clinic_id) references public.clinics (id) on delete cascade;

-- --------------------------------------------------------- 4. agendamentos

alter table public.appointments drop constraint if exists appointments_doctor_id_fkey;
alter table public.appointments rename column doctor_id to clinic_id;
alter table public.appointments
  add constraint appointments_clinic_id_fkey
  foreign key (clinic_id) references public.clinics (id) on delete cascade;

-- Novo doctor_id: qual médico vai atender.
alter table public.appointments add column if not exists doctor_id uuid;

update public.appointments a
   set doctor_id = cd.id
  from public.clinic_doctors cd
 where cd.clinic_id = a.clinic_id
   and a.doctor_id is null;

alter table public.appointments alter column doctor_id set not null;
alter table public.appointments
  add constraint appointments_doctor_id_fkey
  foreign key (doctor_id) references public.clinic_doctors (id) on delete restrict;

-- ------------------------------------------------------------- 5. consultas

alter table public.consultations drop constraint if exists consultations_doctor_id_fkey;
alter table public.consultations rename column doctor_id to clinic_id;
alter table public.consultations
  add constraint consultations_clinic_id_fkey
  foreign key (clinic_id) references public.clinics (id) on delete cascade;

alter table public.consultations add column if not exists doctor_id uuid;

update public.consultations c
   set doctor_id = cd.id
  from public.clinic_doctors cd
 where cd.clinic_id = c.clinic_id
   and c.doctor_id is null;

alter table public.consultations alter column doctor_id set not null;
alter table public.consultations
  add constraint consultations_doctor_id_fkey
  foreign key (doctor_id) references public.clinic_doctors (id) on delete restrict;

-- ------------------------------- 6. descartar a tabela antiga e renomear

drop table public.doctors;
alter table public.clinic_doctors rename to doctors;

-- --------------------------------------------------------------- 7. índices

drop index if exists public.patients_doctor_idx;
drop index if exists public.appointments_doctor_date_idx;
drop index if exists public.consultations_patient_idx;

create index if not exists patients_clinic_idx
  on public.patients (clinic_id, name);
create index if not exists doctors_clinic_idx
  on public.doctors (clinic_id, name);
create index if not exists appointments_clinic_date_idx
  on public.appointments (clinic_id, scheduled_date, scheduled_time);
create index if not exists appointments_doctor_idx
  on public.appointments (doctor_id, scheduled_date);
create index if not exists consultations_patient_idx
  on public.consultations (patient_id, occurred_on desc);

-- ------------------------------------------------------------------- 8. RLS

alter table public.clinics       enable row level security;
alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.appointments  enable row level security;
alter table public.consultations enable row level security;

-- Políticas antigas falavam em "médico"; recriamos todas em cima de clinic_id.
drop policy if exists "doctors: ler o próprio perfil"    on public.doctors;
drop policy if exists "doctors: criar o próprio perfil"  on public.doctors;
drop policy if exists "doctors: editar o próprio perfil" on public.doctors;
drop policy if exists "patients: só os próprios"         on public.patients;
drop policy if exists "appointments: só os próprios"     on public.appointments;
drop policy if exists "consultations: só as próprias"    on public.consultations;

drop policy if exists "clinics: ler o próprio cadastro"   on public.clinics;
drop policy if exists "clinics: criar o próprio cadastro" on public.clinics;
drop policy if exists "clinics: editar o próprio cadastro" on public.clinics;
drop policy if exists "doctors: só os da clínica"          on public.doctors;
drop policy if exists "patients: só os da clínica"         on public.patients;
drop policy if exists "appointments: só os da clínica"     on public.appointments;
drop policy if exists "consultations: só as da clínica"    on public.consultations;

create policy "clinics: ler o próprio cadastro"
  on public.clinics for select using (auth.uid() = id);
create policy "clinics: criar o próprio cadastro"
  on public.clinics for insert with check (auth.uid() = id);
create policy "clinics: editar o próprio cadastro"
  on public.clinics for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "doctors: só os da clínica"
  on public.doctors for all
  using (auth.uid() = clinic_id) with check (auth.uid() = clinic_id);

create policy "patients: só os da clínica"
  on public.patients for all
  using (auth.uid() = clinic_id) with check (auth.uid() = clinic_id);

create policy "appointments: só os da clínica"
  on public.appointments for all
  using (auth.uid() = clinic_id) with check (auth.uid() = clinic_id);

create policy "consultations: só as da clínica"
  on public.consultations for all
  using (auth.uid() = clinic_id) with check (auth.uid() = clinic_id);

-- ------------------------------------- 9. perfil criado no cadastro da conta

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.clinics (id, name, cnpj, email, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
             split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'cnpj', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
