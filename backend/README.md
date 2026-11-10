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
│   │   └── deputados.js  → busca e perfil de deputados
│   ├── services/
│   │   └── camara.js     → acesso à API de Dados Abertos da Câmara
│   └── utils/            → cache em memória e normalização de texto
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

Responde **somente com base em fontes oficiais** (RN02 e RN04). Hoje identifica deputados
citados pelo nome parlamentar completo e devolve os fatos do perfil, cada um com fonte e data.
Se não achar nada, responde que **não encontrou evidência**, sem inventar.

```json
{
  "pergunta": "Quem é Tabata Amaral?",
  "tipo": "fontes_encontradas",
  "modo": "somente_fontes",
  "resposta": "Encontrei estas informações nas fontes oficiais:\n• Tabata Amaral é deputado(a) federal pelo PSB-SP.\n• ...",
  "evidencias": [{ "texto": "...", "fonte": "Dados Abertos da Câmara dos Deputados", "url": "https://...", "consultadoEm": "..." }],
  "fontes": [{ "nome": "...", "url": "https://...", "consultadoEm": "..." }],
  "aviso": "O FatoBot pode errar. Confira sempre as fontes oficiais. Não encontrar evidência não significa que a informação é falsa."
}
```

- `tipo`: `fontes_encontradas` ou `sem_evidencia`.
- `modo`: `somente_fontes` (sem IA, hoje) ou `ia_com_fontes` (quando a IA for ligada).
- O front deve **sempre** mostrar o `aviso` e os links de `fontes`.

**Pendente (decisão do grupo):** qual IA usar para a etapa de síntese. Ela vai entrar em
`sintetizarComIA` (`src/services/fatobot.js`) recebendo **apenas** as evidências encontradas,
e a chave fica só no `.env` do servidor.
