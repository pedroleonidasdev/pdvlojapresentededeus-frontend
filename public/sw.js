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

// --- Notificações push (venda registrada / caixa aberto / caixa fechado) ---
// O backend manda um payload JSON simples: { titulo, corpo, url }.
self.addEventListener("push", (event) => {
  let dados = { titulo: "Sistema de Gestão", corpo: "Você tem uma nova notificação.", url: "/inicio" };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    // payload não veio em JSON (não deveria acontecer) — usa os valores padrão acima
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url || "/inicio" },
    })
  );
});

// Ao clicar na notificação: foca uma aba já aberta do sistema (navegando pra
// URL certa) ou abre uma nova, se não houver nenhuma aberta.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/inicio", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(destino);
          return client.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
