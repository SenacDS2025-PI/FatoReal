# Fato Real: front-end (Angular)

Rede social de informação cívica: busca de políticos com fontes oficiais, FatoBot (IA com referências) e comunidades no estilo Orkut, com mural, comentários, curtidas e denúncias.

**Tecnologias:** Angular 22 + Supabase (login e banco) + API em Node (FatoBot), com hospedagem na Vercel.

## Rodar no seu computador

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
cd frontend
```

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:4200.

> Sem configurar nada, o site abre em **modo demonstração**: login, comunidades, mural e denúncias funcionam com dados salvos só no seu navegador, e a busca de políticos consulta direto a API da Câmara. Serve para desenvolver as telas antes do Supabase ficar pronto.

## Ligar o Supabase

1. Copie `.env.exemplo` para `.env` (o `.env` não vai para o Git).
2. Preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
3. Rode o [`supabase/schema.sql`](../supabase/schema.sql) no SQL Editor do Supabase.
4. Rode `npm start` de novo. A faixa amarela de "modo demonstração" some.

As variáveis viram o arquivo `src/environments/environment.ts` pelo script `scripts/gerar-env.mjs`, que roda sozinho antes do `start` e do `build`. Nunca coloque a chave `service_role` nem a chave da IA no front.

## Deploy na Vercel

1. Importe o repositório na Vercel e, em **Root Directory**, escolha `frontend`.
2. Em **Settings → Environment Variables**, cadastre `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `API_URL` (`/api` se a API em Node ficar no mesmo projeto).
3. O `vercel.json` já define o build e manda todas as rotas para o Angular (menos `/api`).
4. No Supabase, em **Authentication → URL Configuration**, coloque o link da Vercel em *Site URL* e em *Redirect URLs* (precisa disso para a confirmação de e-mail e a recuperação de senha).

## Telas

| Rota | Tela |
|---|---|
| `/` | Início: busca, atalhos, princípios e política de fontes, comunidades em destaque |
| `/politicos` | Busca por nome, partido e UF (filtra enquanto digita) |
| `/politicos/:id` | Perfil público: cada dado com fonte e data, "não disponível" quando falta |
| `/fatobot` | Assistente de IA: fontes, data de consulta, aviso de que a IA pode errar |
| `/comunidades` | Lista e busca de comunidades |
| `/comunidades/nova` | Criar comunidade com tema e regras (exige login) |
| `/comunidades/:slug` | Página do grupo: mural, comentários, curtidas, denúncia, regras, membros |
| `/entrar` · `/cadastrar` | Login e cadastro (Supabase Auth, coleta mínima de dados) |
| `/recuperar-senha` · `/nova-senha` | Recuperação de senha por e-mail |
| `/perfil` | Meu perfil: editar nome/foto, minhas comunidades, excluir conta (LGPD) |
| `/noticias` | Canais oficiais de notícias dos Poderes, por categoria |
| `/base-da-politica` | Área educativa: básico da política, instituições e glossário |
| `/verificar` | Verificar uma afirmação (5 estados: sustentam, contradizem, fora de contexto, insuficiente, em análise) |
| `/mensagens` | Mensagens privadas entre participantes das mesmas comunidades |
| `/notificacoes` | Curtidas e comentários nas suas publicações e mensagens novas |
| `/configuracoes` | Tema claro/escuro, conta e privacidade |
| `/moderacao` | Painel de denúncias: o moderador remove ou mantém e registra o motivo |
| `/sobre` · `/regras` · `/termos` · `/privacidade` · `/contato` | Textos institucionais e LGPD |

## Onde mexer

```
src/
├── styles.scss                 → cores (paleta da apresentação), modo escuro, layout e responsivo
├── index.html                  → tela de carregamento e fontes
└── app/
    ├── app.html / app.ts       → casca: menu lateral, barra superior, navegação inferior no celular
    ├── app.routes.ts           → todas as rotas
    ├── core/                   → serviços (dados) — cada um funciona com Supabase OU em modo demo
    │   ├── auth.service.ts         login, cadastro, perfil
    │   ├── politicos.service.ts    busca/perfil (tabela "politicos" ou API da Câmara)
    │   ├── comunidades.service.ts  comunidades, mural, comentários, curtidas, denúncias
    │   ├── fatobot.service.ts      chama POST {API_URL}/fatobot (contrato no topo do arquivo)
    │   └── modelos.ts              tipos dos dados
    ├── shared/componentes.ts   → ícone, avatar, fonte do dado, selo "verificado", avisos
    └── pages/                  → uma pasta por área (inicio, politicos, fatobot, comunidades, conta, moderacao, institucional)
```

Ícones: [Material Symbols](https://fonts.google.com/icons). Use `<app-icone nome="search" />`.

## Contrato com a API (equipe de back)

Verificação de afirmação:

```
POST /api/verificar
{ "afirmacao": "A Câmara tem 513 deputados." }

200 → { "estado": "Evidências sustentam", "explicacao": "texto", "fontes": [...], "consultado_em": "..." }
```

`estado` é um destes: `Evidências sustentam`, `Evidências contradizem`, `Fora de contexto`, `Evidência insuficiente`, `Em análise`.

### FatoBot

```
POST /api/fatobot
{ "pergunta": "Qual é a função de um deputado?" }

200 →
{
  "resposta": "texto",
  "fontes": [{ "titulo": "Câmara dos Deputados", "url": "https://...", "data": "2026-11-05T12:00:00Z" }],
  "consultado_em": "2026-11-05T12:00:00Z",
  "sem_evidencia": false
}
```
