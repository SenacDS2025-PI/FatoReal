# Backend (Node + Express)

Responsáveis: João Vítor e Gustavo.

API do FATO REAL e do FatoBot. É aqui que ficam as chaves secretas (Supabase `service_role`, IA),
sempre em variáveis de ambiente — **nunca** no código nem no Angular.

> **Divisão do backend** (João: FatoBot e fontes · Gustavo: autenticação · Matheus e Kelly: revisão e testes),
> com quem mexe em qual arquivo, sem conflito: [`DIVISAO.md`](DIVISAO.md).
> Autenticação, conta e admin ficam em [`src/auth/`](src/auth/README.md).

> **Roteiro da apresentação** (véspera, teste com a turma e entrega) e o comando `npm run conferir`: [`APRESENTACAO.md`](APRESENTACAO.md).

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
├── api/index.js          → entrada da Vercel (serverless)
├── scripts/
│   ├── atualizar-deputados.js → npm run atualizar-deputados (cópia de reserva)
│   ├── importar-deputados.js  → npm run importar (Câmara e Senado → Supabase)
│   └── importar-tse.js        → npm run importar-tse (eleitos do TSE → Supabase)
├── src/
│   ├── app.js            → configura o Express (CORS, JSON, rotas, erros)
│   ├── server.js         → sobe o servidor localmente
│   ├── data/
│   │   └── deputados.json  → cópia de reserva dos 513 deputados, com data da coleta
│   ├── routes/           → health, deputados, fatobot, verificar, cep, whatsapp
│   ├── services/
│   │   ├── camara.js       → Câmara + Supabase + cópia de reserva, com limites de tempo
│   │   ├── fatobot.js      → pipeline do FatoBot (evidências → Gemini → resposta)
│   │   ├── gemini.js       → chamadas ao Gemini, travas de citação e gerarJson
│   │   ├── verificar.js    → os 5 estados de verificação
│   │   ├── supabase.js     → leitura da tabela politicos
│   │   └── cep.js          → ViaCEP
│   └── utils/            → cache, prazo e normalização de texto
├── test/                 → testes (npm test); j1…j8-*.test.js cobrem cada item do pedido
├── .env.example          → modelo das variáveis de ambiente
└── vercel.json
```

## Deploy na Vercel

1. Na Vercel, importe o repositório e defina **Root Directory = `backend`**.
2. Cadastre as variáveis do `.env.example` em *Settings > Environment Variables*.
3. Depois do deploy, teste `https://SEU-PROJETO.vercel.app/api/health`.

## Rotas

Toda resposta com dados de político traz o bloco `fonte` (nome, URL oficial e data/hora da consulta).

### `GET /api/health` e `GET /api/health/fontes`

- `/api/health`: rápido, só diz que a API está no ar.
- `/api/health/fontes` (J12): **check-up para abrir antes da apresentação**. Mostra se cada fonte
  está funcionando, **sem nunca mostrar chaves**:

| Campo | O que diz |
|---|---|
| `status` | `ok` (tudo certo), `parcial` (algo fora, mas o FatoBot ainda responde) ou `fora` (nenhuma fonte de deputados → HTTP `503`) |
| `fontes.camara` | `ok` / `fora`, com o tempo de resposta |
| `fontes.supabase` | `ok` / `vazio` / `fora` / `nao_configurado`, o total de deputados no banco e o **começo do endereço do projeto** (ex.: `mamsbc…`), para saber se é o banco de dev ou de produção |
| `fontes.copiaReserva` | `ok` / `antiga` (mais de 7 dias) / `ausente`, com a data da coleta |
| `fontes.gemini` | `configurado` / `sem_chave`, o modelo, o reserva e quanto da cota local já foi usado |

Com `?ia=1`, também faz uma chamada mínima ao Gemini (gasta 1 da cota) e mostra `ok` ou o motivo da falha.
O resultado fica em cache por 30s.

**Checklist do dia:** abra `https://fato-real.vercel.app/api/health/fontes?ia=1` e confira se o
`status` é `ok`, se o projeto do Supabase é o de **produção** e se a cópia de reserva não está `antiga`.

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

Erros: `400` ID inválido · `404` deputado não encontrado · `503` Câmara fora do ar e sem cópia
(`{ "erro": "A fonte oficial (Câmara) está fora do ar agora." }`).

### Sobre a API da Câmara (e o dia da apresentação)

Ela é instável: às vezes demora mais de 15s ou responde 504. Para o FatoBot funcionar mesmo
assim:

