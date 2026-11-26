// J12 — /api/health/fontes: check-up da Câmara, Supabase, cópia de reserva e Gemini
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _setClient as setSupabase } from '../src/services/supabase.js';
import { _setCopia } from '../src/services/camara.js';
import { iniciar, mockCamara, mockGemini } from './ajuda.js';
import { clienteFalso } from './supabase-falso.js';
import { CARGO_DEPUTADO, CARGO_SENADOR } from '../src/services/senado.js';

const SEGREDO = 'chave-secreta-de-teste-123';
let srv;
let camara;

// Supabase falso: `total` deputados e `senadores` senadores na tabela politicos.
function supabaseComTotal(total, erro = null, senadores = 0) {
  const linhas = [
    ...Array.from({ length: total ?? 0 }, (_, i) => ({ id: i + 1, cargo: CARGO_DEPUTADO })),
    ...Array.from({ length: senadores }, (_, i) => ({ id: 90000 + i, cargo: CARGO_SENADOR })),
  ];
  setSupabase(clienteFalso(linhas, erro));
}

beforeEach(async () => {
  srv = await iniciar();
  process.env.GEMINI_API_KEY = SEGREDO;
  process.env.SUPABASE_URL = 'https://mamsbcpabcdefgh.supabase.co';
});
afterEach(async () => {
  camara?.restaurar();
  setSupabase(undefined);
  delete process.env.GEMINI_API_KEY;
  delete process.env.SUPABASE_URL;
  await srv.encerrar();
});

const checkup = async (q = '') => {
  const res = await fetch(`${srv.base}/api/health/fontes${q}`);
  return { status: res.status, body: await res.json() };
};

test('J12: tudo no ar → status ok, com detalhes de cada fonte', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513, null, 81);
  const { status, body } = await checkup();
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.fontes.supabase.senadores, 81);
  assert.equal(body.fontes.supabase.detalhe, undefined);
  assert.equal(body.fontes.camara.status, 'ok');
  assert.equal(body.fontes.supabase.status, 'ok');
  assert.equal(body.fontes.supabase.deputados, 513);
  assert.equal(body.fontes.supabase.projeto, 'mamsbc…', 'mostra só o começo do endereço');
  assert.ok(['ok', 'antiga'].includes(body.fontes.copiaReserva.status));
  assert.ok(body.fontes.copiaReserva.deputados > 500);
  assert.equal(body.fontes.gemini.status, 'configurado');
  assert.equal(body.fontes.gemini.modelo, 'gemini-3.5-flash-lite');
  assert.ok(body.fontes.gemini.cotaLocal.porMinuto.max > 0);
});

test('J12: nunca devolve chaves', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513);
  const res = await fetch(`${srv.base}/api/health/fontes`);
  const texto = await res.text();
  assert.ok(!texto.includes(SEGREDO));
  assert.ok(!texto.includes('mamsbcpabcdefgh'), 'nem o endereço completo do banco');
});

test('J12: Câmara fora, mas com cópia → parcial (o FatoBot ainda responde)', async () => {
  camara = mockCamara('fora');
  supabaseComTotal(0);
  const { status, body } = await checkup();
  assert.equal(status, 200);
  assert.equal(body.status, 'parcial');
  assert.equal(body.fontes.camara.status, 'fora');
  assert.equal(body.fontes.supabase.status, 'vazio');
  assert.match(body.fontes.supabase.detalhe, /npm run importar/);
});

test('J12: sem Câmara, sem Supabase e sem cópia → fora (503)', async () => {
  camara = mockCamara('fora');
  _setCopia(null);
  delete process.env.SUPABASE_URL;
  const { status, body } = await checkup();
  assert.equal(status, 503);
  assert.equal(body.status, 'fora');
  assert.equal(body.fontes.supabase.status, 'nao_configurado');
  assert.equal(body.fontes.copiaReserva.status, 'ausente');
});

test('J12: cópia com mais de 7 dias aparece como "antiga"', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513);
  _setCopia({ coletadoEm: '2026-01-01T00:00:00.000Z', dados: [{ id: 1, nome: 'X Y', partido: 'P', uf: 'SP' }] });
  const { body } = await checkup();
  assert.equal(body.fontes.copiaReserva.status, 'antiga');
  assert.match(body.fontes.copiaReserva.detalhe, /atualizar-deputados/);
  assert.equal(body.status, 'parcial');
});

test('J12: o Gemini só é chamado com ?ia=1', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513);
  const chamadas = mockGemini('OK');
  await checkup();
  assert.equal(chamadas.length, 0, 'sem ?ia=1 não gasta cota');

  const { body } = await checkup('?ia=1');
  assert.equal(chamadas.length, 1);
  assert.equal(body.fontes.gemini.status, 'ok');
  assert.equal(body.fontes.gemini.teste.ok, true);
});

test('J12: resultado fica em cache por 30s (não sobrecarrega a Câmara)', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513);
  await checkup();
  const antes = camara.chamadas.length;
  await checkup();
  assert.equal(camara.chamadas.length, antes);
});

test('Kelly: banco sem senadores → aviso para rodar a importação', async () => {
  camara = mockCamara('ok');
  supabaseComTotal(513);
  const { body } = await checkup();
  assert.equal(body.fontes.supabase.status, 'ok');
  assert.equal(body.fontes.supabase.senadores, 0);
  assert.match(body.fontes.supabase.detalhe, /senadores/i);
});
