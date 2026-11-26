// GET /api/fontes — catálogo de fontes oficiais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from './ajuda.js';
import { FONTES_OFICIAIS, sugerirFontes } from '../src/data/fontes-oficiais.js';

test('catálogo: só https, sem repetir id, todo item com o que cobre', () => {
  const ids = new Set();
  for (const f of FONTES_OFICIAIS) {
    assert.match(f.url, /^https:\/\//, f.id);
    assert.match(f.url, /\.(gov|leg|jus)\.br|ebc\.com\.br/, `${f.id} precisa ser órgão público`);
    assert.ok(f.cobre && f.nome && f.orgao, f.id);
    assert.ok(['integrada', 'consulta'].includes(f.tipo), f.id);
    assert.ok(!ids.has(f.id), `id repetido: ${f.id}`);
    ids.add(f.id);
  }
});

test('sugestões por assunto', () => {
  assert.equal(sugerirFontes('a urna eletrônica tem fraude?')[0].nome, 'Fato ou Boato (Justiça Eleitoral)');
  assert.ok(sugerirFontes('qual a taxa selic hoje').some((f) => f.nome.includes('Banco Central')));
  assert.deepEqual(sugerirFontes('oi tudo bem'), []);
});

test('GET /api/fontes devolve o catálogo sem as palavras-chave internas', async () => {
  const srv = await iniciar();
  try {
    const res = await fetch(`${srv.base}/api/fontes`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.fontes.length, FONTES_OFICIAIS.length);
    assert.equal(body.fontes[0].palavras, undefined);
  } finally {
    await srv.encerrar();
  }
});