- **Ordem das fontes.** Lista: Supabase → Câmara → **cópia de reserva**. Perfil: Câmara →
  Supabase → cópia de reserva (só nome, partido e UF).
- **Cópia de reserva** (`src/data/deputados.json`): a lista dos 513 deputados com a data da
  coleta. Quando ela é usada, a fonte diz *"(cópia de reserva de DD/MM/AAAA)"*.
  **Atualize antes da apresentação** e faça commit do arquivo:

  ```bash
  npm run atualizar-deputados
  ```

- **Tempo máximo (~25s no pior caso).** Câmara: 4s por chamada, uma tentativa só, com as 6
  páginas da lista pedidas ao mesmo tempo. Supabase: 3s. A pergunta inteira tem prazo de
  24s, e o Gemini usa só o que sobrar (no máximo 8s por modelo). Os limites ficam em
  `LIMITES` (`camara.js`), `LIMITES_IA` (`gemini.js`) e `LIMITES_FATOBOT` (`fatobot.js`).
- Se a lista da Câmara falhar, por 1 minuto a API vai direto para a cópia, sem esperar de novo.
- Cache em memória: lista 6h, perfil 1h. Se renovar falhar, usa a última resposta boa.
- Se a Câmara cair **e** não houver cópia: `503` com
  `{ "erro": "A fonte oficial (Câmara) está fora do ar agora." }`.

### Cópia no Supabase (tabela `politicos`)

Para não depender da Câmara na hora H, os deputados ficam salvos no Supabase:

- **Busca (`/api/deputados`)**: lê do Supabase primeiro; se estiver vazio ou fora, usa a Câmara.
- **Perfil (`/api/deputados/:id`)**: tenta a Câmara primeiro (tem mais detalhes); se ela cair,
  usa a cópia do Supabase.
- Quando a resposta vem da cópia, a `fonte` diz *"(cópia salva no Fato Real)"* e `consultadoEm`
  é a data da coleta, para o usuário saber de quando é a informação.

A API usa só `SUPABASE_URL` e `SUPABASE_ANON_KEY` (leitura pública, protegida pelo RLS).
Sem essas variáveis, tudo continua funcionando direto pela Câmara.

#### Importar os deputados

1. A tabela precisa existir: rode o `supabase/schema.sql` no SQL Editor do Supabase.
2. No `backend/.env`, preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
   (*Project Settings > API*).
3. Rode:

```bash
npm run importar -- 20   # teste rápido com 20 deputados (+ senadores)
npm run importar         # deputados (~513) e senadores (~81) em exercício
```

Pode rodar de novo quando quiser: atualiza os dados e a data da coleta. O CPF não é salvo (LGPD).

#### Importar os outros cargos (TSE): presidente, governadores, deputados estaduais, prefeitos e vereadores

Fonte: arquivos oficiais "Candidatos" do Portal de Dados Abertos do TSE. Entram só os **eleitos**
(eleição de 2022 para presidente, governador e deputado estadual; 2024 para prefeito e vereador).
O FatoBot diz "foi eleito(a) em ...", porque o TSE não mostra quem está no cargo hoje.

1. Uma vez por banco (dev e prod): rode `supabase/politicos-todos-os-cargos.sql` no SQL Editor.
2. Baixe no navegador e extraia (botão direito → *Extrair tudo*):
   - https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip
   - https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip
3. Rode, com o caminho das pastas extraídas:

```bash
npm run importar-tse -- C:\Users\voce\Downloads\consulta_cand_2022 C:\Users\voce\Downloads\consulta_cand_2024
```

São ~65 mil eleitos (só vereadores são ~58 mil). Não salva CPF, título, e-mail nem data de nascimento.

### `GET /api/fontes` (catálogo de fontes oficiais)

Lista as fontes oficiais do Fato Real (`src/data/fontes-oficiais.js`):

- `tipo: "integrada"`: o FatoBot e o Fato ou Fake leem os dados e citam como evidência
  (Câmara, Senado, TSE e Constituição).
- `tipo: "consulta"`: só indicamos o link quando não há evidência (Portal da Transparência, TCU,
  STF, CNJ, Diário Oficial, IBGE, Banco Central, Fato ou Boato do TSE, agências públicas...).
  Aparecem no campo `onde_conferir` das respostas sem evidência. **Nunca** viram evidência.

> ⚠️ A `service_role` ignora as regras de segurança do banco. Use **só** no seu computador,
> para importar. **Nunca** na Vercel, no Angular ou no GitHub.

### `POST /api/fatobot`

