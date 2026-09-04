-- MedAgenda — regras de integridade, auditoria e fuso de Brasília
--
-- Fecha os buracos que o RLS sozinho não cobria. Tudo em uma transação:
-- ou aplica inteiro, ou não aplica nada.
--
-- NÃO incluído de propósito: unicidade de CPF. O mesmo paciente pode estar
-- em clínicas diferentes, então o mesmo CPF pode aparecer mais de uma vez.
--
-- Rode no SQL Editor do Supabase, depois da 0005.

begin;

do $$
begin
  if exists (select 1 from information_schema.tables
              where table_schema='public' and table_name='audit_log') then
    raise exception 'A migração 0006 já foi aplicada neste banco. Nada a fazer.';
  end if;
end $$;

-- =====================================================  fuso de Brasília

-- Uma decisão do produto: toda a operação é no horário de Brasília, não no
-- fuso do servidor nem no do navegador.
create or replace function public.agora_brasilia()
returns timestamptz language sql stable as $$
  select now();
$$;

create or replace function public.hoje_brasilia()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

grant execute on function public.agora_brasilia() to authenticated, anon;
grant execute on function public.hoje_brasilia() to authenticated, anon;

-- ==========================================  1 e 2. integridade entre clínicas

-- Sem isto, dá para gravar um agendamento da minha clínica apontando para o
-- médico de outra: a FK simples só confere se o id existe.
alter table public.doctors      add constraint doctors_id_clinic_key      unique (id, clinic_id);
alter table public.patients     add constraint patients_id_clinic_key     unique (id, clinic_id);
alter table public.appointments add constraint appointments_id_clinic_key unique (id, clinic_id);

alter table public.appointments drop constraint if exists appointments_doctor_id_fkey;
alter table public.appointments drop constraint if exists appointments_patient_id_fkey;
alter table public.appointments
  add constraint appointments_doctor_fk
  foreign key (doctor_id, clinic_id)
  references public.doctors (id, clinic_id) on delete restrict;
alter table public.appointments
  add constraint appointments_patient_fk
  foreign key (patient_id, clinic_id)
  references public.patients (id, clinic_id) on delete cascade;

alter table public.consultations drop constraint if exists consultations_doctor_id_fkey;
alter table public.consultations drop constraint if exists consultations_patient_id_fkey;
alter table public.consultations
  add constraint consultations_doctor_fk
  foreign key (doctor_id, clinic_id)
  references public.doctors (id, clinic_id) on delete restrict;
alter table public.consultations
  add constraint consultations_patient_fk
  foreign key (patient_id, clinic_id)
  references public.patients (id, clinic_id) on delete cascade;

-- =============================================  3, 4 e 5. regras de agenda

-- Um médico não atende dois pacientes no mesmo minuto. Cancelada libera o horário.
create unique index appointments_sem_choque_medico
  on public.appointments (doctor_id, scheduled_date, scheduled_time)
  where status <> 'cancelada';

-- E o paciente não está em duas salas ao mesmo tempo.
create unique index appointments_sem_choque_paciente
  on public.appointments (patient_id, scheduled_date, scheduled_time)
  where status <> 'cancelada';

-- Um atendimento não é registrado duas vezes.
create unique index consultations_uma_por_agendamento
  on public.consultations (appointment_id)
  where appointment_id is not null;

-- ================================  6, 7. falta e transições de status

create or replace function public.valida_agendamento()
returns trigger language plpgsql as $$
begin
  -- 6. Falta só faz sentido a partir do dia da consulta.
  if new.status = 'faltou' and new.scheduled_date > public.hoje_brasilia() then
    raise exception 'Não dá para marcar falta em consulta futura (%).', new.scheduled_date
      using errcode = 'check_violation';
  end if;

  -- 7. Consulta realizada é ponto final: corrige-se por adendo, não voltando atrás.
  if tg_op = 'UPDATE' and old.status = 'realizada' and new.status <> 'realizada' then
    raise exception 'Consulta já realizada não volta para "%".', new.status
      using errcode = 'check_violation';
  end if;

  if new.reminder_sent_at is not null and new.reminder_sent_at > now() then
    raise exception 'A data de envio do lembrete não pode estar no futuro.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger agendamentos_validos
  before insert or update on public.appointments
  for each row execute function public.valida_agendamento();

-- ==========================================  8, 9. clínica: CNPJ e e-mail

alter table public.clinics
  add constraint clinics_cnpj_formato
  check (cnpj = '' or length(regexp_replace(cnpj, '\D', '', 'g')) = 14);

create unique index clinics_cnpj_unico
  on public.clinics (regexp_replace(cnpj, '\D', '', 'g'))
  where cnpj <> '';

