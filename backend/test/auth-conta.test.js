// G6 — testes do G3 (GET /api/conta/me e DELETE /api/conta).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, pedir, supabaseFalso, TOKEN_ANA, TOKEN_MOD } from './auth-ajuda.js';

let srv;
beforeEach(async () => {
  srv = await iniciar();
});
afterEach(async () => {
  await srv.encerrar();
});

test('GET /api/conta/me devolve o próprio perfil e o e-mail', async () => {
  const reg = supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 200);
  assert.equal(r.body.conta.id, 'u-ana');
  assert.equal(r.body.conta.nome, 'Ana (exemplo)');
  assert.equal(r.body.conta.email, 'ana@exemplo.com');
  assert.equal(r.body.conta.moderador, false);
  assert.equal('is_moderador' in r.body.conta, false);
  // Busca o perfil pelo id de quem está logado (não por algo vindo do pedido).
  const consulta = reg.consultas.find((c) => c.tabela === 'perfis');
  assert.deepEqual(consulta.filtros, ['id=u-ana']);
});

test('GET /api/conta/me de moderador marca moderador: true', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_MOD });
  assert.equal(r.body.conta.moderador, true);
});

test('GET /api/conta/me nunca devolve o token', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.doesNotMatch(r.texto, new RegExp(TOKEN_ANA));
});

test('GET /api/conta/me com erro no banco → 502', async () => {
  supabaseFalso({ falhaPerfil: true });
  const r = await pedir(srv.base, '/api/conta/me', { token: TOKEN_ANA });
  assert.equal(r.status, 502);
});

test('DELETE /api/conta chama excluir_minha_conta com o token da própria pessoa', async () => {
  const reg = supabaseFalso();
  const r = await pedir(srv.base, '/api/conta', { token: TOKEN_ANA, metodo: 'DELETE' });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.deepEqual(reg.rpc, [{ nome: 'excluir_minha_conta', token: TOKEN_ANA }]);
});

test('DELETE /api/conta sem login → 401 e não apaga nada', async () => {
  const reg = supabaseFalso();
  const r = await pedir(srv.base, '/api/conta', { metodo: 'DELETE' });
  assert.equal(r.status, 401);
  assert.equal(reg.rpc.length, 0);
});

test('DELETE /api/conta com erro no banco → 502', async () => {
  supabaseFalso({ falhaRpc: true });
  const r = await pedir(srv.base, '/api/conta', { token: TOKEN_ANA, metodo: 'DELETE' });
  assert.equal(r.status, 502);
  assert.match(r.body.erro, /Nada foi apagado/);
});
