# Backend (Node + Express)

Responsáveis: João Vítor e Gustavo.

API do FATO REAL e do FatoBot. É aqui que ficam as chaves secretas (Supabase `service_role`, IA),
sempre em variáveis de ambiente — **nunca** no código nem no Angular.

## Como rodar

Precisa do Node 20 ou mais novo.

```bash
cd backend
npm install
cp .env.example .env   # depois preencha o .env
npm run dev
```

Abra http://localhost:3000/api/health — deve aparecer `{"status":"ok", ...}`.

## Testes

```bash
npm test
```

## Estrutura

```
backend/
├── api/index.js        → entrada da Vercel (serverless)
├── src/
│   ├── app.js          → configura o Express (CORS, JSON, rotas)
│   ├── server.js       → sobe o servidor localmente
│   └── routes/
│       └── health.js   → GET /api/health
├── test/               → testes (node --test)
├── .env.example        → modelo das variáveis de ambiente
└── vercel.json
```

## Deploy na Vercel

1. Na Vercel, importe o repositório e defina **Root Directory = `backend`**.
2. Cadastre as variáveis do `.env.example` em *Settings > Environment Variables*.
3. Depois do deploy, teste `https://SEU-PROJETO.vercel.app/api/health`.

## Próximas rotas (MVP)

- `GET /api/deputados?busca=` — busca por nome (dados da Câmara salvos no Supabase)
- `GET /api/deputados/:id` — perfil com fonte e data de cada informação
- `POST /api/fatobot` — pergunta ao FatoBot; responde com referências ou "não encontrei evidência"
