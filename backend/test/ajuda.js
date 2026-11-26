// Funções de apoio dos testes J1–J7 (não é um arquivo de teste: não termina em .test.js).
import { mock } from 'node:test';
import app from '../src/app.js';
import { clearCache } from '../src/utils/cache.js';
import { _setClient } from '../src/services/gemini.js';
import { _setCopia, _resetPausa } from '../src/services/camara.js';
import { _resetOutros } from '../src/services/outros-politicos.js';
import { _zerarLimites } from '../src/utils/limite.js';

export const PERFIL_TABATA = {
  dados: {
    id: 204534,
    cpf: '00000000000',
    escolaridade: 'Superior',
    redeSocial: [],
    ultimoStatus: { nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', situacao: 'Exercício', data: '2023-02-01' },
  },
};
export const LISTA = {
  dados: [{ id: 204534, nome: 'Tabata Amaral', siglaPartido: 'PSB', siglaUf: 'SP', urlFoto: 'f' }],
  links: [],
};

// Câmara: 'ok' responde normal, 'fora' responde 504, 'trava' nunca responde (até o timeout).
export function mockCamara(estado = 'ok') {
  const chamadas = [];
  const original = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, opts) => {
    const u = String(url);
    // Senado: nos testes fica "fora" (sem internet), a não ser que o teste troque o fetch.
    if (u.startsWith('https://legis.senado.leg.br')) return new Response('{}', { status: 503 });
    if (!u.startsWith('https://dadosabertos.camara.leg.br')) return original(url, opts);
    chamadas.push(u);
    if (estado === 'fora') return new Response('{}', { status: 504 });
    if (estado === 'trava') {
      return new Promise((_, rejeitar) =>
        opts?.signal?.addEventListener('abort', () => rejeitar(opts.signal.reason ?? new Error('abort')))
      );
    }
    return new Response(JSON.stringify(/\/deputados\/\d+$/.test(u) ? PERFIL_TABATA : LISTA));
  });
  return { chamadas, restaurar: () => (globalThis.fetch = original) };
}

// Gemini falso: `responder` é um texto, um objeto de resposta, um Error ou 'trava'.
export function mockGemini(responder) {
  const chamadas = [];
  _setClient({
    models: {
      generateContent: async (params) => {
        chamadas.push(params);
        const r = typeof responder === 'function' ? responder(params, chamadas.length) : responder;
        if (r === 'trava') return new Promise(() => {});
        if (r instanceof Error) throw r;
        return typeof r === 'string' ? { text: r } : r;
      },
    },
  });
  return chamadas;
}

export async function iniciar() {
  clearCache();
  _resetPausa();
  _resetOutros();
  _zerarLimites();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;
  return {
    base,
    async encerrar() {
      _setClient(undefined);
      _setCopia(undefined);
      await new Promise((r) => server.close(r));
    },
  };
}

export async function perguntar(base, pergunta) {
  const res = await fetch(`${base}/api/fatobot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pergunta }),
  });
  return { status: res.status, body: await res.json() };
}
