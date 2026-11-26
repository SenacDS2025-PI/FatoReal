import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _resetPausa } from '../src/services/camara.js';
import { _zerarLimites } from '../src/utils/limite.js';
import { _setClient } from '../src/services/supabase.js';

import { clienteFalso } from './supabase-falso.js';
import { CARGO_DEPUTADO, CARGO_SENADOR } from '../src/services/senado.js';

// A tabela tem deputados E senadores; a busca de deputados só pode ver os deputados.
const SENADOR = { id: 5012, nome: 'Senador Teste (exemplo)', partido: 'X', uf: 'DF', cargo: CARGO_SENADOR };
function supabaseFalso(linhas) {
  _setClient(clienteFalso([...linhas.map((l) => ({ cargo: CARGO_DEPUTADO, ...l })), SENADOR]));
}

const LINHA = {
  id: 1,
  nome: 'Tabata Amaral',
  nome_civil: 'TABATA TESTE',
  partido: 'PSB',
  uf: 'SP',
  foto_url: 'f',
  email: 'dep@camara.leg.br',
  situacao: 'Exercício',
  escolaridade: 'Superior',
  municipio_nascimento: 'São Paulo',
  fonte_url: 'https://dadosabertos.camara.leg.br/api/v2/deputados/1',
  data_coleta: '2026-11-10T12:00:00.000Z',
};

let originalFetch;
let server;
let base;
let chamadasCamara;

beforeEach(() => {
  clearCache();
  _resetPausa();
  _zerarLimites();
  chamadasCamara = 0;
  originalFetch = globalThis.fetch;
  // Câmara fora do ar em todos os testes deste arquivo.
  globalThis.fetch = mock.fn(async (url, opts) => {
    if (!String(url).startsWith('https://dadosabertos.camara.leg.br')) return originalFetch(url, opts);
    chamadasCamara++;
    return new Response('{}', { status: 504 });
  });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _setClient(undefined);
  server.close();
});

test('busca lê do Supabase sem chamar a Câmara', async () => {
  supabaseFalso([LINHA]);
  const body = await (await fetch(`${base}/api/deputados?busca=tabata`)).json();
  assert.equal(body.total, 1);
  assert.equal(body.dados[0].partido, 'PSB');
  assert.match(body.fonte.nome, /cópia salva no Fato Real/);
  assert.equal(body.fonte.consultadoEm, LINHA.data_coleta);
  assert.equal(chamadasCamara, 0);
});

test('perfil usa a cópia do Supabase quando a Câmara cai', async () => {
  supabaseFalso([LINHA]);
  const res = await fetch(`${base}/api/deputados/1`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.dados.nome, 'Tabata Amaral');
  assert.equal(body.fonte.url, LINHA.fonte_url);
  assert.equal(body.fonte.consultadoEm, LINHA.data_coleta);
  assert.ok(chamadasCamara > 0, 'tentou a Câmara antes');
});

test('FatoBot funciona com a Câmara fora do ar, usando o Supabase', async () => {
  supabaseFalso([LINHA]);
  const res = await fetch(`${base}/api/fatobot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pergunta: 'Qual o partido de Tabata Amaral?' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.tipo, 'fontes_encontradas');
  assert.match(JSON.stringify(body), /PSB-SP/);
});

test('sem Supabase, Câmara fora e deputado fora da cópia → 503', async () => {
  const res = await fetch(`${base}/api/deputados/1`);
  assert.equal(res.status, 503);
});

test('Kelly: senadores da tabela não aparecem na busca nem no perfil de deputado', async () => {
  supabaseFalso([LINHA]);
  const lista = await (await fetch(`${base}/api/deputados`)).json();
  assert.ok(lista.dados.every((d) => d.id !== SENADOR.id));
});
