import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { limitarPorIp } from '../src/utils/limite.js';

test('bloqueia com 429 depois do máximo de pedidos e libera quando a janela acaba', async () => {
  const app = express();
  app.get('/x', limitarPorIp({ janelaMs: 200, max: 2 }), (req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const url = `http://localhost:${server.address().port}/x`;

  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const bloqueado = await fetch(url);
    assert.equal(bloqueado.status, 429);
    assert.ok(bloqueado.headers.get('retry-after'));
    assert.match((await bloqueado.json()).erro, /Espere/);

    await new Promise((r) => setTimeout(r, 250));
    assert.equal((await fetch(url)).status, 200);
  } finally {
    server.close();
  }
});