create unique index clinics_email_unico on public.clinics (lower(email));

-- Normaliza e-mail na entrada: evita "Contato@" e "contato@" virarem dois.
create or replace function public.normaliza_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end $$;

create trigger clinics_email_normalizado
  before insert or update on public.clinics
  for each row execute function public.normaliza_email();
create trigger membros_email_normalizado
  before insert or update on public.clinic_members
  for each row execute function public.normaliza_email();
create trigger convites_email_normalizado
  before insert or update on public.clinic_invites
  for each row execute function public.normaliza_email();

-- ================================  10, 11, 12, 14. validação de conteúdo

-- 10. O telefone alimenta o WhatsApp: sem dígitos suficientes não serve.
alter table public.patients
  add constraint patients_telefone_valido
  check (length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15);

-- 11. Nascimento plausível (o "não futuro" fica no gatilho, que enxerga a data de hoje).
alter table public.patients
  add constraint patients_nascimento_plausivel
  check (birth_date > date '1900-01-01');

create or replace function public.valida_paciente()
returns trigger language plpgsql as $$
begin
  if new.birth_date > public.hoje_brasilia() then
    raise exception 'Data de nascimento no futuro (%).', new.birth_date
      using errcode = 'check_violation';
  end if;
  if length(btrim(new.name)) < 3 then
    raise exception 'Nome do paciente muito curto.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger pacientes_validos
  before insert or update on public.patients
  for each row execute function public.valida_paciente();

-- 12. Evolução é o núcleo do prontuário: not null não basta, '' passava.
alter table public.consultations
  add constraint consultations_evolucao_preenchida
  check (length(btrim(evolution)) > 0);

alter table public.consultations
  add constraint consultations_data_plausivel
  check (occurred_on > date '1900-01-01');

create or replace function public.valida_consulta()
returns trigger language plpgsql as $$
declare
  apt record;
begin
  if new.occurred_on > public.hoje_brasilia() then
    raise exception 'Não dá para registrar consulta com data futura (%).', new.occurred_on
      using errcode = 'check_violation';
  end if;

  -- 2. A consulta tem de pertencer ao mesmo agendamento, paciente e clínica.
  if new.appointment_id is not null then
    select * into apt from public.appointments where id = new.appointment_id;
    if apt.id is null then
      raise exception 'Agendamento inexistente.' using errcode = 'foreign_key_violation';
    end if;
    if apt.clinic_id <> new.clinic_id or apt.patient_id <> new.patient_id then
      raise exception 'O agendamento é de outro paciente ou de outra clínica.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

create trigger consultas_validas
  before insert or update on public.consultations
  for each row execute function public.valida_consulta();

-- 14. Registro profissional obrigatório (CRM, CRO, CRP… texto livre, mas presente).
alter table public.doctors
  add constraint doctors_registro_preenchido
  check (length(btrim(crm)) > 0);

alter table public.doctors
  add constraint doctors_nome_preenchido
  check (length(btrim(name)) >= 3);

-- ==================================  15, 16. clínica nunca sem administrador

create or replace function public.garante_admin_na_clinica()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  alvo uuid := coalesce(new.clinic_id, old.clinic_id);
begin
  -- Durante a exclusão da clínica inteira não há o que garantir.
  if not exists (select 1 from public.clinics where id = alvo) then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1 from public.clinic_members
     where clinic_id = alvo and role = 'admin'
  ) then
    raise exception 'A clínica ficaria sem nenhum administrador.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end $$;

create constraint trigger clinica_com_admin
  after update or delete on public.clinic_members
  deferrable initially deferred
  for each row execute function public.garante_admin_na_clinica();

-- 16. Um admin não se rebaixa sozinho (fechava a clínica por engano).
drop policy if exists "membros: admin muda o papel" on public.clinic_members;
create policy "membros: admin muda o papel de outros"
  on public.clinic_members for update
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.is_clinic_admin())
    and user_id <> (select auth.uid())
  )
  with check (clinic_id = (select public.current_clinic_id()));

-- ====================================  17, 18, 19. convites

alter table public.clinic_invites
  add column if not exists expires_at timestamptz not null default now() + interval '7 days';

-- 19. O convite passa a ser por clínica: duas clínicas podem chamar o mesmo e-mail.
drop index if exists public.clinic_invites_pending_email_idx;
create unique index clinic_invites_pendente_por_clinica
  on public.clinic_invites (clinic_id, lower(email))
  where accepted_at is null;

create or replace function public.valida_convite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 17. Convidar quem já está dentro não faz nada além de confundir.
  if exists (
    select 1 from public.clinic_members
     where clinic_id = new.clinic_id
       and lower(email) = lower(new.email)
  ) then
    raise exception 'Esse e-mail já é uma conta desta clínica.'
      using errcode = 'unique_violation';
  end if;
  return new;
