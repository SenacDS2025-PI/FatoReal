// G6 — testes do G1 (exigirLogin / exigirModerador) e do G2 (cliente "como o usuário").
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, pedir, supabaseFalso, TOKEN_ANA, TOKEN_MOD } from './auth-ajuda.js';
import { _setFabrica } from '../src/auth/supabase-usuario.js';
import { tokenDe } from '../src/auth/middlewares.js';

let srv;
beforeEach(async () => {
  srv = await iniciar();
});
afterEach(async () => {
  await srv.encerrar();
});

test('sem o cabeçalho Authorization → 401', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me');
  assert.equal(r.status, 401);
  assert.match(r.body.erro, /Entre na sua conta/);
});

test('cabeçalho sem "Bearer" → 401 e nem chama o Supabase', async () => {
  const reg = supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me', { cabecalho: `Token ${TOKEN_ANA}` });
  assert.equal(r.status, 401);
  assert.equal(reg.tokens.length, 0);
});

test('token inválido ou vencido → 401', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me', { token: 'token-falso' });
  assert.equal(r.status, 401);
  assert.match(r.body.erro, /sessão expirou/);
});

test('Supabase fora do ar ao conferir o login → 502, sem expor detalhes', async () => {
  supabaseFalso({ falhaGetUser: true });
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 502);
  assert.doesNotMatch(r.texto, /rede caiu/);
});

test('sem Supabase configurado na API → 503', async () => {
  _setFabrica(undefined);
  const antes = { url: process.env.SUPABASE_URL, chave: process.env.SUPABASE_ANON_KEY };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
    assert.equal(r.status, 503);
  } finally {
    if (antes.url !== undefined) process.env.SUPABASE_URL = antes.url;
    if (antes.chave !== undefined) process.env.SUPABASE_ANON_KEY = antes.chave;
  }
});

test('G2: o cliente do Supabase é criado com o token de quem pediu', async () => {
  const reg = supabaseFalso();
  await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  await pedir(srv.base, '/api/conta/me', { token: TOKEN_MOD });
  assert.deepEqual(reg.tokens, [TOKEN_ANA, TOKEN_MOD]);
});

test('exigirModerador: usuário comum → 403', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_ANA });
  assert.equal(r.status, 403);
  assert.match(r.body.erro, /moderadores/);
});

test('exigirModerador: moderador passa', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD });
  assert.equal(r.status, 200);
});

test('exigirModerador: erro ao ler o perfil → 502 (não libera por engano)', async () => {
  supabaseFalso({ falhaPerfil: true });
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD });
  assert.equal(r.status, 502);
});

test('tokenDe: só aceita "Bearer <token>"', () => {
  assert.equal(tokenDe({ headers: { authorization: 'Bearer abc.def-123' } }), 'abc.def-123');
  assert.equal(tokenDe({ headers: { authorization: 'bearer abc' } }), 'abc');
  assert.equal(tokenDe({ headers: { authorization: 'Bearer ' } }), null);
  assert.equal(tokenDe({ headers: { authorization: 'Bearer a b' } }), null);
  assert.equal(tokenDe({ headers: {} }), null);
});
