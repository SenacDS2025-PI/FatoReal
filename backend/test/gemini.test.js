// Testes do FatoBot e da verificação COM IA, usando um Gemini falso (não gasta cota).
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _setClient, MODELO_PADRAO } from '../src/services/gemini.js';

const LISTA = {
  dados: [
    { id: 1, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f1' },
    { id: 2, nome: 'Maria Exemplo', siglaPartido: 'BBB', siglaUf: 'RJ', urlFoto: 'f2' },
  ],
  links: [],
};
const PERFIL = {
  dados: {
    id: 1,
    nomeCivil: 'TABATA TESTE',
    cpf: '00000000000',
    redeSocial: [],
    ultimoStatus: { nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', situacao: 'Exercício' },
  },
};

let originalFetch;
let server;
let base;
let chamadas; // parâmetros que o backend mandou para o Gemini falso
let saida; // o que o Gemini falso responde

const respostaJson = (obj) => ({ text: JSON.stringify(obj), candidates: [{ finishReason: 'STOP' }] });

function geminiFalso() {
  return {
    models: {
      generateContent: async (params) => {
        chamadas.push(params);
        if (saida instanceof Error) throw saida;
        if (saida?.cru) return saida.cru;
        return respostaJson(saida);
      },
    },
  };
}

beforeEach(() => {
  clearCache();
  chamadas = [];
  _setClient(geminiFalso());
  originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, opts) => {
    const u = String(url);
    if (!u.startsWith('https://dadosabertos.camara.leg.br')) return originalFetch(url, opts);
    const body = /\/deputados\/\d+$/.test(u) ? PERFIL : LISTA;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  _setClient(undefined);
  globalThis.fetch = originalFetch;
  server.close();
});

const post = (rota, corpo) =>
  fetch(`${base}/api/${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

test('FatoBot com Gemini: manda base, evidências e pergunta; devolve só fontes que existem', async () => {
  saida = {
    resposta: 'Tabata Amaral é deputada federal pelo PSB de São Paulo, segundo a Câmara.',
    fontes_usadas: ['D1', 'b08', 'X99'], // X99 não existe e deve ser ignorada
    sem_evidencia: false,
  };
  const body = await (await post('fatobot', { pergunta: 'Quem é Tabata Amaral?' })).json();

  assert.equal(body.modo, 'ia_com_fontes');
  assert.equal(body.resposta, saida.resposta);
  assert.equal(body.sem_evidencia, false);
  assert.equal(body.fontes.length, 2);
  assert.ok(body.fontes.some((f) => /\/deputados\/1$/.test(f.url)));
  assert.ok(body.fontes.some((f) => /Constituição Federal de 1988, art\. 45/.test(f.titulo)));
  assert.ok(!JSON.stringify(body).includes('00000000000'), 'não pode vazar CPF');

  const [p] = chamadas;
  assert.equal(p.model, MODELO_PADRAO);
  assert.equal(p.config.responseMimeType, 'application/json');
  assert.deepEqual(p.config.responseJsonSchema.required, ['resposta', 'fontes_usadas', 'sem_evidencia']);
  assert.equal(p.config.httpOptions.timeout, 20_000);
  assert.match(p.config.systemInstruction, /\[B08\] Câmara dos Deputados/);
  assert.match(p.contents, /\[D1\] Tabata Amaral é deputado\(a\) federal pelo PSB-SP/);
  assert.match(p.contents, /<pergunta>\nQuem é Tabata Amaral\?\n<\/pergunta>/);
});

test('GEMINI_MODEL troca o modelo', async () => {
  process.env.GEMINI_MODEL = 'modelo-de-teste';
  try {
    saida = { resposta: 'ok', fontes_usadas: ['B09'], sem_evidencia: false };
    await post('fatobot', { pergunta: 'Quantos senadores tem cada estado?' });
    assert.equal(chamadas[0].model, 'modelo-de-teste');
  } finally {
    delete process.env.GEMINI_MODEL;
  }
});

test('FatoBot com Gemini: sem nenhuma fonte válida vira "sem evidência"', async () => {
  saida = { resposta: 'Não encontrei isso nas fontes.', fontes_usadas: [], sem_evidencia: false };
  const body = await (await post('fatobot', { pergunta: 'Quem ganhou a Copa de 1970?' })).json();
  assert.equal(body.sem_evidencia, true);
  assert.deepEqual(body.fontes, []);
});

test('FatoBot: se o Gemini falhar, bloquear, cortar ou mandar JSON inválido, cai no modo somente fontes', async () => {
  const falhas = [
    new Error('rede caiu'),
    { cru: { text: '', promptFeedback: { blockReason: 'SAFETY' } } },
    { cru: { text: '{"resposta": "corta', candidates: [{ finishReason: 'MAX_TOKENS' }] } },
    { cru: { text: 'isso não é JSON', candidates: [{ finishReason: 'STOP' }] } },
    { resposta: '' },
  ];
  for (const falha of falhas) {
    saida = falha;
    const body = await (await post('fatobot', { pergunta: 'Quem é Tabata Amaral?' })).json();
    assert.equal(body.modo, 'somente_fontes');
    assert.match(body.resposta, /Encontrei estas informações/);
  }
});

test('FatoBot: se a Câmara cair, ainda responde com a base da Constituição', async () => {
  globalThis.fetch = mock.fn(async (url, opts) =>
    String(url).startsWith('https://dadosabertos.camara.leg.br')
      ? new Response('erro', { status: 503 })
      : originalFetch(url, opts)
  );
  saida = { resposta: 'Cada estado elege três senadores.', fontes_usadas: ['B09'], sem_evidencia: false };
  const res = await post('fatobot', { pergunta: 'Quantos senadores tem cada estado?' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.fontes.length, 1);
  assert.match(chamadas[0].contents, /Câmara não respondeu/);
});

test('Verificar com Gemini: devolve estado, explicação e fontes', async () => {
  saida = { estado: 'Evidências sustentam', explicacao: 'A Constituição diz isso.', fontes_usadas: ['B09'] };
  const res = await post('verificar', { afirmacao: 'Cada estado elege três senadores.' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.estado, 'Evidências sustentam');
  assert.equal(body.explicacao, 'A Constituição diz isso.');
  assert.match(body.fontes[0].titulo, /art\. 46/);
  assert.ok(!Number.isNaN(Date.parse(body.consultado_em)));
  assert.match(chamadas[0].contents, /<afirmacao>/);
  assert.deepEqual(chamadas[0].config.responseJsonSchema.properties.estado.enum, [
    'Evidências sustentam',
    'Evidências contradizem',
    'Fora de contexto',
    'Evidência insuficiente',
  ]);
});

test('Verificar: "sustentam" sem fonte válida vira "Evidência insuficiente"', async () => {
  saida = { estado: 'Evidências sustentam', explicacao: 'Confio que sim.', fontes_usadas: ['Z1'] };
  const body = await (await post('verificar', { afirmacao: 'O Brasil foi campeão em 2002.' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.deepEqual(body.fontes, []);
});

test('Verificar sem IA: "Em análise" com fontes, ou "Evidência insuficiente" sem elas', async () => {
  _setClient(undefined);
  let body = await (await post('verificar', { afirmacao: 'Cada estado elege três senadores.' })).json();
  assert.equal(body.estado, 'Em análise');
  assert.equal(body.fontes.length, 1);

  body = await (await post('verificar', { afirmacao: 'O Brasil foi campeão em 2002.' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.equal(chamadas.length, 0, 'sem IA não chama o Gemini');
});

test('Verificar: afirmação curta ou longa demais → 400', async () => {
  assert.equal((await post('verificar', { afirmacao: 'curta' })).status, 400);
  assert.equal((await post('verificar', { afirmacao: 'a'.repeat(1001) })).status, 400);
});
