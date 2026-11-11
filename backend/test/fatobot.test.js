import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';

const LISTA = {
  dados: [
    { id: 1, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f1' },
    { id: 2, nome: 'Maria Exemplo', siglaPartido: 'BBB', siglaUf: 'RJ', urlFoto: 'f2' },
    { id: 3, nome: 'Amaral', siglaPartido: 'CCC', siglaUf: 'MG', urlFoto: 'f3' },
  ],
  links: [],
};
const PERFIL = {
  dados: {
    id: 1,
    nomeCivil: 'TABATA TESTE',
    cpf: '00000000000',
    escolaridade: 'Superior',
    ufNascimento: 'SP',
    municipioNascimento: 'São Paulo',
    redeSocial: [],
    ultimoStatus: {
      nome: 'Tabata Amaral',
      siglaPartido: 'PSB',
      siglaUf: 'SP',
      idLegislatura: 57,
      situacao: 'Exercício',
      condicaoEleitoral: 'Titular',
      data: '2023-02-01',
    },
  },
};

let originalFetch;
let server;
let base;

beforeEach(() => {
  clearCache();
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
  globalThis.fetch = originalFetch;
  server.close();
});

const perguntar = (pergunta) =>
  fetch(`${base}/api/fatobot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pergunta }),
  });

test('responde com evidências, fontes e aviso quando encontra o deputado', async () => {
  const res = await perguntar('Quem é a TABATA AMARAL?');
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.tipo, 'fontes_encontradas');
  assert.equal(body.modo, 'somente_fontes');
  assert.ok(body.evidencias.length > 0);
  for (const e of body.evidencias) {
    assert.match(e.url, /dadosabertos\.camara\.leg\.br/);
    assert.ok(e.consultadoEm);
  }
  assert.match(body.resposta, /PSB-SP/);
  assert.match(body.resposta, /01\/02\/2023/);
  assert.equal(body.fontes.length, 1);
  // Formato que o front espera
  assert.match(body.fontes[0].titulo, /Tabata Amaral/);
  assert.match(body.fontes[0].url, /dadosabertos\.camara\.leg\.br/);
  assert.ok(body.fontes[0].data);
  assert.equal(body.sem_evidencia, false);
  assert.ok(!Number.isNaN(Date.parse(body.consultado_em)));
  assert.match(body.aviso, /pode errar/);
  assert.ok(!JSON.stringify(body).includes('00000000000'), 'não pode vazar CPF');
});

test('nome de uma palavra só não gera falso positivo', async () => {
  const body = await (await perguntar('O que o Amaral votou?')).json();
  assert.equal(body.tipo, 'sem_evidencia');
});

test('sem deputado na pergunta → declara que não encontrou evidência', async () => {
  const body = await (await perguntar('Qual a capital da França?')).json();
  assert.equal(body.tipo, 'sem_evidencia');
  assert.deepEqual(body.evidencias, []);
  assert.equal(body.sem_evidencia, true);
  assert.match(body.resposta, /Não encontrei evidência/);
  assert.match(body.aviso, /não significa que a informação é falsa/);
});

test('pergunta vazia ou longa demais → 400', async () => {
  assert.equal((await perguntar('')).status, 400);
  assert.equal((await perguntar('a'.repeat(501))).status, 400);
  const semCorpo = await fetch(`${base}/api/fatobot`, { method: 'POST' });
  assert.equal(semCorpo.status, 400);
});
