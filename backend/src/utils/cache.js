// Cache simples em memória, com tempo de expiração.
// Na Vercel cada instância tem o seu cache; serve para não repetir chamadas lentas à Câmara.
const store = new Map();

export async function cached(key, ttlMs, loader) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function clearCache() {
  store.clear();
}
