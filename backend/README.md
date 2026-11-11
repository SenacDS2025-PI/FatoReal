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
│   ├── routes/
│   │   ├── health.js     → GET /api/health
│   │   ├── deputados.js  → busca e perfil de deputados
│   │   ├── fatobot.js    → POST /api/fatobot
│   │   └── verificar.js  → POST /api/verificar
│   ├── services/
│   │   ├── camara.js     → acesso à API de Dados Abertos da Câmara
│   │   ├── evidencias.js → busca documental e filtro de evidência (usado pelo FatoBot e pela verificação)
│   │   ├── fatobot.js    → FatoBot: instruções da IA e montagem da resposta
│   │   ├── verificar.js  → verificação assistida de afirmações
│   │   └── gemini.js     → conexão com o Gemini (Google)
│   ├── data/
│   │   └── base-conhecimento.js → fatos da Constituição que o FatoBot pode citar
│   └── utils/            → cache em memória, normalização de texto e limite de pedidos por IP
├── test/               → testes (node --test)
├── .env.example        → modelo das variáveis de ambiente
└── vercel.json
```

## Deploy na Vercel

1. Na Vercel, importe o repositório e defina **Root Directory = `backend`**.
2. Cadastre as variáveis do `.env.example` em *Settings > Environment Variables*.
3. Depois do deploy, teste `https://SEU-PROJETO.vercel.app/api/health`.

## Rotas

Toda resposta com dados de político traz o bloco `fonte` (nome, URL oficial e data/hora da consulta).

### `GET /api/deputados`

Lista os deputados em exercício. Filtros opcionais (podem ser combinados):

| Parâmetro | Exemplo       | O que faz                                              |
|-----------|---------------|--------------------------------------------------------|
| `busca`   | `?busca=tab`  | Pedaço do nome; ignora acentos e maiúsculas (busca em tempo real) |
| `uf`      | `?uf=SP`      | Estado                                                 |
| `partido` | `?partido=PSB`| Sigla do partido                                       |

```json
{
  "total": 1,
  "dados": [{ "id": 204534, "nome": "Tabata Amaral", "partido": "PSB", "uf": "SP", "foto": "https://..." }],
  "fonte": { "nome": "Dados Abertos da Câmara dos Deputados", "url": "https://dadosabertos.camara.leg.br/api/v2/deputados", "consultadoEm": "2026-11-10T00:05:23.999Z" }
}
```

### `GET /api/deputados/:id`

Perfil do deputado: nome, partido, UF, foto, situação, data do status, escolaridade, gabinete,
redes sociais e `fonte`. **O CPF que a Câmara devolve é removido de propósito (LGPD).**

Erros: `400` ID inválido · `404` deputado não encontrado · `502` a Câmara não respondeu.

### Sobre a API da Câmara

Ela é instável (às vezes demora mais de 15s ou responde 504). Por isso o backend tem:
limite de 10s por chamada, uma nova tentativa automática e cache em memória
(lista: 6h, perfil: 1h). Se a Câmara cair, a API devolve a última resposta boa que tinha
(com a data original da consulta). O próximo passo é salvar esses dados no Supabase para não depender
da Câmara a cada acesso.

### `POST /api/fatobot`

Corpo: `{ "pergunta": "Quem é Tabata Amaral?" }` (3 a 500 caracteres).

Responde **somente com base em fontes oficiais** (RN02 e RN04). As evidências vêm de dois lugares:

- **Câmara (ao vivo):** deputados citados pelo nome parlamentar completo e o total de deputados em exercício.
- **Base de conhecimento** (`src/data/base-conhecimento.js`): fatos da Constituição de 1988 sobre
  como a política funciona (Poderes, Congresso, PEC, veto, eleições...), cada um com o artigo.

Com a IA ligada, o **Gemini** escreve a resposta em linguagem simples usando só essas evidências e diz
quais usou (pelo código, ex.: `B08`, `D1`). O backend monta os links a partir desses códigos, então a
IA não tem como inventar fontes. Se nada responder à pergunta, a resposta diz que **não encontrou evidência**.

