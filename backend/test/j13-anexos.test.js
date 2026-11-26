// J13 — anexos do Verificar: nunca impedem a verificação do texto e o aviso é honesto
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, mockCamara, mockGemini } from './ajuda.js';

let srv;
let camara;
beforeEach(async () => {
  srv = await iniciar();
  camara = mockCamara('ok');
  mockGemini('{"estado":"sustentam","explicacao":"Tabata Amaral é deputada pelo PSB-SP [1]."}');
});
afterEach(async () => {
  camara.restaurar();
  await srv.encerrar();
});

const json = (corpo) =>
  fetch(`${srv.base}/api/verificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

test('J13: front manda só as informações dos anexos (JSON) → verifica o texto e avisa', async () => {
  const res = await json({
    afirmacao: 'Tabata Amaral é do PSB',
    anexos: [
      { nome: 'print.jpg', tipo: 'imagem', tamanho: '3,2 MB' },
      { nome: 'video.mp4', tipo: 'video', tamanho: '40 MB' },
    ],
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.estado, 'Evidências sustentam', 'o texto foi verificado normalmente');
  assert.match(body.explicacao, /Os 2 anexos não foram analisados nem guardados/);
  assert.match(body.explicacao, /agência de checagem/);
});

test('J13: o aviso não promete revisão humana (não existe fila de revisão no MVP)', async () => {
  const body = await (await json({ afirmacao: 'Tabata Amaral é do PSB', anexos: [{ nome: 'a.png' }] })).json();
  assert.match(body.explicacao, /O anexo não foi analisado nem guardado/);
  assert.ok(!/revisão humana/.test(body.explicacao));
});

test('J13: arquivo acima do limite não derruba a verificação do texto', async () => {
  const form = new FormData();
  form.append('afirmacao', 'Tabata Amaral é do PSB');
  form.append('anexos', new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]), 'grande.bin');
  const res = await fetch(`${srv.base}/api/verificar`, { method: 'POST', body: form });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.estado, 'Evidências sustentam');
  assert.match(body.explicacao, /passaram do tamanho permitido e não foram recebidos/);
});

test('J13: sem anexos, nada é dito sobre anexos', async () => {
  const body = await (await json({ afirmacao: 'Tabata Amaral é do PSB' })).json();
  assert.ok(!/anexo/i.test(body.explicacao));
});
