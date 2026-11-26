# Divisão do backend: João × Gustavo, com revisão do Matheus e da Kelly

Objetivo: trabalhar ao mesmo tempo **sem conflito de código**. Cada desenvolvedor é dono de
arquivos diferentes e ninguém edita o arquivo do outro. Matheus e Kelly revisam e testam.

> Atualizado em 18/11: a autenticação passou do Matheus para o Gustavo; Matheus e Kelly ficam
> com revisão e testes. Quem decide o escopo é o coordenador (Guilherme; Pablo no período em que ele estiver fora).

## Quem faz o quê

| Pessoa | Papel |
|---|---|
| **João** | FatoBot, fontes oficiais e IA |
| **Gustavo** | Autenticação, conta do usuário e painel do administrador |
| **Matheus e Kelly** | Revisão dos PRs e testes (roteiro de testes e ensaio com a turma) |

## Quem é dono de qual arquivo

| | **João** | **Gustavo** |
|---|---|---|
| Pastas e arquivos | `src/routes/*` · `src/services/*` · `src/data/*` · `src/utils/*` · `scripts/*` | **tudo dentro de `src/auth/`** |
| Rotas | `/api/health`, `/api/deputados`, `/api/fatobot`, `/api/verificar`, `/api/cep`, `/api/whatsapp` | `/api/auth`, `/api/conta`, `/api/admin` |
| Testes | `test/*.test.js` que já existem + novos do João | `test/auth-*.test.js` (prefixo `auth-`) |
| Documentação | `backend/README.md` | `src/auth/README.md` |
| Branch | `joao/...` | `gustavo/...` |

**Pode importar, não pode editar.** O Gustavo pode *usar* funções do João (ex.: `limparTextoUsuario`,
`comPrazo`, `limitarPorIp`), mas se precisar mudar alguma, pede para o João. O mesmo vale ao contrário.

### Arquivos compartilhados (regras)

| Arquivo | Regra |
|---|---|
| `src/app.js` | **Ninguém mexe.** A área de autenticação já está registrada (`app.use('/api', authRouter)`). Rotas novas do Gustavo entram em `src/auth/index.js`. |
| `.env.example` | Cada um edita **só o seu bloco**. O da autenticação é o último do arquivo. |
| `package.json` / `package-lock.json` | Precisou de biblioteca nova? Avise o outro no grupo. Se der conflito no `package-lock.json`, aceite qualquer lado e rode `npm install`. |

## Tarefas

### João