Corpo: `{ "pergunta": "Quem é Tabata Amaral?" }` (3 a 500 caracteres).

Responde **somente com base em fontes oficiais** (RN02 e RN04), em duas etapas:

1. **Busca de evidências** (a mesma do `/api/verificar`), em três fontes:
   - **deputados** citados pelo nome parlamentar completo → fatos do perfil, com fonte e data;
   - **total de deputados** em exercício, quando a pergunta é "quantos deputados...";
   - **Constituição Federal de 1988** (`src/data/base-conhecimento.js`, 24 fatos com o artigo):
     busca por palavras-chave, até 3 fatos por pergunta. Ex.: "O que são os Três Poderes?",
     "Como funciona uma PEC?", "Qual a idade mínima para ser senador?".

   Se a Câmara estiver fora e sem cópia, uma pergunta sobre a Constituição ainda é respondida;
   o `503` só acontece quando não há nenhuma evidência.

   **Para ensinar algo novo ao FatoBot**, acrescente um item em `src/data/base-conhecimento.js`
   (id, título, artigo, texto fiel à fonte e palavras-chave) e confira o texto no site do Planalto.
2. **Síntese com o Gemini (IA):** o Gemini recebe **só** essas evidências e escreve uma resposta
   curta e neutra, citando cada fato como `[1]`, `[2]`... O número aponta para `evidencias[n-1]`.

**Travas anti-alucinação** — o backend descarta a resposta do Gemini e mostra só a lista
de fatos (`modo: "somente_fontes"`) quando:
- a resposta não tem citação ou cita uma evidência que não existe;
- o Gemini diz que as evidências não bastam;
- a API do Gemini bloqueia, falha ou a chave não está configurada.

Se a pergunta não cita nenhum deputado, o Gemini **nem é chamado**: a resposta é
"não encontrei evidência".

```json
{
  "pergunta": "Qual o partido de Tabata Amaral?",
  "tipo": "fontes_encontradas",
  "modo": "ia_com_fontes",
  "resposta": "Tabata Amaral é deputada federal pelo PSB de São Paulo [1].",
  "evidencias": [{ "texto": "...", "fonte": "Dados Abertos da Câmara dos Deputados", "url": "https://...", "consultadoEm": "..." }],
  "fontes": [{ "titulo": "Dados Abertos da Câmara dos Deputados: Tabata Amaral", "url": "https://...", "data": "..." }],
  "consultado_em": "2026-11-10T12:43:09.986Z",
  "sem_evidencia": false,
  "aviso": "O FatoBot pode errar. Confira sempre as fontes oficiais. Não encontrar evidência não significa que a informação é falsa."
}
```

- `tipo`: `fontes_encontradas` ou `sem_evidencia`.
- `modo`:
  - `ia_com_fontes`: resposta do Gemini, com citação `[n]` em **toda** frase;
  - `ia_sem_evidencia`: o Gemini disse que as fontes não respondem. Nesse caso
    `sem_evidencia: true`, `resposta: "Não encontrei evidência para isso."`, `fontes: []` e os
    fatos do perfil vão separados em `contexto` (`{ aviso, fatos, fontes }`), só como contexto;
  - `somente_fontes`: sem IA. Mostra a lista de fatos, e `motivo_sem_ia` diz por quê:
    `sem_chave`, `cota_esgotada` (erro 429), `sobrecarregado`, `tempo_esgotado`, `recusado`,
    `bloqueado`, `citacao_invalida` ou `erro`. Para `cota_esgotada` a resposta começa com
    *"A IA atingiu o limite de uso gratuito por agora..."*.
- O front deve **sempre** mostrar o `aviso` e os links de `fontes`, e pode transformar `[n]`
  em link para `evidencias[n-1].url`.

### `POST /api/verificar`

Verifica uma afirmação e devolve um dos **5 estados** do Quadro 3 da documentação.
É a rota usada pela tela **Verificar informação** do front.

Aceita JSON `{ "afirmacao": "...", "link": "https://...", "anexos": [{ "nome", "tipo", "tamanho" }] }`.
**Recomendado (J13):** mandar só as *informações* dos anexos, e não os arquivos. Os anexos não são
analisados nem guardados, e a Vercel recusa pedidos acima de ~4,5 MB (uma foto de celular ou um vídeo já passa disso).
O formato antigo (formulário multipart com os arquivos) continua aceito; se os arquivos passarem
do limite, o texto é verificado mesmo assim e a resposta avisa.

