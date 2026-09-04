-- MedAgenda — registrar falta do paciente
--
-- Até aqui uma consulta podia ser: agendada, confirmada, realizada ou
-- cancelada. Faltava o caso mais caro para a clínica: o paciente confirmou,
-- o horário foi reservado e ele não apareceu.
--
-- "cancelada" e "faltou" são coisas diferentes: cancelar com antecedência
-- devolve o horário para a agenda; faltar não devolve nada.
--
-- Rode no SQL Editor do Supabase, depois da 0003.
--
-- Obs.: ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação em que
-- é criado, por isso este arquivo NÃO abre transação — é um comando só.

alter type public.appointment_status add value if not exists 'faltou';

-- A API do Supabase guarda um cache do esquema. Isso avisa que ele mudou —
-- sem esse passo o app pode reclamar de valor inválido por alguns segundos.
notify pgrst, 'reload schema';