| # | Tarefa | Arquivos | Prazo | Situação |
|---|---|---|---|---|
| J10 | **Limites de uso**: por IP contra abuso (60/min) e cota da IA para o servidor (14/min, 450/dia), sem bloquear uma turma no mesmo IP | `src/utils/limite.js`, `src/routes/fatobot.js`, `src/routes/verificar.js` | 20/11 | ✅ feito (PR #4) |
| J11 | **Base de conhecimento da Constituição** no FatoBot ("o que são os Três Poderes?"), a partir do backup do Matheus, com crédito | `src/data/base-conhecimento.js`, `src/services/base.js`, `src/services/fatobot.js` | 20/11 | ✅ feito (PR #4) |
| J12 | **`/api/health` com o status das fontes** (Câmara, cópia de reserva, Supabase, Gemini) para conferir tudo antes da apresentação | `src/routes/health.js`, `src/services/saude.js` | 24/11 | ✅ feito (PR #4) |
| J13 | **Anexos do Verificar**: aplicar a decisão do grupo (ajustar texto ou guardar para revisão humana) | `src/services/verificar.js`, `src/routes/verificar.js` | 24/11 | ✅ backend feito (PR #5); falta o front mandar só as informações dos anexos (Luiz) |
| J15 | **`POST /api/traduzir`**: explica a ementa dos projetos em linguagem simples (o front já chamava e recebia 404) | `src/services/traduzir.js`, `src/routes/traduzir.js` | 25/11 | ✅ feito (PR #5) |
| J16 | **Senadores no Supabase** (relatório da Kelly: aba Senadores vazia). `npm run importar` grava deputados e senadores; a busca de deputados e o FatoBot filtram por cargo; `/api/health/fontes` e `npm run conferir` mostram quantos senadores há | `src/services/senado.js`, `scripts/importar-deputados.js`, `src/services/supabase.js`, `src/services/saude.js` | 25/11 | ✅ código pronto; falta rodar `npm run importar` no Brasil (dev e prod) |
| J17 | **Todos os políticos e mais fontes oficiais** (pedido do Guilherme, 24/11): eleitos do TSE (presidente, governadores, dep. estaduais, prefeitos e vereadores) no Supabase; FatoBot e Fato ou Fake respondem sobre eles; catálogo `GET /api/fontes` e `onde_conferir` nas respostas sem evidência | `src/services/tse.js`, `src/services/outros-politicos.js`, `src/data/fontes-oficiais.js`, `src/routes/fontes.js`, `scripts/importar-tse.js`, `supabase/politicos-todos-os-cargos.sql` | 26/11 | ✅ código pronto; falta rodar o SQL e o `npm run importar-tse` (dev e prod) |
| J18 | **Perfis do TSE completos e ajustes do congelamento** (Guilherme, 27/11): campos novos do consulta_cand, bens (`politico_bens`, `bens_total`), votos; repasse da Câmara com cache na Vercel e 429; fotos de senador em https; preposição dos estados; log do Verificar | `src/services/tse.js`, `scripts/importar-tse.js`, `supabase/politicos-tse-detalhes.sql`, `src/routes/camara.js` | 28/11 | ✅ código pronto; falta rodar o SQL e o `importar-tse` |
| J14 | **Antes da apresentação**: `npm run atualizar-deputados`, importação no Supabase de produção | `src/data/deputados.json`, `scripts/conferir.js`, `APRESENTACAO.md` | 26/11 | ⏳ roteiro e `npm run conferir` prontos; executar na véspera |

### Gustavo

| # | Tarefa | Arquivos | Prazo |
|---|---|---|---|
| G1 | **Middleware de login.** `exigirLogin`: lê `Authorization: Bearer <token>` (o token de sessão do Supabase que o front já tem), valida com `supabase.auth.getUser(token)` e coloca o usuário em `req.usuario`. Sem token ou token inválido → `401`. `exigirModerador`: confere `perfis.is_moderador`; se não for → `403`. | `src/auth/middlewares.js` | 20/11 |
| G2 | **Supabase "como o usuário".** Cliente criado com a chave pública **e o token do usuário**, para as regras de segurança (RLS) do `schema.sql` valerem. **Nunca** usar a `service_role` na API. | `src/auth/supabase-usuario.js` | 20/11 |
| G3 | **Conta (LGPD).** `GET /api/conta/me` (perfil do usuário logado) e `DELETE /api/conta` (chama a função `excluir_minha_conta()` do banco com o token do usuário). | `src/auth/rotas/conta.js` | 24/11 |
| G4 | **Dashboard do administrador.** `GET /api/admin/metricas` (só moderador): total de usuários, comunidades, publicações e denúncias abertas. | `src/auth/rotas/admin.js` | 24/11 |
| G5 | **Login com Gmail (desafio).** Ativar o Google em *Supabase → Authentication → Providers* (nos projetos **dev** e **prod**, ver `supabase/AMBIENTES.md`) e o SMTP do e-mail de confirmação; documentar e combinar com o Luiz o `signInWithOAuth` no front. | `src/auth/README.md` (e painel do Supabase) | 26/11 |
| G6 | **Testes** de G1–G4 com Supabase falso (sem internet), rodando no `npm test`. | `test/auth-*.test.js` | junto de cada tarefa |

### Matheus e Kelly: revisão e testes

| # | Tarefa | Prazo |
|---|---|---|
| R1 | **Revisar todo PR** de backend antes de entrar na `main` (pelo menos um dos dois aprova). Conferir: os testes passam (`npm test`), não há chave no código, o PR mexe só nos arquivos do dono. | contínuo |
| R2 | **Roteiro de testes manuais** em `docs/` (ou no Trello): o que testar em cada tela/rota e o resultado esperado (ex.: FatoBot com a Câmara fora, "oi tudo bem", truque no prompt, CEP, login, recuperar senha). | 24/11 |
| R3 | **Testar as prévias da Vercel** (banco **dev**) de cada PR, seguindo o roteiro, e anotar o resultado no próprio PR. | contínuo |
| R4 | **Ensaio com a turma (27/11)**: conduzir o teste, anotar erros e abrir um card no Trello para cada um. | 27/11 |

## Como trabalhar (passo a passo)

1. **Primeiro** o PR #4 (`joao/backend`) entra na `main`. Ele traz a área `src/auth/` já registrada.
2. O Gustavo cria a branch dele **a partir da `main` atualizada**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b gustavo/auth
   ```
3. Um PR pequeno por tarefa (ex.: só G1+G2). Antes de abrir o PR, traga a `main` de novo:
   ```bash
   git pull origin main
   npm test
   ```
4. **Revisão:** Matheus ou Kelly revisa e testa na prévia da Vercel; o outro desenvolvedor (João ↔ Gustavo) dá uma olhada técnica.
5. Ninguém faz commit direto na `main`.

## Combinados de segurança

- Chaves só no `.env` (local) e nas variáveis da Vercel. Nunca no código, no front ou no chat.
- A API **nunca** usa a `service_role`: as regras de segurança do banco (RLS) precisam valer.
- Nada de dados pessoais além do mínimo (LGPD). Não registrar e-mail, token ou senha em `console.log`.
- Testes e dados de mentira só no banco **dev** (ver `supabase/AMBIENTES.md`).