```json
{
  "estado": "Evidências sustentam",
  "explicacao": "Tabata Amaral é deputada federal pelo PSB de São Paulo [1].",
  "fontes": [{ "titulo": "Dados Abertos da Câmara dos Deputados: Tabata Amaral", "url": "https://...", "data": "..." }],
  "consultado_em": "2026-11-13T12:00:00.000Z",
  "aviso": "O FatoBot pode errar. ..."
}
```

| Estado | Quando |
|---|---|
| Evidências sustentam | O Gemini confirma **citando** as evidências oficiais |
| Evidências contradizem | O Gemini nega **citando** as evidências oficiais |
| Fora de contexto | Há base verdadeira, mas data, local, autoria ou sentido foram alterados (com citação) |
| Evidência insuficiente | Nenhum deputado citado, ou a IA não citou fonte válida. Ausência de evidência ≠ falsidade |
| Em análise | A IA está indisponível: mostra os fatos encontrados, sem confirmar nem negar |

**Proteção contra truques no texto do usuário** (FatoBot e Verificar):
- `<` e `>` são removidos da pergunta/afirmação antes de ir para o Gemini, então ninguém
  consegue fechar a tag `</pergunta>` e fingir que o resto é uma evidência ou uma regra nova.
- Toda frase da resposta precisa citar uma evidência que existe. Uma frase sem citação
  (por exemplo, uma opinião sobre em quem votar) faz a resposta inteira ser descartada.

Regras que **não dependem da IA**:
- Sem citação válida, o sistema **nunca** confirma nem nega: vira "Evidência insuficiente".
- O **link** enviado não é acessado nem usado como fonte.
- Os **anexos** não são analisados nem guardados, e o aviso diz isso com clareza (sem prometer revisão
  humana, que não existe no MVP). Anexo grande ou em excesso **nunca** impede a verificação do texto.

### `GET /api/camara/<caminho>` (repasse para a Câmara)

Às vezes a API da Câmara responde **sem o cabeçalho de CORS** em `/deputados/{id}` e
`/deputados/{id}/historico`, e o navegador bloqueia a resposta. Quando o acesso direto falha,
o front busca pela nossa API, que repassa o pedido:

`GET /api/camara/deputados/221328?itens=5` → `https://dadosabertos.camara.leg.br/api/v2/deputados/221328?itens=5`,
devolvendo **o mesmo corpo JSON e o mesmo status** da Câmara.

- Só `GET`, só caminhos que começam com `deputados`, `proposicoes`, `votacoes` ou `eventos`, com
  pedaços de letras, números e hífen (os ids de votação têm hífen). Outro caminho → `400`.
- A query string vai como veio. Respostas 200 ficam 10 min no cache (`Cache-Control: public, max-age=600`).
- Câmara fora do ar, lenta (mais de 8 s) ou respondendo HTML → `502`.
- Limite por IP **próprio** (120/min, `LIMITE_CAMARA_POR_IP_MIN`), separado do FatoBot.

### `POST /api/traduzir`

"Tradutor de juridiquês": explica a ementa de um projeto de lei em linguagem simples. É chamado pelo
botão **Explicar** dos projetos no front (`frontend/src/app/core/tradutor.ts`).

Corpo: `{ "texto": "<ementa>" }` (10 a 2000 caracteres) → `{ "explicacao", "fonte", "aviso" }`.

A única fonte é o próprio texto. Travas que **não dependem da IA** (se alguma falhar, responde `503`
e o front usa as regras locais dele, que trocam palavras difíceis por simples):
- todo número da explicação precisa existir no texto original (ex.: `8.069/1990` passa se a ementa
  cita "Lei nº 8.069, de ... de 1990"; uma multa de "500 reais" que não está no texto, não);
- nada de opinião ou recomendação que não esteja no texto ("deveria", "ótimo", "vote"...);
- curta (até 600 caracteres) e nunca muito maior que o original;
- `<` e `>` são tirados do texto, e a mesma ementa fica em cache por 24h (não gasta cota de novo).

### `GET /api/cep/:cep`

Endereço automático pelo CEP (RF07), usando o **ViaCEP** (gratuito, sem chave), e os
**deputados federais do estado** (regionalização). Aceita `01310100`, `01310-100` ou `01.310-100`.

```json
{
  "endereco": { "cep": "70040-010", "logradouro": "SBN Quadra 1", "complemento": null, "bairro": "Asa Norte",
                "cidade": "Brasília", "uf": "DF", "estado": "Distrito Federal",
                "fonte": { "nome": "ViaCEP", "url": "https://viacep.com.br/ws/70040010/json/", "consultadoEm": "..." } },
  "deputados": { "uf": "DF", "total": 8, "dados": [{ "id": 0, "nome": "...", "partido": "...", "uf": "DF", "foto": "..." }], "fonte": {} }
}
```

