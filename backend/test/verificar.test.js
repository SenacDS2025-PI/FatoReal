import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _setClient } from '../src/services/gemini.js';

const LISTA = {
  dados: [{ id: 1, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f' }],
  links: [],
};
const PERFIL = {
  dados: {
    id: 1,
    cpf: '00000000000',
    escolaridade: 'Superior',
    redeSocial: [],
    ultimoStatus: { nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', situacao: 'Exercício', data: '2023-02-01' },
  },
};

let originalFetch;
let server;
let base;
let chamadas;

function geminiResponde(resposta) {
  chamadas = [];
  _setClient({
    models: {
      generateContent: async (params) => {
        chamadas.push(params);
        if (resposta instanceof Error) throw resposta;
        return typeof resposta === 'string' ? { text: resposta } : resposta;
      },
    },
  });
}
const json = (o) => JSON.stringify(o);

beforeEach(() => {
  clearCache();
  chamadas = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, opts) => {
    const u = String(url);
    if (!u.startsWith('https://dadosabertos.camara.leg.br')) return originalFetch(url, opts);
    return new Response(JSON.stringify(/\/deputados\/\d+$/.test(u) ? PERFIL : LISTA));
  });
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  _setClient(undefined);
  server.close();
});

const verificar = (corpo) =>
  fetch(`${base}/api/verificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

test('Evidências sustentam: formato que o front espera, com fontes', async () => {
  geminiResponde(json({ estado: 'sustentam', explicacao: 'Tabata Amaral é deputada pelo PSB-SP [1].' }));
  const res = await verificar({ afirmacao: 'Tabata Amaral é deputada do PSB' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.estado, 'Evidências sustentam');
  assert.match(body.explicacao, /\[1\]/);
  assert.equal(body.fontes.length, 1);
  assert.deepEqual(Object.keys(body.fontes[0]).sort(), ['data', 'titulo', 'url']);
  assert.ok(body.consultado_em);
  assert.ok(!json(body).includes('00000000000'), 'não pode vazar CPF');

  // Pede JSON estruturado e manda a afirmação isolada como dado.
  const { config, contents } = chamadas[0];
  assert.equal(config.responseMimeType, 'application/json');
  assert.match(contents, /<afirmacao>Tabata Amaral é deputada do PSB<\/afirmacao>/);
});

test('Evidências contradizem e Fora de contexto são repassados', async () => {
  geminiResponde(json({ estado: 'contradizem', explicacao: 'Ela é do PSB, não do partido citado [1].' }));
  let body = await (await verificar({ afirmacao: 'Tabata Amaral é do partido XYZ' })).json();
  assert.equal(body.estado, 'Evidências contradizem');

  geminiResponde(json({ estado: 'fora_de_contexto', explicacao: 'A situação foi registrada em 2023 [2].' }));
  body = await (await verificar({ afirmacao: 'Tabata Amaral virou deputada ontem' })).json();
  assert.equal(body.estado, 'Fora de contexto');
});

test('afirmação sem citação válida vira Evidência insuficiente', async () => {
  geminiResponde(json({ estado: 'contradizem', explicacao: 'Isso é mentira.' }));
  const body = await (await verificar({ afirmacao: 'Tabata Amaral é do partido XYZ' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.match(body.explicacao, /Ausência de evidência não é prova de falsidade/);
});

test('estado inventado ou JSON inválido → Em análise', async () => {
  geminiResponde(json({ estado: 'falso', explicacao: 'x [1]' }));
  assert.equal((await (await verificar({ afirmacao: 'Tabata Amaral é do PSB' })).json()).estado, 'Em análise');

  geminiResponde('isto não é json');
  assert.equal((await (await verificar({ afirmacao: 'Tabata Amaral é do PSB' })).json()).estado, 'Em análise');
});

test('sem IA disponível → Em análise, com os fatos e as fontes', async () => {
  geminiResponde(new Error('rede caiu'));
  const body = await (await verificar({ afirmacao: 'Tabata Amaral é do PSB' })).json();
  assert.equal(body.estado, 'Em análise');
  assert.match(body.explicacao, /PSB-SP/);
  assert.equal(body.fontes.length, 1);
});

test('nenhum deputado citado → Evidência insuficiente sem chamar a IA', async () => {
  geminiResponde(json({ estado: 'sustentam', explicacao: 'x [1]' }));
  const body = await (await verificar({ afirmacao: 'A vacina X causa problema Y' })).json();
  assert.equal(body.estado, 'Evidência insuficiente');
  assert.deepEqual(body.fontes, []);
  assert.equal(chamadas.length, 0);
});

test('link não é usado como fonte e precisa ser https', async () => {
  geminiResponde(json({ estado: 'sustentam', explicacao: 'Ela é do PSB [1].' }));
  const body = await (await verificar({ afirmacao: 'Tabata Amaral é do PSB', link: 'https://exemplo.com/post' })).json();
  assert.match(body.explicacao, /link enviado não é usado como fonte/);
  assert.ok(!json(chamadas[0]).includes('exemplo.com'), 'o link não vai para a IA');

  const ruim = await verificar({ afirmacao: 'Tabata Amaral é do PSB', link: 'http://inseguro.com' });
  assert.equal(ruim.status, 400);
});

test('formulário com anexos: aceita, avisa que não foram analisados', async () => {
  geminiResponde(json({ estado: 'sustentam', explicacao: 'Ela é do PSB [1].' }));
  const form = new FormData();
  form.append('afirmacao', 'Tabata Amaral é do PSB');
  form.append('anexos', new Blob(['abc'], { type: 'image/png' }), 'foto.png');
  form.append('anexos', new Blob(['def'], { type: 'image/png' }), 'foto2.png');
  const res = await fetch(`${base}/api/verificar`, { method: 'POST', body: form });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.match(body.explicacao, /Os 2 anexos enviados não foram analisados/);
});

test('anexo grande demais ou afirmação inválida → 400', async () => {
  const form = new FormData();
  form.append('afirmacao', 'Tabata Amaral é do PSB');
  form.append('anexos', new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]), 'grande.bin');
  assert.equal((await fetch(`${base}/api/verificar`, { method: 'POST', body: form })).status, 400);

  assert.equal((await verificar({ afirmacao: 'oi' })).status, 400);
  assert.equal((await verificar({})).status, 400);
});
