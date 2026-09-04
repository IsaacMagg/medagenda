-- Dados de demonstração (opcional).
--
-- Rode DEPOIS de 0001_init.sql + 0002_clinicas.sql e DEPOIS de já ter criado
-- a conta da clínica no app. Troque o e-mail abaixo pelo da sua conta.

do $$
declare
  cli uuid;
  d_helena uuid;
  d_rafael uuid;
  p_marina uuid;
  p_carlos uuid;
  p_beatriz uuid;
  p_joao uuid;
  p_sonia uuid;
  apt_carlos uuid;
begin
  select id into cli from public.clinics
   where email = 'troque@pelo-seu-email.com';

  if cli is null then
    raise exception 'Clínica não encontrada. Crie a conta no app e ajuste o e-mail acima.';
  end if;

  -- médicos ------------------------------------------------------------
  insert into public.doctors (clinic_id, name, crm, specialty)
  values
    (cli, 'Helena Prado',   'CRM/SP 154.220', 'Clínica Geral'),
    (cli, 'Rafael Antunes', 'CRM/SP 178.905', 'Cardiologia');

  select id into d_helena from public.doctors where clinic_id = cli and name = 'Helena Prado';
  select id into d_rafael from public.doctors where clinic_id = cli and name = 'Rafael Antunes';

  -- pacientes ----------------------------------------------------------
  insert into public.patients (clinic_id, name, birth_date, phone, email, cpf, address, notes)
  values
    (cli, 'Marina Alves Ribeiro',   '1991-04-12', '5511988776655', 'marina.ribeiro@email.com', '312.445.900-11', 'Rua das Acácias, 240 — São Paulo/SP', 'Alergia a dipirona.'),
    (cli, 'Carlos Eduardo Menezes', '1968-09-30', '5511977665544', 'carlos.menezes@email.com', '108.772.301-45', 'Av. Brasil, 1180 — São Paulo/SP',    'Hipertenso, uso contínuo de losartana.'),
    (cli, 'Beatriz Lopes',          '2003-01-25', '5521966554433', 'bia.lopes@email.com',      null,             null,                                  null),
    (cli, 'João Vitor Camargo',     '1985-07-08', '5531955443322', null,                       '744.210.883-09', null,                                  'Retorno pós-cirúrgico.'),
    (cli, 'Sônia Regina Barbosa',   '1957-12-03', '5511944332211', 'sonia.barbosa@email.com',  null,             'Rua Ipê Amarelo, 77 — Guarulhos/SP',  'Diabética tipo 2.');

  select id into p_marina  from public.patients where clinic_id = cli and name = 'Marina Alves Ribeiro';
  select id into p_carlos  from public.patients where clinic_id = cli and name = 'Carlos Eduardo Menezes';
  select id into p_beatriz from public.patients where clinic_id = cli and name = 'Beatriz Lopes';
  select id into p_joao    from public.patients where clinic_id = cli and name = 'João Vitor Camargo';
  select id into p_sonia   from public.patients where clinic_id = cli and name = 'Sônia Regina Barbosa';

  -- agendamentos -------------------------------------------------------
  insert into public.appointments (clinic_id, doctor_id, patient_id, scheduled_date, scheduled_time, reason, status, reminder_sent_at)
  values
    (cli, d_helena, p_marina,  current_date,     '09:00', 'Retorno — resultado de exames',      'confirmada', now() - interval '1 day'),
    (cli, d_rafael, p_carlos,  current_date,     '10:30', 'Acompanhamento de pressão arterial', 'agendada',   null),
    (cli, d_helena, p_sonia,   current_date,     '14:00', 'Ajuste de medicação',                'agendada',   null),
    (cli, d_helena, p_beatriz, current_date + 1, '08:30', 'Primeira consulta',                  'confirmada', now()),
    (cli, d_rafael, p_joao,    current_date + 2, '15:30', 'Avaliação pós-cirúrgica',            'agendada',   null),
    (cli, d_helena, p_marina,  current_date + 6, '11:00', 'Consulta de rotina',                 'agendada',   null),
    (cli, d_rafael, p_carlos,  current_date - 7, '10:00', 'Consulta de rotina',                 'realizada',  null),
    (cli, d_helena, p_sonia,   current_date - 3, '16:00', 'Revisão de glicemia',                'cancelada',  now() - interval '4 days');

  select id into apt_carlos from public.appointments
   where clinic_id = cli and patient_id = p_carlos and status = 'realizada' limit 1;

  -- consultas registradas ----------------------------------------------
  insert into public.consultations (clinic_id, doctor_id, patient_id, appointment_id, occurred_on, complaint, evolution, diagnosis, prescription)
  values
    (cli, d_rafael, p_carlos, apt_carlos, current_date - 7,
     'Dor de cabeça frequente no fim do dia.',
     'Paciente relata cefaleia occipital há cerca de 3 semanas, associada a picos pressóricos ao final da tarde. PA aferida em consultório: 148x94 mmHg. Nega alterações visuais ou náusea. Bom estado geral, orientado, sem déficits.',
     'Hipertensão arterial sistêmica em controle inadequado.',
     'Aumentar losartana para 50 mg 2x ao dia. Reduzir sódio na dieta. Retorno em 30 dias com diário de pressão.'),
    (cli, d_helena, p_marina, null, current_date - 21,
     'Cansaço e queda de cabelo.',
     'Refere fadiga progressiva há 2 meses. Solicitados hemograma, ferritina e TSH na consulta anterior; paciente traz resultados hoje. Ferritina em 11 ng/mL.',
     'Anemia ferropriva leve.',
     'Sulfato ferroso 40 mg/dia por 90 dias, longe das refeições. Repetir exames em 3 meses.'),
    (cli, d_helena, p_sonia, null, current_date - 45,
     'Revisão de diabetes tipo 2.',
     'HbA1c em 7,8%. Adesão irregular à metformina segundo relato familiar. Sem sinais de neuropatia ao exame dos pés.',
     'DM tipo 2 com controle glicêmico limítrofe.',
     'Manter metformina 850 mg 2x ao dia com reforço de adesão. Encaminhamento à nutrição. Retorno em 60 dias.');
end $$;
