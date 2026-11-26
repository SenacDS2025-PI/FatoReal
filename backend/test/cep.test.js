import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _resetPausa } from '../src/services/camara.js';
import { _zerarLimites } from '../src/utils/limite.js';
import { normalizarCep } from '../src/services/cep.js';
import { _setCopia } from '../src/services/camara.js';

const VIACEP_OK = {
  cep: '01310-100', logradouro: 'Avenida Paulista', complemento: '', bairro: 'Bela Vista',
  localidade: 'São Paulo', uf: 'SP', estado: 'São Paulo',
};
const LISTA = {
  dados: [
    { id: 1, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f' },
    { id: 2, nome: 'Maria Exemplo', siglaPartido: 'BBB', siglaUf: 'RJ', urlFoto: 'f' },
  ],
  links: [],
};

let originalFetch;
let server;
let base;
let viacep;
let camaraFora;

beforeEach(() => {
  clearCache();
  _resetPausa();
  _zerarLimites();
  viacep = () => new Response(JSON.stringify(VIACEP_OK));
  camaraFora = false;
  originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, opts) => {
    const u = String(url);
    if (u.startsWith('https://viacep.com.br')) return viacep(u);
    if (u.startsWith('https://dadosabertos.camara.leg.br')) {
      return camaraFora ? new Response('{}', { status: 504 }) : new Response(JSON.stringify(LISTA));
    }
    return originalFetch(url, opts);
  });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  server.close();
});

test('normalizarCep aceita formatos comuns', () => {
  assert.equal(normalizarCep('01310-100'), '01310100');
  assert.equal(normalizarCep('01.310-100'), '01310100');
  assert.equal(normalizarCep('123'), null);
  assert.equal(normalizarCep(undefined), null);
});

test('CEP válido → endereço + deputados do estado, com fontes', async () => {
  const res = await fetch(`${base}/api/cep/01310-100`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.endereco.logradouro, 'Avenida Paulista');
  assert.equal(body.endereco.cidade, 'São Paulo');
  assert.equal(body.endereco.uf, 'SP');
  assert.equal(body.endereco.complemento, null);
  assert.equal(body.endereco.fonte.nome, 'ViaCEP');
  assert.equal(body.deputados.total, 1);
  assert.equal(body.deputados.dados[0].nome, 'Tabata Amaral');
  assert.ok(body.deputados.fonte.url);
});

test('?politicos=0 devolve só o endereço', async () => {
  const body = await (await fetch(`${base}/api/cep/01310100?politicos=0`)).json();
  assert.equal(body.endereco.uf, 'SP');
  assert.equal(body.deputados, undefined);
});

test('Câmara fora do ar: deputados do estado vêm da cópia de reserva', async () => {
  camaraFora = true;
  const res = await fetch(`${base}/api/cep/01310100`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.endereco.uf, 'SP');
  assert.ok(body.deputados.total > 0);
  assert.match(body.deputados.fonte.nome, /cópia de reserva/);
});

test('Câmara fora e sem cópia: o endereço volta mesmo assim', async () => {
  camaraFora = true;
  _setCopia(null);
  try {
    const res = await fetch(`${base}/api/cep/01310100`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.endereco.uf, 'SP');
    assert.equal(body.deputados, null);
  } finally {
    _setCopia(undefined);
  }
});

test('CEP inválido → 400, inexistente → 404, ViaCEP fora → 502', async () => {
  assert.equal((await fetch(`${base}/api/cep/123`)).status, 400);

  viacep = () => new Response(JSON.stringify({ erro: 'true' }));
  assert.equal((await fetch(`${base}/api/cep/99999999`)).status, 404);

  viacep = () => new Response('erro', { status: 500 });
  assert.equal((await fetch(`${base}/api/cep/01001000`)).status, 502);
});