- `?politicos=0` → só o endereço (bom para preencher formulário de cadastro).
- Se a Câmara falhar, o endereço volta mesmo assim, com `"deputados": null`.
- Erros: `400` CEP inválido · `404` CEP não encontrado · `502` ViaCEP não respondeu.

### `POST /api/whatsapp`

Formulário do **botão de WhatsApp** (RF15). Corpo: `{ "nome", "motivo", "link"?, "mensagem"? }`.
Devolve `{ "url": "https://wa.me/55...?text=..." }`: o front só abre essa URL (`window.open(url)`).

- `GET /api/whatsapp/motivos` → lista de motivos para o `<select>`.
- O número fica em `WHATSAPP_NUMERO` (no `.env` e na Vercel), com código do país e DDD.
  Sem ele, a rota responde `503`.
- **Nada é guardado** (LGPD): os dados só vão na mensagem que a própria pessoa envia.

### Limites de uso (J10)

Duas camadas, para proteger a cota grátis do Gemini **sem bloquear uma sala de aula**
(numa rede como a do Senac, todos os alunos saem pelo mesmo IP):

| Camada | Padrão | Ao passar do limite | Variável |
|---|---|---|---|
| Por IP, contra abuso (`/api/fatobot` e `/api/verificar`) | 60 pedidos/min | `429` *"Muitas perguntas em pouco tempo..."* com `Retry-After` | `LIMITE_POR_IP_MIN` |
| Cota da IA, para o servidor todo | 14 chamadas/min e 450/dia (abaixo dos 15/min e 500/dia do plano grátis) | **Não recusa**: responde só com as fontes, `motivo_sem_ia: "limite_local"` | `LIMITE_IA_POR_MIN`, `LIMITE_IA_POR_DIA` |

Os contadores ficam em memória (na Vercel, cada instância conta separado). Baseado no limitador por IP
do Matheus (`backup/matheus-2026-11-17`).

### Para outras rotas usarem o Gemini: `gerarJson`

```js
import { gerarJson, limparTextoUsuario } from '../services/gemini.js';

const r = await gerarJson({
  instrucoes: 'Regras para o modelo...',
  mensagem: `<texto>${limparTextoUsuario(textoDoUsuario)}</texto>`,
  schema: { type: 'object', properties: { campo: { type: 'string' } }, required: ['campo'] },
});
if (!r) { /* IA indisponível: siga sem ela */ }
```

Devolve o objeto ou `null` (sem chave, erro, bloqueio ou JSON inválido). Usa o mesmo modelo,
modelo reserva, limite de tempo e logs do FatoBot.

#### Configurar o Gemini

1. Entre em https://aistudio.google.com/apikey com uma conta Google e clique em **Create API key**.
2. Coloque a chave em `GEMINI_API_KEY` no `.env` (local) e nas *Environment Variables* da Vercel.
   **Nunca** no código nem no Angular.
3. O modelo padrão é `gemini-3.5-flash-lite`. No plano gratuito ele permite mais pedidos (segundo a
   tabela usada pelo grupo: 15/min e 500/dia, contra só 20/dia do 3.8 Flash; confira os limites
   atuais no AI Studio). Para trocar, defina `GEMINI_MODEL`.
4. **Erro 503 (sobrecarregado)** é comum no plano gratuito. Defina `GEMINI_MODEL_RESERVA` com um
   modelo de outra geração (recomendado: `gemini-2.5-flash-lite`): quando o principal der 503 ou 429, a API tenta o reserva.

Para ver os nomes dos modelos que a sua chave pode usar (PowerShell, na pasta `backend`;
a chave é lida do `.env` e não aparece na tela):

```powershell
$k = (Select-String -Path .env -Pattern '^GEMINI_API_KEY=(.+)').Matches[0].Groups[1].Value
(Invoke-RestMethod -Headers @{ 'x-goog-api-key' = $k } "https://generativelanguage.googleapis.com/v1beta/models").models |
  Where-Object { $_.supportedGenerationMethods -contains 'generateContent' } | Select-Object name
```

Use o nome **sem** o prefixo `models/` (ex.: `models/abc-flash` → `GEMINI_MODEL_RESERVA=abc-flash`).

Código: `src/services/gemini.js` (chamada ao Gemini) e `src/services/fatobot.js` (pipeline).