Sem a chave (ou se a IA falhar), o FatoBot continua funcionando no **modo somente fontes**: lista os
fatos encontrados por palavras-chave.

```json
{
  "resposta": "Cada estado e o Distrito Federal elegem três senadores, com mandato de oito anos.",
  "fontes": [{ "titulo": "Constituição Federal de 1988, art. 46", "url": "https://www.planalto.gov.br/...", "data": null }],
  "consultado_em": "2026-11-10T12:43:09.986Z",
  "sem_evidencia": false,
  "pergunta": "Quantos senadores tem cada estado?",
  "tipo": "fontes_encontradas",
  "modo": "ia_com_fontes",
  "evidencias": [{ "id": "B09", "texto": "...", "fonte": "Constituição Federal de 1988", "url": "https://...", "consultadoEm": null, "titulo": "..." }],
  "aviso": "O FatoBot pode errar. Confira sempre as fontes oficiais. Não encontrar evidência não significa que a informação é falsa."
}
```

- `resposta`, `fontes`, `consultado_em` e `sem_evidencia` são o que o front usa (`RespostaFatoBot` em `frontend/src/app/core/modelos.ts`).
- `fontes[].data`: data da consulta (Câmara) ou `null` (Constituição, que não muda).
- `modo`: `ia_com_fontes` (Gemini) ou `somente_fontes` (sem IA).
- O front deve **sempre** mostrar o aviso e os links de `fontes`.

### `POST /api/verificar`

Corpo: `{ "afirmacao": "Cada estado elege três senadores." }` (10 a 1000 caracteres).

Avaliação **preliminar** de uma afirmação, comparando só com as mesmas evidências do FatoBot:

```json
{ "estado": "Evidências sustentam", "explicacao": "...", "fontes": [{ "titulo": "...", "url": "...", "data": null }], "consultado_em": "..." }
```

`estado`: `Evidências sustentam`, `Evidências contradizem`, `Fora de contexto`, `Evidência insuficiente`
ou `Em análise` (quando a IA está desligada e há fontes para o usuário comparar sozinho).
Se a IA disser que sustenta ou contradiz sem citar nenhuma fonte válida, o backend troca para `Evidência insuficiente`.

### Limite de uso

`/api/fatobot` e `/api/verificar` aceitam até 30 pedidos a cada 10 minutos por IP (ajuste com
`LIMITE_IA_POR_IP`). Acima disso respondem `429`. Isso evita que alguém gaste os créditos da IA à toa.

## Ligar a IA (Gemini)

1. Entre em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) com uma conta Google e gere uma **API key**.
2. Coloque a chave em `GEMINI_API_KEY` no `.env` (local) e nas *Environment Variables* da Vercel.
   **Nunca** coloque a chave no código, no Angular ou no GitHub.
3. Reinicie o servidor. A resposta do FatoBot passa a vir com `"modo": "ia_com_fontes"`.

Opcionais no `.env`:

| Variável           | Padrão             | Para quê |
|--------------------|--------------------|----------|
| `GEMINI_MODEL`     | `gemini-3.8-flash` | Modelo do Gemini. Se a API responder 400/404, confira o nome do modelo em [ai.google.dev](https://ai.google.dev/gemini-api/docs/models). |
| `LIMITE_IA_POR_IP` | `30`               | Pedidos por IP a cada 10 minutos. |

Como funciona a chamada (`src/services/gemini.js`):

- A resposta vem em **JSON com formato fixo** (`responseJsonSchema`): o texto, os códigos das evidências usadas e se faltou evidência.
- Limite de **20 segundos** e **uma nova tentativa** quando o Gemini está sobrecarregado (429/500/503).
- Se o Gemini bloquear a pergunta, cortar a resposta, mandar JSON inválido ou falhar, o FatoBot
  responde no modo somente fontes. O usuário nunca fica sem resposta.

Para ensinar algo novo ao FatoBot, acrescente um item em `src/data/base-conhecimento.js`
(com o artigo da fonte) e rode `npm test`.
