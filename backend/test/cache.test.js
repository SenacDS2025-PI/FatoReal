import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cached, clearCache } from '../src/utils/cache.js';

test('reaproveita a última resposta boa quando a fonte falha', async () => {
  clearCache();
  assert.equal(await cached('k', 0, async () => 'v1'), 'v1'); // ttl 0 = vence na hora
  const v = await cached('k', 0, async () => {
    throw new Error('fora do ar');
  });
  assert.equal(v, 'v1');
});

test('sem versão anterior, o erro é repassado', async () => {
  clearCache();
  await assert.rejects(
    cached('novo', 1000, async () => {
      throw new Error('fora do ar');
    })
  );
});