end $$;

create trigger convites_validos
  before insert on public.clinic_invites
  for each row execute function public.valida_convite();

-- ============================================  20. o último dono da plataforma

create or replace function public.protege_ultimo_dono()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.platform_owners) <= 1 then
    raise exception 'Não dá para remover o último responsável pela plataforma.'
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

create trigger platform_owners_protegido
  before delete on public.platform_owners
  for each row execute function public.protege_ultimo_dono();

-- ===============================  21. paciente: exclusão lógica, não física

-- Prontuário tem guarda obrigatória. Apagar paciente passa a esconder, não destruir.
alter table public.patients add column if not exists deleted_at timestamptz;

create index patients_ativos_idx on public.patients (clinic_id) where deleted_at is null;

-- Só administrador arquiva; e ninguém apaga de verdade pela API.
create or replace function public.valida_arquivamento_paciente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and not (select public.is_clinic_admin()) then
    raise exception 'Só uma conta administradora pode arquivar pacientes.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger pacientes_arquivamento
  before update on public.patients
  for each row execute function public.valida_arquivamento_paciente();

-- =========================  22, 23. autoria, updated_at e trilha de auditoria

alter table public.consultations
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.clinics       add column if not exists updated_at timestamptz not null default now();
alter table public.doctors       add column if not exists updated_at timestamptz not null default now();
alter table public.patients      add column if not exists updated_at timestamptz not null default now();
alter table public.appointments  add column if not exists updated_at timestamptz not null default now();
alter table public.consultations add column if not exists updated_at timestamptz not null default now();

create or replace function public.marca_atualizacao()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_table_name = 'consultations' and tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  end if;
  return new;
end $$;

create trigger clinics_updated_at       before insert or update on public.clinics       for each row execute function public.marca_atualizacao();
create trigger doctors_updated_at       before insert or update on public.doctors       for each row execute function public.marca_atualizacao();
create trigger patients_updated_at      before insert or update on public.patients      for each row execute function public.marca_atualizacao();
create trigger appointments_updated_at  before insert or update on public.appointments  for each row execute function public.marca_atualizacao();
create trigger consultations_updated_at before insert or update on public.consultations for each row execute function public.marca_atualizacao();

create table public.audit_log (
  id         bigserial primary key,
  clinic_id  uuid,
  tabela     text not null,
  registro   uuid,
  acao       text not null,
  autor      uuid,
  em         timestamptz not null default now(),
  antes      jsonb,
  depois     jsonb
);

create index audit_log_clinica_idx on public.audit_log (clinic_id, em desc);

alter table public.audit_log enable row level security;

-- A clínica lê a própria trilha; o dono da plataforma lê todas. Ninguém escreve
-- pela API: só o gatilho, que roda como definer.
create policy "auditoria: a da própria clínica"
  on public.audit_log for select
  using (
    clinic_id = (select public.current_clinic_id())
    or (select public.is_platform_owner())
  );

create or replace function public.registra_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (clinic_id, tabela, registro, acao, autor, antes, depois)
  values (
    (linha ->> 'clinic_id')::uuid,
    tg_table_name,
    (linha ->> 'id')::uuid,
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger doctors_auditoria       after insert or update or delete on public.doctors       for each row execute function public.registra_auditoria();
create trigger patients_auditoria      after insert or update or delete on public.patients      for each row execute function public.registra_auditoria();
create trigger appointments_auditoria  after insert or update or delete on public.appointments  for each row execute function public.registra_auditoria();
create trigger consultations_auditoria after insert or update or delete on public.consultations for each row execute function public.registra_auditoria();

-- ==========================  24. consulta registrada não se reescreve

create or replace function public.consulta_somente_leitura()
returns trigger language plpgsql as $$
begin
  if new.complaint    is distinct from old.complaint
  or new.evolution    is distinct from old.evolution
  or new.diagnosis    is distinct from old.diagnosis
  or new.prescription is distinct from old.prescription
  or new.occurred_on  is distinct from old.occurred_on
  or new.patient_id   is distinct from old.patient_id
  or new.doctor_id    is distinct from old.doctor_id then
    raise exception 'Consulta registrada não pode ser reescrita. Registre um novo atendimento.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger consultas_imutaveis
  before update on public.consultations
  for each row execute function public.consulta_somente_leitura();

-- ==============  25. e-mail e CNPJ da clínica só mudam pela Administração

create or replace function public.protege_dados_da_clinica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.email is distinct from old.email or new.cnpj is distinct from old.cnpj)
     and not (select public.is_platform_owner()) then
    raise exception 'E-mail e CNPJ da clínica só mudam pela Administração.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger clinics_campos_protegidos
  before update on public.clinics
  for each row execute function public.protege_dados_da_clinica();

