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

Responde **somente com base em fontes oficiais** (RN02 e RN04), em duas etapas:

1. **Busca de evidências:** identifica deputados citados pelo nome parlamentar completo e
   transforma o perfil em fatos numerados, cada um com fonte e data.
2. **Síntese com o Claude (IA):** o Claude recebe **só** essas evidências e escreve uma resposta
   curta e neutra, citando cada fato como `[1]`, `[2]`... O número aponta para `evidencias[n-1]`.

**Travas anti-alucinação** — o backend descarta a resposta do Claude e mostra só a lista
de fatos (`modo: "somente_fontes"`) quando:
- a resposta não tem citação ou cita uma evidência que não existe;
- o Claude diz que as evidências não bastam;
- a API do Claude recusa, falha ou a chave não está configurada.

Se a pergunta não cita nenhum deputado, o Claude **nem é chamado**: a resposta é
"não encontrei evidência".

```json
{
  "pergunta": "Qual o partido de Tabata Amaral?",
  "tipo": "fontes_encontradas",
  "modo": "ia_com_fontes",
  "resposta": "Tabata Amaral é deputada federal pelo PSB de São Paulo [1].",
  "evidencias": [{ "texto": "...", "fonte": "Dados Abertos da Câmara dos Deputados", "url": "https://...", "consultadoEm": "..." }],
  "fontes": [{ "nome": "...", "url": "https://...", "consultadoEm": "..." }],
  "aviso": "O FatoBot pode errar. Confira sempre as fontes oficiais. Não encontrar evidência não significa que a informação é falsa."
}
```

- `tipo`: `fontes_encontradas` ou `sem_evidencia`.
- `modo`: `ia_com_fontes` (resposta do Claude) ou `somente_fontes` (lista de fatos, sem IA).
- O front deve **sempre** mostrar o `aviso` e os links de `fontes`, e pode transformar `[n]`
  em link para `evidencias[n-1].url`.

#### Configurar o Claude

1. Crie uma chave em https://console.anthropic.com (menu *API Keys*). A API é paga por uso:
   coloque um limite de gastos no console.
2. Coloque a chave em `ANTHROPIC_API_KEY` no `.env` (local) e nas *Environment Variables* da Vercel.
   **Nunca** no código nem no Angular.
3. O modelo padrão é `claude-opus-5-5`. Para trocar, defina `CLAUDE_MODEL`
   (ex.: `claude-haiku-5-5`, bem mais barato).

Código: `src/services/claude.js` (chamada ao Claude) e `src/services/fatobot.js` (pipeline).
