// Cache simples em memória, com tempo de expiração.
// Na Vercel cada instância tem o seu cache; serve para não repetir chamadas lentas à Câmara.
//
// Se a fonte falhar ao renovar um item vencido, devolve a última versão boa
// (com a data original da consulta), em vez de mostrar erro ao usuário.
const store = new Map();

export async function cached(key, ttlMs, loader) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  try {
    const value = await loader();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

export function clearCache() {
  store.clear();
}
