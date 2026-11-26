// J10 — limites de uso (por IP contra abuso + cota da IA para o servidor inteiro)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ipDe } from '../src/utils/limite.js';
import { iniciar, mockCamara, mockGemini, perguntar } from './ajuda.js';

let srv;
let camara;
beforeEach(async () => {
  srv = await iniciar();
  camara = mockCamara('ok');
});
afterEach(async () => {
  camara.restaurar();
  await srv.encerrar();
  for (const v of ['LIMITE_POR_IP_MIN', 'LIMITE_IA_POR_MIN', 'LIMITE_IA_POR_DIA']) delete process.env[v];
});

const pedir = (ip, pergunta = 'oi tudo bem') =>
  fetch(`${srv.base}/api/fatobot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ pergunta }),
  });

test('J10: passou do limite por IP → 429 com Retry-After; outro IP continua liberado', async () => {
  process.env.LIMITE_POR_IP_MIN = '3';
  for (let i = 0; i < 3; i++) assert.equal((await pedir('10.0.0.1')).status, 200);

  const bloqueado = await pedir('10.0.0.1');
  assert.equal(bloqueado.status, 429);
  assert.match((await bloqueado.json()).erro, /Muitas perguntas/);
  assert.ok(Number(bloqueado.headers.get('retry-after')) > 0);

  assert.equal((await pedir('10.0.0.2')).status, 200, 'cada IP tem a sua conta');
});

test('J10: o limite por IP também vale no /api/verificar', async () => {
  process.env.LIMITE_POR_IP_MIN = '1';
  const enviar = () =>
    fetch(`${srv.base}/api/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.9' },
      body: JSON.stringify({ afirmacao: 'A vacina X causa Y' }),
    });
  assert.equal((await enviar()).status, 200);
  assert.equal((await enviar()).status, 429);
});

test('J10: o padrão por IP aguenta uma sala de aula no mesmo IP (60/min)', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await pedir('200.1.1.1')).status, 200, `pedido ${i + 1}`);
});

test('J10: cota da IA acabou → responde só com as fontes (não recusa a pergunta)', async () => {
  process.env.LIMITE_IA_POR_MIN = '2';
  const chamadas = mockGemini('Tabata Amaral é deputada federal pelo PSB-SP [1].');

  for (let i = 0; i < 2; i++) {
    const { body } = await perguntar(srv.base, 'Qual o partido de Tabata Amaral?');
    assert.equal(body.modo, 'ia_com_fontes');
  }
  const { status, body } = await perguntar(srv.base, 'Qual o partido de Tabata Amaral?');
  assert.equal(status, 200);
  assert.equal(body.modo, 'somente_fontes');
  assert.equal(body.motivo_sem_ia, 'limite_local');
  assert.match(body.resposta, /^A IA atingiu o limite de uso por agora/);
  assert.match(body.resposta, /PSB-SP/);
  assert.equal(chamadas.length, 2, 'o Gemini não foi chamado de novo');
});

test('J10: cota diária também é respeitada', async () => {
  process.env.LIMITE_IA_POR_DIA = '1';
  const chamadas = mockGemini('Tabata Amaral é deputada federal pelo PSB-SP [1].');
  await perguntar(srv.base, 'Qual o partido de Tabata Amaral?');
  const { body } = await perguntar(srv.base, 'Qual o partido de Tabata Amaral?');
  assert.equal(body.motivo_sem_ia, 'limite_local');
  assert.equal(chamadas.length, 1);
});

test('J10: ipDe usa x-real-ip, depois o primeiro do x-forwarded-for', () => {
  assert.equal(ipDe({ headers: { 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' } }), '1.1.1.1');
  assert.equal(ipDe({ headers: { 'x-forwarded-for': '3.3.3.3, 10.0.0.1' } }), '3.3.3.3');
  assert.equal(ipDe({ headers: {}, ip: '::1' }), '::1');
});
