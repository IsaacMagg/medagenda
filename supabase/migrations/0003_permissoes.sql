-- MedAgenda — contas por clínica e permissões
--
-- Até aqui, "a conta era a clínica": um login só. Agora uma clínica pode ter
-- várias contas, cada uma com um papel:
--
--   admin    → faz tudo, inclusive cadastrar/editar/excluir MÉDICOS
--              e EXCLUIR pacientes
--   recepcao → agenda, cadastra e edita pacientes, registra consultas;
--              NÃO mexe em médicos e NÃO exclui pacientes
--
-- As permissões são impostas pelo RLS, no banco. Esconder o botão na tela é
-- só cortesia — quem chamar a API direto também é barrado.
--
-- Rode o arquivo inteiro no SQL Editor do Supabase, depois da 0002.

begin;

-- ------------------------------------------------- 0. proteção contra re-run

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'clinic_members'
  ) then
    raise exception
      'A migração 0003 já foi aplicada neste banco. Nada a fazer.';
  end if;
end $$;

-- ------------------------------------------------------------------ 1. tipos

do $$
begin
  if not exists (select 1 from pg_type where typname = 'clinic_role') then
    create type public.clinic_role as enum ('admin', 'recepcao');
  end if;
end $$;

-- ------------------------------------------------------ 2. contas da clínica

-- Uma conta pertence a exatamente uma clínica — por isso user_id é a PK.
create table public.clinic_members (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  clinic_id  uuid not null references public.clinics (id) on delete cascade,
  name       text not null default '',
  email      text not null,
  role       public.clinic_role not null default 'recepcao',
  created_at timestamptz not null default now()
);

create index clinic_members_clinic_idx on public.clinic_members (clinic_id);

-- Quem já tinha conta era o dono da clínica: vira administrador.
insert into public.clinic_members (user_id, clinic_id, name, email, role)
select c.id, c.id, c.name, c.email, 'admin'
  from public.clinics c
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------- 3. convites

-- Como não usamos a service_role, a conta nova não é criada pelo admin: ele
-- registra um convite e a pessoa se cadastra com aquele e-mail. O gatilho de
-- cadastro liga as duas pontas.
create table public.clinic_invites (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id) on delete cascade,
  email       text not null,
  role        public.clinic_role not null default 'recepcao',
  created_at  timestamptz not null default now(),
  accepted_at timestamptz
);

-- Um convite pendente por e-mail, no sistema todo.
create unique index clinic_invites_pending_email_idx
  on public.clinic_invites (lower(email))
  where accepted_at is null;

-- ----------------------------------------- 4. funções auxiliares de permissão

-- SECURITY DEFINER de propósito: as políticas precisam ler clinic_members sem
-- cair na própria política (recursão infinita).

create or replace function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id from public.clinic_members where user_id = auth.uid();
$$;

create or replace function public.is_clinic_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.clinic_members where user_id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_clinic_id() from public;
revoke all on function public.is_clinic_admin() from public;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.is_clinic_admin() to authenticated;

-- ------------------------------------------------------- 5. RLS reconstruído

alter table public.clinic_members enable row level security;
alter table public.clinic_invites enable row level security;

-- Políticas da 0002, que comparavam auth.uid() = clinic_id, não valem mais:
-- agora a clínica do usuário vem de clinic_members.
drop policy if exists "clinics: ler o próprio cadastro"    on public.clinics;
drop policy if exists "clinics: criar o próprio cadastro"  on public.clinics;
drop policy if exists "clinics: editar o próprio cadastro" on public.clinics;
drop policy if exists "doctors: só os da clínica"          on public.doctors;
drop policy if exists "patients: só os da clínica"         on public.patients;
drop policy if exists "appointments: só os da clínica"     on public.appointments;
drop policy if exists "consultations: só as da clínica"    on public.consultations;

-- clínicas ------------------------------------------------------------------
create policy "clinics: ler a própria clínica"
  on public.clinics for select
  using (id = public.current_clinic_id());

-- usado só no cadastro da primeira conta (o próprio usuário se provisiona)
create policy "clinics: criar a própria clínica"
  on public.clinics for insert
  with check (auth.uid() = id);

