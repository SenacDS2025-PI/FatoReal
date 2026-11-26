// Ajustes da revisão do João (24/11): contador próprio, erros no log sem dados pessoais
// e "Supabase fora do ar" diferente de "sessão expirada".
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, pedir, supabaseFalso, TOKEN_ANA, TOKEN_MOD, USUARIOS } from './auth-ajuda.js';
import { mockCamara } from './ajuda.js';
import { erroDoServidor } from '../src/auth/middlewares.js';

let srv;
let camara;
beforeEach(async () => {
  srv = await iniciar();
  camara = mockCamara('ok');
});
afterEach(async () => {
  camara.restaurar();
  mock.restoreAll();
  await srv.encerrar();
  for (const v of ['LIMITE_CONTA_POR_IP_MIN', 'LIMITE_POR_IP_MIN']) delete process.env[v];
});

const perguntarFatobot = (ip) =>
  fetch(`${srv.base}/api/fatobot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ pergunta: 'oi tudo bem' }),
  });

// ---------- 1. Contador próprio ----------

test('passou do limite da área de conta → 429 com Retry-After', async () => {
  process.env.LIMITE_CONTA_POR_IP_MIN = '2';
  supabaseFalso();
  for (let i = 0; i < 2; i++) {
    assert.equal((await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.1.1.1' })).status, 200);
  }
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.1.1.1' });
  assert.equal(r.status, 429);
  assert.match(r.body.erro, /Muitos pedidos em pouco tempo/);
  assert.ok(Number(r.headers.get('retry-after')) > 0);
  // O /api/admin usa o mesmo contador da área de conta.
  assert.equal((await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD, ip: '10.1.1.1' })).status, 429);
  // Outro IP continua liberado.
  assert.equal((await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.1.1.2' })).status, 200);
});

test('gastar o limite da conta NÃO bloqueia o /api/fatobot', async () => {
  process.env.LIMITE_CONTA_POR_IP_MIN = '2';
  supabaseFalso();
  for (let i = 0; i < 3; i++) await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.2.2.2' });
  assert.equal((await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.2.2.2' })).status, 429);
  assert.equal((await perguntarFatobot('10.2.2.2')).status, 200);
});

test('gastar o limite do FatoBot NÃO bloqueia a área de conta', async () => {
  process.env.LIMITE_POR_IP_MIN = '1';
  supabaseFalso();
  assert.equal((await perguntarFatobot('10.3.3.3')).status, 200);
  assert.equal((await perguntarFatobot('10.3.3.3')).status, 429);
  assert.equal((await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '10.3.3.3' })).status, 200);
});

test('o padrão da área de conta aguenta uma sala de aula no mesmo IP (60/min)', async () => {
  supabaseFalso();
  for (let i = 0; i < 40; i++) {
    assert.equal((await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA, ip: '200.2.2.2' })).status, 200, `pedido ${i + 1}`);
  }
});

// ---------- 3. Supabase fora do ar ≠ sessão expirada ----------

test('erro de rede no getUser → 502 (e não 401)', async () => {
  mock.method(console, 'error', () => {});
  supabaseFalso({ erroGetUser: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } });
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 502);
  assert.match(r.body.erro, /Não foi possível conferir o login agora/);
});

test('Supabase respondendo 5xx no getUser → 502 (e não 401)', async () => {
  mock.method(console, 'error', () => {});
  supabaseFalso({ erroGetUser: { name: 'AuthApiError', status: 503, message: 'Service Unavailable' } });
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 502);
});

test('token inválido ou vencido continua 401', async () => {
  supabaseFalso({ erroGetUser: { name: 'AuthApiError', status: 401, message: 'invalid JWT' } });
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 401);
  assert.match(r.body.erro, /sessão expirou/);
});

test('erroDoServidor: separa erro do servidor/rede de erro do token', () => {
  assert.equal(erroDoServidor({ name: 'AuthRetryableFetchError', status: 0 }), true);
  assert.equal(erroDoServidor({ name: 'FetchError' }), true);
  assert.equal(erroDoServidor({ name: 'AuthApiError', status: 500 }), true);
  assert.equal(erroDoServidor({ name: 'AuthApiError', status: 401 }), false);
  assert.equal(erroDoServidor({ name: 'AuthSessionMissingError', status: 400 }), false);
  assert.equal(erroDoServidor(null), false);
});

// ---------- 2. Erros no log, sem dados pessoais ----------

const CASOS_DE_LOG = [
  ['exigirLogin', { erroGetUser: { name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' } }, '/api/conta/me', 'GET', TOKEN_ANA],
  ['exigirModerador', { falhaPerfil: true }, '/api/admin/metricas', 'GET', TOKEN_MOD],
  ['verMinhaConta', { falhaPerfil: true }, '/api/conta/me', 'GET', TOKEN_ANA],
  ['excluirMinhaConta', { falhaRpc: true }, '/api/conta', 'DELETE', TOKEN_ANA],
  ['metricas', { falhaContagem: 'denuncias:status=aberta' }, '/api/admin/metricas', 'GET', TOKEN_MOD],
];

for (const [funcao, opcoes, caminho, metodo, token] of CASOS_DE_LOG) {
  test(`falha em ${funcao} → registra no log sem token nem e-mail`, async () => {
    const log = mock.method(console, 'error', () => {});
    supabaseFalso(opcoes);
    const r = await pedir(srv.base, caminho, { token, metodo });
    assert.equal(r.status, 502);

    const linhas = log.mock.calls.map((c) => c.arguments.map(String).join(' '));
    assert.ok(linhas.some((l) => l.startsWith(`Auth (${funcao}):`)), `esperava "Auth (${funcao}): ..." no log, veio: ${linhas}`);
    const tudo = linhas.join('\n');
    assert.doesNotMatch(tudo, new RegExp(token));
    for (const { email } of Object.values(USUARIOS)) assert.ok(!tudo.includes(email), 'o e-mail apareceu no log');
    assert.doesNotMatch(tudo, /Bearer|authorization/i);
  });
}
