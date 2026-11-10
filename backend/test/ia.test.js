// Testes do FatoBot e da verificação COM IA, usando um Claude falso (não gasta créditos).
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { definirClienteIA } from '../src/services/ia.js';

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
let pedidos; // parâmetros que o backend mandou para o Claude falso
let saidaIa; // o que o Claude falso responde

function claudeFalso() {
  return {
    beta: {
      messages: {
        create: async (params) => {
          pedidos.push(params);
          if (saidaIa instanceof Error) throw saidaIa;
          if (saidaIa === 'recusa') return { stop_reason: 'refusal', stop_details: { category: null }, content: [] };
          return {
            stop_reason: 'end_turn',
            content: [
              { type: 'thinking', thinking: '' },
              { type: 'text', text: JSON.stringify(saidaIa) },
            ],
          };
        },
      },
    },
  };
}

beforeEach(() => {
  clearCache();
  pedidos = [];
  definirClienteIA(claudeFalso());
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
  definirClienteIA(null);
  globalThis.fetch = originalFetch;
  server.close();
});

const post = (rota, corpo) =>
  fetch(`${base}/api/${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

test('FatoBot com IA: manda base, evidências e pergunta; devolve só fontes que existem', async () => {
  saidaIa = {
    resposta: 'Tabata Amaral é deputada federal pelo PSB de São Paulo, segundo a Câmara.',
    fontes_usadas: ['D1', 'b08', 'X99'], // X99 não existe e deve ser ignorada
    sem_evidencia: false,
  };
  const body = await (await post('fatobot', { pergunta: 'Quem é Tabata Amaral?' })).json();

  assert.equal(body.modo, 'ia_com_fontes');
  assert.equal(body.resposta, saidaIa.resposta);
  assert.equal(body.sem_evidencia, false);
  assert.equal(body.fontes.length, 2);
  assert.ok(body.fontes.some((f) => /\/deputados\/1$/.test(f.url)));
  assert.ok(body.fontes.some((f) => /Constituição Federal de 1988, art\. 45/.test(f.titulo)));
  assert.ok(!JSON.stringify(body).includes('00000000000'), 'não pode vazar CPF');

  const [p] = pedidos;
  assert.equal(p.model, 'claude-opus-5-5');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.fallbacks, 'default');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.match(p.system[0].text, /\[B08\] Câmara dos Deputados/);
  assert.equal(p.system[0].cache_control.type, 'ephemeral');
  assert.match(p.messages[0].content, /\[D1\] Tabata Amaral é deputado\(a\) federal pelo PSB-SP/);
  assert.match(p.messages[0].content, /<pergunta>\nQuem é Tabata Amaral\?\n<\/pergunta>/);
});

test('FatoBot com IA: sem nenhuma fonte válida vira "sem evidência"', async () => {
  saidaIa = { resposta: 'Não encontrei isso nas fontes.', fontes_usadas: [], sem_evidencia: false };
  const body = await (await post('fatobot', { pergunta: 'Quem ganhou a Copa de 1970?' })).json();
  assert.equal(body.sem_evidencia, true);
  assert.deepEqual(body.fontes, []);
});

test('FatoBot: se a IA falhar ou recusar, cai no modo somente fontes', async () => {
  for (const falha of [new Error('rede caiu'), 'recusa', { resposta: '' }]) {
    saidaIa = falha;
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
  saidaIa = { resposta: 'Cada estado elege três senadores.', fontes_usadas: ['B09'], sem_evidencia: false };
  const res = await post('fatobot', { pergunta: 'Quantos senadores tem cada estado?' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.fontes.length, 1);
  assert.match(pedidos[0].messages[0].content, /Câmara não respondeu/);
});

test('Verificar com IA: devolve estado, explicação e fontes', async () => {
  saidaIa = { estado: 'Evidências sustentam', explicacao: 'A Constituição diz isso.', fontes_usadas: ['B09'] };
  const res = await post('verificar', { afirmacao: 'Cada estado elege três senadores.' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.estado, 'Evidências sustentam');
  assert.equal(body.explicacao, 'A Constituição diz isso.');
  assert.match(body.fontes[0].titulo, /art\. 46/);
  assert.ok(!Number.isNaN(Date.parse(body.consultado_em)));
  assert.match(pedidos[0].messages[0].content, /<afirmacao>/);
  assert.deepEqual(pedidos[0].output_config.format.schema.properties.estado.enum, [
    'Evidências sustentam',
    'Evidências contradizem',
    'Fora de contexto',
    'Evidência insuficiente',
  ]);
});

test('Verificar: "sustentam" sem fonte válida vira "Evidência insuficiente"', async () => {
  saidaIa = { estado: 'Evidências sustentam', explicacao: 'Confio que sim.', fontes_usadas: ['Z1'] };
  const body = await (await post('verificar', { afirmacao: 'O Brasil foi campeão em 2002.' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.deepEqual(body.fontes, []);
});

test('Verificar sem IA: "Em análise" com fontes, ou "Evidência insuficiente" sem elas', async () => {
  definirClienteIA(null);
  let body = await (await post('verificar', { afirmacao: 'Cada estado elege três senadores.' })).json();
  assert.equal(body.estado, 'Em análise');
  assert.equal(body.fontes.length, 1);

  body = await (await post('verificar', { afirmacao: 'O Brasil foi campeão em 2002.' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.equal(pedidos.length, 0, 'sem IA não chama o Claude');
});

test('Verificar: afirmação curta ou longa demais → 400', async () => {
  assert.equal((await post('verificar', { afirmacao: 'curta' })).status, 400);
  assert.equal((await post('verificar', { afirmacao: 'a'.repeat(1001) })).status, 400);
});
