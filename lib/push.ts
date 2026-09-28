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

// --- Config compartilhada com o service worker via IndexedDB -------------
// O navegador pode renovar a inscrição push sozinho a qualquer momento (evento
// "pushsubscriptionchange"), inclusive com o app fechado — nesse caso é o
// próprio service worker (sw.js) que precisa recriar a inscrição e avisar o
// backend, sem depender de nenhuma aba aberta. Só que o service worker não
// tem acesso ao localStorage nem ao axios da página, então guardamos aqui
// (nessa mesma origem, lida também pelo sw.js) o token atual, a URL da API e
// a chave VAPID, toda vez que o app abre — assim o service worker sempre tem
// o que precisa à mão, mesmo acordando sozinho em segundo plano.
const NOME_BANCO_CONFIG = "pdv-notificacoes";
const NOME_TABELA_CONFIG = "config";

function abrirBancoConfig(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO_CONFIG, 1);
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(NOME_TABELA_CONFIG);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function salvarConfig(chave: string, valor: string): Promise<void> {
  const banco = await abrirBancoConfig();
  await new Promise<void>((resolve, reject) => {
    const transacao = banco.transaction(NOME_TABELA_CONFIG, "readwrite");
    transacao.objectStore(NOME_TABELA_CONFIG).put(valor, chave);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}

/**
 * Atualiza, no IndexedDB, o token de login atual, a URL da API e a chave
 * VAPID — pro service worker conseguir se reinscrever e avisar o backend
 * sozinho caso a inscrição seja renovada pelo navegador em segundo plano.
 * Best-effort: se falhar (navegador sem IndexedDB, aba anônima restrita
 * etc.), não afeta o funcionamento normal do app nem das notificações em
 * primeiro plano.
 */
async function atualizarConfigServiceWorker(): Promise<void> {
  try {
    const token = localStorage.getItem("pdv_token");
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const apiUrl = api.defaults.baseURL;
    if (token) await salvarConfig("token", token);
    if (apiUrl) await salvarConfig("apiUrl", apiUrl);
    if (vapidPublicKey) await salvarConfig("vapidPublicKey", vapidPublicKey);
  } catch {
    // best-effort — ver comentário acima
  }
}

async function enviarInscricaoAoBackend(inscricao: PushSubscription): Promise<void> {
  const json = inscricao.toJSON();
  await api.post("/notificacoes/subscribe", {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  });
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

  await enviarInscricaoAoBackend(inscricao);
  await atualizarConfigServiceWorker();
}

/**
 * Reconfirma com o backend a inscrição que o navegador já tem — sem pedir
 * permissão de novo e sem lançar erro. Chamada silenciosamente toda vez que
 * o app abre (ver NotificacoesPushButton), pra "curar" o caso mais comum de
 * notificação parar de chegar: o backend apagou o registro (ex.: recebeu um
 * 404/410 do provedor) mas o navegador continua achando que está inscrito.
 * Como o /subscribe do backend faz upsert por endpoint, reenviar é sempre
 * seguro, mesmo quando já está tudo certo.
 */
export async function sincronizarInscricao(): Promise<void> {
  if (!suportaNotificacaoPush() || Notification.permission !== "granted") return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.getSubscription();
    if (inscricao) await enviarInscricaoAoBackend(inscricao);
    await atualizarConfigServiceWorker();
  } catch {
    // best-effort — se falhar, tenta de novo na próxima vez que o app abrir
  }
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
