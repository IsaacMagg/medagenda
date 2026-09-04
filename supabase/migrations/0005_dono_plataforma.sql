-- MedAgenda — só o dono da plataforma cria clínicas
--
-- Antes: qualquer pessoa se cadastrava e virava uma clínica nova.
-- Agora:
--   • criar clínica é privilégio de UMA conta (o dono da plataforma);
--   • o cadastro público só funciona com convite — é assim que entram tanto
--     o administrador de cada clínica quanto as recepcionistas;
--   • quem se cadastrar sem convite cria a conta, mas não entra em clínica
--     nenhuma e não enxerga nada.
--
-- Rode no SQL Editor do Supabase, depois da 0004.

begin;

-- ------------------------------------------------- 0. proteção contra re-run

do $$
begin
  if exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'platform_owners'
  ) then
    raise exception
      'A migração 0005 já foi aplicada neste banco. Nada a fazer.';
  end if;
end $$;

-- ----------------------------------------------- 1. dono(s) da plataforma

-- Tabela em vez de e-mail no código: dá para incluir outro operador depois
-- com um INSERT, sem nova migração.
create table public.platform_owners (
  email      text primary key,
  created_at timestamptz not null default now()
);

insert into public.platform_owners (email) values ('isaac201485@gmail.com');

alter table public.platform_owners enable row level security;

-- Cada dono só enxerga o próprio registro; ninguém mais lê a lista.
create policy "donos: só o próprio registro"
  on public.platform_owners for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.platform_owners
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_platform_owner() from public;
grant execute on function public.is_platform_owner() to authenticated;

-- --------------------------------- 2. clínica deixa de ser "um usuário"

-- Até aqui clinics.id era o id do usuário dono da conta. Agora a clínica é
-- criada ANTES de existir qualquer conta dela, então o id passa a ser próprio.
-- As linhas existentes mantêm o id que já tinham — as chaves estrangeiras de
-- pacientes, médicos, agendamentos e membros continuam válidas.
alter table public.clinics drop constraint if exists clinics_id_fkey;
alter table public.clinics alter column id set default gen_random_uuid();

-- ------------------------------------------------------------------- 3. RLS

drop policy if exists "clinics: ler a própria clínica"     on public.clinics;
drop policy if exists "clinics: criar a própria clínica"   on public.clinics;
drop policy if exists "clinics: admin edita a clínica"     on public.clinics;
drop policy if exists "membros: ver a equipe da clínica"   on public.clinic_members;
drop policy if exists "membros: provisionar a si mesmo"    on public.clinic_members;
drop policy if exists "convites: admin gerencia"           on public.clinic_invites;

-- clínicas ------------------------------------------------------------------
create policy "clinics: a própria, ou todas para o dono"
  on public.clinics for select
  using (id = public.current_clinic_id() or public.is_platform_owner());

create policy "clinics: só o dono da plataforma cria"
  on public.clinics for insert
  with check (public.is_platform_owner());

create policy "clinics: admin edita a sua, dono edita qualquer uma"
  on public.clinics for update
  using (
    (id = public.current_clinic_id() and public.is_clinic_admin())
    or public.is_platform_owner()
  )
  with check (
    (id = public.current_clinic_id() and public.is_clinic_admin())
    or public.is_platform_owner()
  );

-- contas --------------------------------------------------------------------
-- Sem política de INSERT: membro só nasce pelo gatilho de convite, que roda
-- como SECURITY DEFINER. Ninguém se auto-provisiona mais.
create policy "membros: a equipe da clínica, ou todas para o dono"
  on public.clinic_members for select
  using (clinic_id = public.current_clinic_id() or public.is_platform_owner());

-- convites ------------------------------------------------------------------
create policy "convites: admin da clínica ou dono da plataforma"
  on public.clinic_invites for all
  using (
    (clinic_id = public.current_clinic_id() and public.is_clinic_admin())
    or public.is_platform_owner()
  )
  with check (
    (clinic_id = public.current_clinic_id() and public.is_clinic_admin())
    or public.is_platform_owner()
  );

-- ------------------------------------------ 4. cadastro passa a ser só convite

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
    insert into public.clinic_members (user_id, clinic_id, name, email, role)
    values (new.id, convite.clinic_id, nome, new.email, convite.role)
    on conflict (user_id) do nothing;

    update public.clinic_invites
       set accepted_at = now()
     where id = convite.id;
  end if;

  -- Sem convite: a conta existe no auth, mas não pertence a clínica nenhuma.
  -- Não criamos clínica aqui — isso é privilégio do dono da plataforma.
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
