// Service worker mínimo, só para habilitar a instalação do app na tela inicial.
// Propositalmente NÃO faz cache de páginas do sistema nem de chamadas de API:
// este é um sistema de PDV, e mostrar estoque/caixa desatualizado por causa de
// um cache seria pior do que não ter cache nenhum. Toda requisição passa direto
// para a rede.

const CACHE_ESTATICO = "pdv-estatico-v1";
const ARQUIVOS_ESTATICOS = ["/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICO).then((cache) => cache.addAll(ARQUIVOS_ESTATICOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE_ESTATICO).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Só serve do cache os arquivos estáticos do próprio app (ícones/manifest).
  // Tudo o mais — páginas, API — vai direto para a rede, sempre.
  if (ARQUIVOS_ESTATICOS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((res) => res || fetch(event.request)));
  }
});
