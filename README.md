# MedAgenda

Sistema para clínicas: a recepção cadastra pacientes, marca consultas escolhendo
o médico que vai atender, registra o que aconteceu no atendimento e pede a
confirmação de presença por WhatsApp.

Next.js 15 (App Router) + TypeScript + Tailwind v4 + shadcn/ui, com **Supabase**
para autenticação e banco de dados.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

### 1. Variáveis de ambiente

O arquivo `.env.local` já está preenchido com o projeto atual (e é ignorado pelo
git). Para outro projeto, copie `.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

> ⚠️ **Sobre a `service_role`.** Ela ignora todo o RLS — quem tem essa chave lê e
> escreve qualquer coisa no banco. Repare que ela **não** tem o prefixo
> `NEXT_PUBLIC_`: por isso o Next nunca a manda para o navegador. Ela é usada em
> um lugar só, no servidor: a rota `POST /api/administracao/clinicas`, que cria a
> conta de acesso da clínica. Pegue em *Supabase → Project Settings → API →
> service_role → Reveal* e cole em `.env.local` (que já está no `.gitignore`).
> Nunca cole essa chave em chat, issue ou commit. Se ela vazar, rotacione no
> painel do Supabase.

### 2. Criar as tabelas

No painel do Supabase, abra o **SQL Editor** e rode, nesta ordem:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — esquema inicial.
2. [`supabase/migrations/0002_clinicas.sql`](supabase/migrations/0002_clinicas.sql) — muda o escopo de "um médico" para "uma clínica". Preserva os dados: cada conta antiga vira uma clínica e o médico dono da conta vira o primeiro médico dela.
3. [`supabase/migrations/0003_permissoes.sql`](supabase/migrations/0003_permissoes.sql) — várias contas por clínica, com papéis (admin / recepção) e o RLS correspondente. A conta que já existia vira administradora.
4. [`supabase/migrations/0004_falta.sql`](supabase/migrations/0004_falta.sql) — acrescenta o status `faltou` às consultas.
5. [`supabase/migrations/0005_dono_plataforma.sql`](supabase/migrations/0005_dono_plataforma.sql) — só o dono da plataforma cria clínicas; o cadastro público passa a ser exclusivamente por convite.

Enquanto a 0002 não for aplicada, o app avisa na tela.

Opcional: [`supabase/seed_demo.sql`](supabase/seed_demo.sql) popula pacientes e
consultas de exemplo. Ajuste o e-mail no começo do arquivo para o da sua conta.

### 3. Colocar a primeira clínica no ar

Ninguém cria clínica pelo cadastro público. A ordem é:

1. **O dono da plataforma cria a conta dele** em `/cadastro`, com o e-mail que
   está em `platform_owners` (hoje `isaac201485@gmail.com`). Ele não entra em
   clínica nenhuma — ao entrar, cai direto em `/administracao`.
2. **Em `/administracao`, ele cadastra a clínica**: nome, CNPJ, telefone, e-mail
   de acesso e senha inicial. A conta da clínica já nasce pronta, com o e-mail
   confirmado — **a clínica não se cadastra**. As credenciais aparecem uma vez
   na tela, para serem repassadas.
3. **A clínica entra pelo login** com essas credenciais, já como administradora.
4. Dentro do sistema, ela cadastra os médicos em `/medicos` — sem pelo menos um
   médico não é possível agendar — e convida a recepção em `/equipe`.

O projeto está com **confirmação de e-mail obrigatória**: é preciso clicar no
link recebido antes de entrar. Para testar sem esse passo, desligue em
*Authentication → Providers → Email → Confirm email* no painel do Supabase.

## Modelo de dados

| Tabela           | O que guarda                                                      |
| ---------------- | ----------------------------------------------------------------- |
| `clinics`        | A clínica: nome, CNPJ, telefone                                    |
| `clinic_members` | Contas de acesso ligadas à clínica, com o papel de cada uma        |
| `clinic_invites` | Convites pendentes para novas contas entrarem                      |
| `doctors`        | Médicos daquela clínica — cadastro, não conta de acesso            |
| `patients`       | Pacientes da clínica                                               |
| `appointments`   | Agendamentos: paciente, **médico**, data, hora, motivo, status     |
| `consultations`  | Registro clínico do atendimento, com o médico responsável          |

**Segurança:** RLS ligado em todas elas. As políticas comparam o `clinic_id` da
linha com `public.current_clinic_id()` — a clínica da conta logada —, então uma
clínica nunca lê nem escreve dados de outra. A garantia é do banco, não do
front-end.

**Médicos são registros, não usuários.** Quem faz login é uma conta da clínica;
o médico é escolhido em cada agendamento. Um médico só pode ser removido se não
tiver agendamentos nem consultas ligadas a ele (`on delete restrict`).

## Contas e permissões

Uma clínica tem várias contas (`clinic_members`), cada uma com um papel:

| Ação                                   | Administrador | Recepção |
| -------------------------------------- | :-----------: | :------: |
| Ver médicos                            |       ✓       |    ✓     |
| Cadastrar / editar / excluir médicos   |       ✓       |    —     |
| Cadastrar e editar pacientes           |       ✓       |    ✓     |
| **Excluir** pacientes                  |       ✓       |    —     |
| Agendar, confirmar, registrar consulta |       ✓       |    ✓     |
| Gerenciar a equipe                     |       ✓       |    —     |

**Isso é imposto pelo banco, não pela tela.** As políticas de RLS chamam
`public.is_clinic_admin()`; esconder o botão é só cortesia — quem chamar a API
direto recebe a mesma recusa.

### Quem cria o quê

| Quem                       | Pode criar                                    |
| -------------------------- | --------------------------------------------- |
| Dono da plataforma         | Clínicas **e a conta de acesso** de cada uma    |
| Administrador da clínica   | Convites para a equipe daquela clínica         |
| Recepção                   | Nada de contas                                 |

Quem está em `platform_owners` é o único que consegue inserir em `clinics` — a
regra está no RLS, não na tela.

### Como uma conta nova entra

São dois caminhos, e nenhum deles é auto-cadastro livre:

**A conta da clínica** é criada pelo dono da plataforma, em `/administracao`. A
rota `POST /api/administracao/clinicas` confere no servidor que quem chamou é
mesmo um `platform_owner` e só então usa a `service_role` para criar o usuário
com `email_confirm: true`, a clínica e o vínculo de administrador — os três
passos, com desfazimento se algum falhar. A clínica recebe e-mail e senha
prontos.

**As demais contas da clínica** (recepção, outros admins) entram por convite:

1. O admin registra o convite em `/equipe` (e-mail + papel).
2. A pessoa se cadastra em `/cadastro` — **“Tenho um convite”** — com aquele
   mesmo e-mail.
3. O gatilho `handle_new_user` acha o convite pendente e liga a conta à clínica
   com o papel definido.

O convite **não dispara e-mail**: quem avisa a pessoa é quem convidou. E quem se
cadastrar sem convite cria a conta, mas cai numa tela de “conta sem clínica” e
não enxerga dado nenhum.

## Telas

| Rota                | O que tem                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `/login`            | Entrada por e-mail e senha (Supabase Auth)                                 |
| `/cadastro`         | "Tenho um convite": cria a conta de quem foi convidado                     |
| `/recuperar-senha`  | Envia o link de redefinição                                                |
| `/redefinir-senha`  | Define a senha nova após clicar no link                                    |
| `/auth/callback`    | Troca o código do e-mail pela sessão                                       |
| `/dashboard`        | Aviso das consultas de hoje (com o médico), indicadores e próximas consultas |
| `/pacientes`        | Busca e listagem, com "Novo paciente" e atalho para agendar                |
| `/pacientes/[id]`   | Ficha do paciente: dados, próxima consulta, histórico e agendamentos       |
| `/agenda`           | Calendário do mês, filtro por médico e painel do dia selecionado           |
| `/medicos`          | Cadastro dos médicos da clínica (escrita só para admin)                    |
| `/equipe`           | Contas com acesso, papéis e convites (só admin)                            |
| `/administracao`    | Cadastro de clínicas e das contas de acesso (só o dono da plataforma)      |

As rotas de dados são protegidas no servidor por `src/middleware.ts`, que também
renova a sessão a cada requisição.

## Os fluxos principais

- **Novo médico** → `DoctorDialog`: nome, registro profissional e especialidade.
  O registro é texto livre e aceita qualquer conselho (CRM, CRO, CRP, CREFITO…),
  já que a clínica pode ter especialidades diferentes; a coluna no banco ainda se
  chama `crm` por herança. Sem ao menos um médico cadastrado, o diálogo de
  agendamento bloqueia e manda para `/medicos`.
- **Novo paciente** → `PatientDialog`: nome, nascimento, telefone/WhatsApp,
  e-mail, CPF, endereço e observações clínicas.
- **Agendar consulta** → `AppointmentDialog`: paciente, **médico**, data, hora e
  motivo. Nasce como "aguardando confirmação". Com um único médico na clínica,
  ele já vem selecionado.
- **Nova consulta** → `ConsultationDialog`: descreve como foi o atendimento.
  Quando aberta a partir de um agendamento, o médico vem do próprio
  agendamento. Salvar marca o agendamento vinculado como "realizada".
- **Registrar falta** → botão "Faltou" na consulta, disponível a partir do dia
  marcado (no painel do dia, na agenda e na ficha do paciente). A ficha mostra
  o total de faltas e as datas; a lista de pacientes mostra a contagem e a data
  da última.
- **Aviso do dia** → bloco no topo do dashboard com as consultas de hoje.
- **Confirmação por WhatsApp** → `WhatsAppConfirmButton`: abre um preview com o
  número salvo e a mensagem pronta; ao confirmar, abre o `wa.me` e grava
  `reminder_sent_at` no agendamento.

## Identidade visual

- **Cor de marca:** verde-água clínico (`--primary`), com azul-céu de apoio
  (`--sky`). Status usam verde (confirmada), âmbar (aguardando), cinza
  (realizada) e vermelho (cancelada).
- **Tipografia:** Plus Jakarta Sans nos títulos, Inter no texto corrido.
- **Texturas:** malha de cruzinhas e traçado de eletrocardiograma
  (`src/components/decorations.tsx`).
- **Tokens:** cores, raios e sombras em `src/app/globals.css`. Trocar a paleta é
  mexer só nas variáveis do `:root`.

## Estrutura

```
src/
  middleware.ts             protege rotas e renova a sessão
  app/
    login/ cadastro/ recuperar-senha/ redefinir-senha/
    auth/callback/          troca o código do e-mail pela sessão
    (app)/                  área logada (sidebar)
      dashboard/ pacientes/ agenda/ medicos/ equipe/
  components/
    ui/                     componentes shadcn/ui
    app-shell.tsx           sidebar, topo mobile, PageHeader
    doctor-dialog.tsx  patient-dialog.tsx
    appointment-dialog.tsx  consultation-dialog.tsx
    whatsapp-confirm-button.tsx
  lib/
    supabase/
      client.ts             cliente do navegador
      server.ts             cliente de Server Components / Route Handlers
      middleware.ts         renovação de sessão + guarda de rotas
      database.types.ts     tipos das tabelas
      mappers.ts            snake_case ↔ camelCase
    store.tsx               estado da aplicação sobre o Supabase
    whatsapp.ts             mensagem e link wa.me
    format.ts               datas, telefone, idade, rótulos de status
supabase/
  migrations/0001_init.sql      esquema inicial + RLS + trigger
  migrations/0002_clinicas.sql  escopo de clínica (clinics + médicos)
  migrations/0003_permissoes.sql  contas por clínica, papéis e RLS
  migrations/0004_falta.sql       status "faltou" nas consultas
  migrations/0005_dono_plataforma.sql  dono da plataforma e cadastro por convite
  seed_demo.sql                 dados de exemplo (opcional)
```

## O que ainda falta integrar

**WhatsApp automático.** Hoje `src/lib/whatsapp.ts` monta um link `wa.me` e o
médico clica para enviar. Para o lembrete sair sozinho no dia da consulta é
preciso a Cloud API da Meta (com template aprovado) ou um intermediário como
Twilio/Z-API, chamada a partir de uma Edge Function do Supabase agendada por
`pg_cron`. O ponto de troca é a função `sendConfirmationRequest`.

## Notas

- `npm audit` aponta uma vulnerabilidade de build no `postcss` que vem como
  dependência interna do Next 15. Corrigir exige subir para o Next 16 — vale
  fazer, mas em uma mudança separada.
- Não rode `next build` com o servidor de dev ligado: os dois usam a mesma pasta
  `.next` e o dev quebra com "Cannot find module".
