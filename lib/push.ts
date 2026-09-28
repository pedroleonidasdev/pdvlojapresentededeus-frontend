import api from "@/lib/api";

// Converte a chave pública VAPID (base64url, como o backend fornece) para o
// formato Uint8Array que a Push API do navegador exige.
function base64UrlParaUint8Array(base64Url: string): Uint8Array {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bruto = atob(base64);
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

export function suportaNotificacaoPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** O app está rodando "instalado" (aberto pelo ícone, sem a barra do navegador)? */
function estaEmModoStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari/iOS antigo não tem display-mode, mas expõe essa propriedade própria
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Explica em texto por que o botão de notificação não está disponível neste
 * navegador — usado só pra mostrar uma mensagem útil em vez do botão
 * simplesmente sumir sem explicação nenhuma.
 */
export function motivoSemSuporte(): string {
  if (typeof window === "undefined") return "";
  if (!("serviceWorker" in navigator)) {
    return "Este navegador não tem suporte a notificações.";
  }
  if (ehIOS() && !estaEmModoStandalone()) {
    return "No iPhone, abra o app pelo ícone na Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início) — notificação só funciona assim, não numa aba do Safari.";
  }
  if (ehIOS()) {
    return "Seu iPhone precisa do iOS 16.4 ou mais novo. Se já estiver atualizado, remova o ícone da Tela de Início e adicione de novo pelo Safari.";
  }
  return "Este navegador não tem suporte a notificações push.";
}

/** Inscrição já existe E o navegador ainda tem permissão concedida? */
export async function estaInscrito(): Promise<boolean> {
  if (!suportaNotificacaoPush() || Notification.permission !== "granted") return false;
  const registro = await navigator.serviceWorker.ready;
  const inscricao = await registro.pushManager.getSubscription();
  return inscricao !== null;
}

/** Pede permissão (se preciso) e inscreve este navegador para receber notificações. */
export async function ativarNotificacoes(): Promise<void> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Notificações push não configuradas (faltando NEXT_PUBLIC_VAPID_PUBLIC_KEY).");
  }
  if (!suportaNotificacaoPush()) {
    throw new Error("Este navegador não tem suporte a notificações push.");
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    throw new Error("Permissão de notificação negada.");
  }

  const registro = await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      // cast necessário: a lib do TS tipa applicationServerKey como BufferSource,
      // e a variação de tipo do Uint8Array entre versões do TS não bate 1:1 com isso
      applicationServerKey: base64UrlParaUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  const json = inscricao.toJSON();
  await api.post("/notificacoes/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
}

/** Cancela a inscrição neste navegador (backend e navegador). */
export async function desativarNotificacoes(): Promise<void> {
  if (!suportaNotificacaoPush()) return;
  const registro = await navigator.serviceWorker.ready;
  const inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) return;

  const endpoint = inscricao.endpoint;
  await inscricao.unsubscribe();
  await api.delete("/notificacoes/subscribe", { params: { endpoint } });
}