-- ==================================================  28. índices que faltavam

create index appointments_status_idx on public.appointments (clinic_id, status);
create index patients_telefone_idx   on public.patients (clinic_id, phone);
create index consultations_autor_idx on public.consultations (created_by);

create extension if not exists pg_trgm;
create index patients_nome_busca_idx on public.patients using gin (name gin_trgm_ops);

-- =====================  29. RLS: uma avaliação por consulta, não por linha

-- Envolver a chamada em (select ...) faz o planejador calcular uma vez só.
drop policy if exists "clinics: a própria, ou todas para o dono"        on public.clinics;
drop policy if exists "clinics: admin edita a sua, dono edita qualquer uma" on public.clinics;
drop policy if exists "membros: a equipe da clínica, ou todas para o dono"  on public.clinic_members;
drop policy if exists "convites: admin da clínica ou dono da plataforma" on public.clinic_invites;
drop policy if exists "medicos: ler os da clínica"        on public.doctors;
drop policy if exists "medicos: admin cadastra"           on public.doctors;
drop policy if exists "medicos: admin edita"              on public.doctors;
drop policy if exists "medicos: admin exclui"             on public.doctors;
drop policy if exists "pacientes: ler os da clínica"      on public.patients;
drop policy if exists "pacientes: qualquer conta cadastra" on public.patients;
drop policy if exists "pacientes: qualquer conta edita"   on public.patients;
drop policy if exists "pacientes: admin exclui"           on public.patients;
drop policy if exists "agendamentos: da clínica"          on public.appointments;
drop policy if exists "consultas: da clínica"             on public.consultations;

create policy "clinics: a própria, ou todas para o dono"
  on public.clinics for select
  using (id = (select public.current_clinic_id()) or (select public.is_platform_owner()));

create policy "clinics: admin edita a sua, dono edita qualquer uma"
  on public.clinics for update
  using ((id = (select public.current_clinic_id()) and (select public.is_clinic_admin()))
         or (select public.is_platform_owner()))
  with check ((id = (select public.current_clinic_id()) and (select public.is_clinic_admin()))
              or (select public.is_platform_owner()));

create policy "membros: a equipe da clínica, ou todas para o dono"
  on public.clinic_members for select
  using (clinic_id = (select public.current_clinic_id()) or (select public.is_platform_owner()));

create policy "convites: admin da clínica ou dono da plataforma"
  on public.clinic_invites for all
  using ((clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()))
         or (select public.is_platform_owner()))
  with check ((clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()))
              or (select public.is_platform_owner()));

create policy "medicos: ler os da clínica"
  on public.doctors for select
  using (clinic_id = (select public.current_clinic_id()));
create policy "medicos: admin cadastra"
  on public.doctors for insert
  with check (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()));
create policy "medicos: admin edita"
  on public.doctors for update
  using (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()))
  with check (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()));
create policy "medicos: admin exclui"
  on public.doctors for delete
  using (clinic_id = (select public.current_clinic_id()) and (select public.is_clinic_admin()));

-- Paciente arquivado some das listas; a exclusão física deixa de existir.
create policy "pacientes: ler os ativos da clínica"
  on public.patients for select
  using (clinic_id = (select public.current_clinic_id()) and deleted_at is null);
create policy "pacientes: qualquer conta cadastra"
  on public.patients for insert
  with check (clinic_id = (select public.current_clinic_id()));
create policy "pacientes: qualquer conta edita"
  on public.patients for update
  using (clinic_id = (select public.current_clinic_id()))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "agendamentos: da clínica"
  on public.appointments for all
  using (clinic_id = (select public.current_clinic_id()))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "consultas: da clínica"
  on public.consultations for all
  using (clinic_id = (select public.current_clinic_id()))
  with check (clinic_id = (select public.current_clinic_id()));

-- ==========================  18. convite vencido não vale mais

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  convite public.clinic_invites%rowtype;
  nome    text;
begin
  nome := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''),
                   split_part(new.email, '@', 1));

  select * into convite
    from public.clinic_invites
   where lower(email) = lower(new.email)
     and accepted_at is null
     and expires_at > now()
   order by created_at desc
   limit 1;

  if convite.id is not null then
    insert into public.clinic_members (user_id, clinic_id, name, email, role)
    values (new.id, convite.clinic_id, nome, new.email, convite.role)
    on conflict (user_id) do nothing;

    update public.clinic_invites set accepted_at = now() where id = convite.id;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
