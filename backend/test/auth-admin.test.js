// G6 — testes do G4 (GET /api/admin/metricas).
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

test('moderador recebe os totais do site', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.metricas, {
    usuarios: 42,
    comunidades: 10,
    publicacoes: 120,
    publicacoesRemovidas: 3,
    denunciasAbertas: 5,
  });
  assert.ok(!Number.isNaN(Date.parse(r.body.geradoEm)));
});

test('as contagens usam count sem baixar as linhas e os filtros certos', async () => {
  const reg = supabaseFalso();
  await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD });
  const contagens = reg.consultas.filter((c) => c.contar);
  assert.equal(contagens.length, 5);
  const chaves = contagens.map((c) => [c.tabela, ...c.filtros].join(':')).sort();
  assert.deepEqual(chaves, [
    'comunidades',
    'denuncias:status=aberta',
    'perfis',
    'publicacoes:removida=false',
    'publicacoes:removida=true',
  ]);
});

test('usuário comum não vê as métricas (403)', async () => {
  const reg = supabaseFalso();
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_ANA });
  assert.equal(r.status, 403);
  assert.equal(reg.consultas.filter((c) => c.contar).length, 0);
});

test('sem login → 401', async () => {
  supabaseFalso();
  const r = await pedir(srv.base, '/api/admin/metricas');
  assert.equal(r.status, 401);
});

test('se uma contagem falhar → 502', async () => {
  supabaseFalso({ falhaContagem: 'denuncias:status=aberta' });
  const r = await pedir(srv.base, '/api/admin/metricas', { token: TOKEN_MOD });
  assert.equal(r.status, 502);
});
