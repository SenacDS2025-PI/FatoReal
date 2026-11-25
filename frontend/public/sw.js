// Service worker mínimo do Fato Real.
// Sempre tenta a internet primeiro (o site nunca fica desatualizado).
// Sem internet, usa a última cópia guardada das páginas e arquivos do próprio site.
const CACHE = 'fato-real-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  // Só guarda GET do próprio site; API e outros sites passam direto.
  if (pedido.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  evento.respondWith(
    fetch(pedido)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(pedido, copia));
        }
        return resposta;
      })
      .catch(() =>
        caches.match(pedido).then((guardada) =>
          guardada || (pedido.mode === 'navigate' ? caches.match('/') : Response.error())
        )
      )
  );
});