create policy "clinics: admin edita a clínica"
  on public.clinics for update
  using (id = public.current_clinic_id() and public.is_clinic_admin())
  with check (id = public.current_clinic_id() and public.is_clinic_admin());

-- contas --------------------------------------------------------------------
create policy "membros: ver a equipe da clínica"
  on public.clinic_members for select
  using (clinic_id = public.current_clinic_id());

-- fallback do provisionamento inicial: só o próprio usuário, como dono
create policy "membros: provisionar a si mesmo"
  on public.clinic_members for insert
  with check (user_id = auth.uid() and clinic_id = auth.uid());

create policy "membros: admin muda o papel"
  on public.clinic_members for update
  using (clinic_id = public.current_clinic_id() and public.is_clinic_admin())
  with check (clinic_id = public.current_clinic_id());

-- admin pode remover outras contas, mas não a própria (evita clínica órfã)
create policy "membros: admin remove conta"
  on public.clinic_members for delete
  using (
    clinic_id = public.current_clinic_id()
    and public.is_clinic_admin()
    and user_id <> auth.uid()
  );

-- convites ------------------------------------------------------------------
create policy "convites: admin gerencia"
  on public.clinic_invites for all
  using (clinic_id = public.current_clinic_id() and public.is_clinic_admin())
  with check (clinic_id = public.current_clinic_id() and public.is_clinic_admin());

-- médicos: leitura para todos da clínica, escrita só para admin -------------
create policy "medicos: ler os da clínica"
  on public.doctors for select
  using (clinic_id = public.current_clinic_id());

create policy "medicos: admin cadastra"
  on public.doctors for insert
  with check (clinic_id = public.current_clinic_id() and public.is_clinic_admin());

create policy "medicos: admin edita"
  on public.doctors for update
  using (clinic_id = public.current_clinic_id() and public.is_clinic_admin())
  with check (clinic_id = public.current_clinic_id() and public.is_clinic_admin());

create policy "medicos: admin exclui"
  on public.doctors for delete
  using (clinic_id = public.current_clinic_id() and public.is_clinic_admin());

-- pacientes: qualquer conta lê, cadastra e edita; excluir só admin ----------
create policy "pacientes: ler os da clínica"
  on public.patients for select
  using (clinic_id = public.current_clinic_id());

create policy "pacientes: qualquer conta cadastra"
  on public.patients for insert
  with check (clinic_id = public.current_clinic_id());

create policy "pacientes: qualquer conta edita"
  on public.patients for update
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create policy "pacientes: admin exclui"
  on public.patients for delete
  using (clinic_id = public.current_clinic_id() and public.is_clinic_admin());

-- agenda e prontuário: qualquer conta da clínica ---------------------------
create policy "agendamentos: da clínica"
  on public.appointments for all
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

create policy "consultas: da clínica"
  on public.consultations for all
  using (clinic_id = public.current_clinic_id())
  with check (clinic_id = public.current_clinic_id());

-- --------------------------------------- 6. cadastro: clínica nova ou convite

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  convite public.clinic_invites%rowtype;
  nome    text;
begin
  nome := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
                   split_part(new.email, '@', 1));

  select *
    into convite
    from public.clinic_invites
   where lower(email) = lower(new.email)
     and accepted_at is null
   order by created_at desc
   limit 1;

  if convite.id is not null then
    -- Conta convidada: entra na clínica de quem convidou, com o papel do convite.
    insert into public.clinic_members (user_id, clinic_id, name, email, role)
    values (new.id, convite.clinic_id, nome, new.email, convite.role)
    on conflict (user_id) do nothing;

    update public.clinic_invites
       set accepted_at = now()
     where id = convite.id;
  else
    -- Conta nova: cria a clínica e vira administradora dela.
    insert into public.clinics (id, name, cnpj, email, phone)
    values (
      new.id,
      nome,
      coalesce(new.raw_user_meta_data ->> 'cnpj', ''),
      new.email,
      nullif(new.raw_user_meta_data ->> 'phone', '')
    )
    on conflict (id) do nothing;

    insert into public.clinic_members (user_id, clinic_id, name, email, role)
    values (new.id, new.id, nome, new.email, 'admin')
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
