import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';

// Respostas falsas da Câmara, para os testes não dependerem da internet.
const LISTA = {
  dados: [
    { id: 1, nome: 'João Teste', siglaPartido: 'AAA', siglaUf: 'SP', urlFoto: 'f1' },
    { id: 2, nome: 'Maria Exemplo', siglaPartido: 'BBB', siglaUf: 'RJ', urlFoto: 'f2' },
  ],
  links: [{ rel: 'self' }],
};
const PERFIL = {
  dados: {
    id: 1,
    nomeCivil: 'JOAO TESTE DA SILVA',
    cpf: '00000000000',
    escolaridade: 'Superior',
    redeSocial: [],
    ultimoStatus: { nome: 'João Teste', siglaPartido: 'AAA', siglaUf: 'SP', data: '2023-02-01' },
  },
};

let originalFetch;
let server;
let base;

beforeEach(() => {
  clearCache();
  originalFetch = globalThis.fetch;
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  server.close();
});

// Só intercepta chamadas à Câmara; chamadas à nossa API seguem normais.
function mockCamara(handler) {
  globalThis.fetch = mock.fn(async (url, opts) => {
    if (String(url).startsWith('https://dadosabertos.camara.leg.br')) return handler(String(url));
    return originalFetch(url, opts);
  });
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('busca ignora acentos e maiúsculas e devolve a fonte', async () => {
  mockCamara(() => json(LISTA));
  const res = await fetch(`${base}/api/deputados?busca=JOAO`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.equal(body.dados[0].nome, 'João Teste');
  assert.match(body.fonte.url, /dadosabertos\.camara\.leg\.br/);
  assert.ok(body.fonte.consultadoEm);
});

test('filtra por UF', async () => {
  mockCamara(() => json(LISTA));
  const body = await (await fetch(`${base}/api/deputados?uf=rj`)).json();
  assert.deepEqual(body.dados.map((d) => d.id), [2]);
});

test('perfil não expõe o CPF (LGPD) e traz fonte e data', async () => {
  mockCamara(() => json(PERFIL));
  const res = await fetch(`${base}/api/deputados/1`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.dados.nome, 'João Teste');
  assert.equal(body.dados.cpf, undefined);
  assert.ok(!JSON.stringify(body).includes('00000000000'));
  assert.equal(body.dados.dataDoStatus, '2023-02-01');
  assert.match(body.fonte.url, /\/deputados\/1$/);
});

test('ID inválido responde 400', async () => {
  mockCamara(() => json(PERFIL));
  const res = await fetch(`${base}/api/deputados/abc`);
  assert.equal(res.status, 400);
});

test('deputado inexistente responde 404', async () => {
  mockCamara(() => json({}, 404));
  const res = await fetch(`${base}/api/deputados/999`);
  assert.equal(res.status, 404);
});

test('Câmara fora do ar responde 502 com mensagem amigável', async () => {
  mockCamara(() => json({}, 503));
  const res = await fetch(`${base}/api/deputados/1`);
  assert.equal(res.status, 502);
  assert.match((await res.json()).erro, /Câmara/);
});
