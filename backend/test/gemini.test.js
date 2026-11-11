import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _setClient, citacoesValidas } from '../src/services/gemini.js';

const LISTA = {
  dados: [{ id: 1, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f' }],
  links: [],
};
const PERFIL = {
  dados: {
    id: 1,
    escolaridade: 'Superior',
    redeSocial: [],
    ultimoStatus: { nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', situacao: 'Exercício', data: '2023-02-01' },
  },
};

let originalFetch;
let server;
let base;
let chamadas;

// Cliente falso do Gemini: devolve a resposta que o teste mandar.
function geminiFalso(resposta) {
  chamadas = [];
  _setClient({
    models: {
      generateContent: async (params) => {
        chamadas.push(params);
        if (resposta instanceof Error) throw resposta;
        return resposta;
      },
    },
  });
}
const texto = (t) => ({ text: t });

beforeEach(() => {
  clearCache();
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

const perguntar = async (pergunta) =>
  (
    await fetch(`${base}/api/fatobot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta }),
    })
  ).json();

test('usa a resposta do Gemini quando ela cita evidências válidas', async () => {
  geminiFalso(texto('Tabata Amaral é deputada federal pelo PSB-SP [1].'));
  const body = await perguntar('Qual o partido de Tabata Amaral?');
  assert.equal(body.modo, 'ia_com_fontes');
  assert.match(body.resposta, /\[1\]/);
  assert.ok(body.fontes.length > 0);
  assert.match(body.aviso, /pode errar/);

  // O Gemini recebe as regras, as evidências numeradas e a pergunta isolada como dado.
  const { contents, config } = chamadas[0];
  assert.match(config.systemInstruction, /SOMENTE com base nas EVIDÊNCIAS/);
  assert.equal(config.httpOptions.timeout, 20_000);
  assert.match(contents, /\[1\] Tabata Amaral é deputado\(a\) federal pelo PSB-SP/);
  assert.match(contents, /<pergunta>Qual o partido de Tabata Amaral\?<\/pergunta>/);
});

test('descarta resposta sem citação (trava anti-alucinação)', async () => {
  geminiFalso(texto('Ela é a melhor deputada do Brasil.'));
  const body = await perguntar('Quem é Tabata Amaral?');
  assert.equal(body.modo, 'somente_fontes');
  assert.match(body.resposta, /Encontrei estas informações/);
});

test('descarta resposta que cita evidência inexistente', async () => {
  geminiFalso(texto('Foi eleita em 2018 [9].'));
  assert.equal((await perguntar('Quem é Tabata Amaral?')).modo, 'somente_fontes');
});

test('SEM_EVIDENCIA do Gemini → mostra só os fatos encontrados', async () => {
  geminiFalso(texto('SEM_EVIDENCIA'));
  assert.equal((await perguntar('Quantos projetos Tabata Amaral aprovou?')).modo, 'somente_fontes');
});

test('bloqueio de segurança, resposta vazia ou erro não derrubam o FatoBot', async () => {
  geminiFalso({ text: undefined, promptFeedback: { blockReason: 'SAFETY' } });
  assert.equal((await perguntar('Quem é Tabata Amaral?')).modo, 'somente_fontes');

  geminiFalso({ text: undefined });
  assert.equal((await perguntar('Quem é Tabata Amaral?')).modo, 'somente_fontes');

  geminiFalso(new Error('rede caiu'));
  const body = await perguntar('Quem é Tabata Amaral?');
  assert.equal(body.modo, 'somente_fontes');
  assert.equal(body.tipo, 'fontes_encontradas');
});

test('sem deputado na pergunta, o Gemini nem é chamado', async () => {
  geminiFalso(texto('qualquer coisa [1]'));
  const body = await perguntar('Qual a capital da França?');
  assert.equal(body.tipo, 'sem_evidencia');
  assert.equal(chamadas.length, 0);
});

test('citacoesValidas', () => {
  assert.equal(citacoesValidas('a [1] b [2]', 2), true);
  assert.equal(citacoesValidas('sem citação', 2), false);
  assert.equal(citacoesValidas('a [0]', 2), false);
  assert.equal(citacoesValidas('a [3]', 2), false);
});
