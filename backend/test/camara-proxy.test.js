// Proxy da Câmara: GET /api/camara/<caminho>?<query> (fetch falso, sem internet)
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './ajuda.js';

const CAMARA = 'https://dadosabertos.camara.leg.br/api/v2';
let srv;
let original;
let pedidos; // pedidos que chegaram à "Câmara"
let responder; // (url) => Response | 'trava' | Error

beforeEach(async () => {
  srv = await iniciar();
  pedidos = [];
  responder = () => new Response(JSON.stringify({ dados: { id: 221328, nome: 'Adilson Barroso' } }), { status: 200 });
  original = globalThis.fetch;
  globalThis.fetch = mock.fn(async (url, opts) => {
    const u = String(url);
    if (!u.startsWith(CAMARA)) return original(url, opts);
    pedidos.push({ url: u, accept: new Headers(opts?.headers).get('accept') });
    const r = responder(u);
    if (r === 'trava') {
      return new Promise((_, rejeitar) => opts?.signal?.addEventListener('abort', () => rejeitar(new Error('abort'))));
    }
    if (r instanceof Error) throw r;
    return r;
  });
});
afterEach(async () => {
  globalThis.fetch = original;
  delete process.env.LIMITE_CAMARA_POR_IP_MIN;
  await srv.encerrar();
});

const pedir = (caminho, opts) => fetch(`${srv.base}/api/camara/${caminho}`, opts);

test('caminho permitido: repassa o corpo e o status, com Accept: application/json', async () => {
  const res = await pedir('deputados/221328');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { dados: { id: 221328, nome: 'Adilson Barroso' } });
  assert.equal(res.headers.get('cache-control'), 'public, max-age=600, s-maxage=3600', 'a Vercel guarda por 1 h');
  assert.equal(pedidos[0].url, `${CAMARA}/deputados/221328`);
  assert.equal(pedidos[0].accept, 'application/json');
});

test('status diferente de 200 da Câmara é repassado igual (e não vai para o cache)', async () => {
  responder = () => new Response(JSON.stringify({ status: 404, title: 'Não encontrado' }), { status: 404 });
  const res = await pedir('deputados/999999999');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { status: 404, title: 'Não encontrado' });
  assert.equal(res.headers.get('cache-control'), 'no-store');
  await pedir('deputados/999999999');
  assert.equal(pedidos.length, 2, 'o 404 não ficou no cache');
});

test('query string é repassada como veio', async () => {
  await pedir('deputados/221328/despesas?ano=2026&itens=100&ordem=DESC&ordenarPor=dataDocumento');
  assert.equal(pedidos[0].url, `${CAMARA}/deputados/221328/despesas?ano=2026&itens=100&ordem=DESC&ordenarPor=dataDocumento`);
});

test('os 4 começos permitidos funcionam, inclusive id de votação com hífen', async () => {
  for (const c of ['deputados', 'proposicoes/2345678', 'votacoes/2265603-43/votos', 'eventos/12345/pauta']) {
    assert.equal((await pedir(c)).status, 200, c);
  }
});

test('caminho proibido → 400 e nada é pedido à Câmara', async () => {
  for (const c of ['partidos', 'blocos/1', 'deputados/%2e%2e', 'deputados/%2F..%2Foutra', 'deputados/1.json', '']) {
    const res = await pedir(c);
    assert.equal(res.status, 400, c);
    assert.deepEqual(await res.json(), { erro: 'Caminho não permitido.' });
  }
  assert.equal(pedidos.length, 0);
});

test('"../" nunca chega à Câmara (o caminho é normalizado antes e a regex recusa ".")', async () => {
  const res = await pedir('deputados/../../outra');
  assert.ok([400, 404].includes(res.status));
  assert.equal(pedidos.length, 0);
  const { CAMINHO_PERMITIDO } = await import('../src/routes/camara.js');
  assert.equal(CAMINHO_PERMITIDO.test('deputados/../outra'), false);
  assert.equal(CAMINHO_PERMITIDO.test('deputados//1'), false);
  assert.equal(CAMINHO_PERMITIDO.test('deputados/221328/historico'), true);
});

test('só GET', async () => {
  const res = await pedir('deputados/221328', { method: 'POST' });
  assert.equal(res.status, 405);
  assert.equal(pedidos.length, 0);
});

test('Câmara fora do ar (erro de rede) → 502', async () => {
  responder = () => new Error('ECONNRESET');
  const res = await pedir('deputados/1');
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { erro: 'A Câmara não respondeu. Tente de novo em instantes.' });
});

test('Câmara respondendo HTML de erro (504) → 502', async () => {
  responder = () => new Response('<html>Gateway Timeout</html>', { status: 504 });
  assert.equal((await pedir('deputados/2')).status, 502);
});

test('Câmara que não responde: desiste no prazo e dá 502', { timeout: 15_000 }, async () => {
  responder = () => 'trava';
  const inicio = Date.now();
  const res = await pedir('deputados/3');
  assert.equal(res.status, 502);
  assert.ok(Date.now() - inicio < 10_000, 'respeita o prazo de ~8 s');
});

test('segunda chamada vem do cache', async () => {
  await pedir('deputados/221328/historico');
  const res = await pedir('deputados/221328/historico');
  assert.equal(res.status, 200);
  assert.equal(pedidos.length, 1);
  await pedir('deputados/221328/historico?itens=5');
  assert.equal(pedidos.length, 2, 'query diferente = outra chave no cache');
});

test('limite por IP próprio do proxy → 429', async () => {
  process.env.LIMITE_CAMARA_POR_IP_MIN = '2';
  const h = { headers: { 'X-Forwarded-For': '10.1.1.1' } };
  assert.equal((await pedir('deputados/10', h)).status, 200);
  assert.equal((await pedir('deputados/11', h)).status, 200);
  const res = await pedir('deputados/12', h);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
});

test('Câmara responde 429 → repasse devolve 429 com Retry-After: 10 (não 502), sem cache', async () => {
  responder = () => new Response('<html>Too Many Requests</html>', { status: 429 });
  const res = await pedir('deputados/221328/orgaos');
  assert.equal(res.status, 429);
  assert.equal(res.headers.get('retry-after'), '10');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.match((await res.json()).erro, /pausa/);
  await pedir('deputados/221328/orgaos');
  assert.equal(pedidos.length, 2, 'o 429 não ficou no cache');
});
