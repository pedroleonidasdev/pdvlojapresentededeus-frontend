/**
 * Ponte entre o chat (ChatSuporte) e os botões que o abrem (menu lateral e barra do celular).
 * O chat guarda aqui quantas mensagens não lidas existem e se está aberto; os botões leem esse
 * estado e, ao clicar, pedem para abrir/fechar o chat por um evento do navegador.
 */
export const EVENTO_ALTERNAR_CHAT = "pdv:alternar-chat";

export interface EstadoChat {
  naoLidas: number;
  aberto: boolean;
}

let estado: EstadoChat = { naoLidas: 0, aberto: false };
const ouvintes = new Set<() => void>();

/** Chamado pelo ChatSuporte sempre que o total de não lidas ou o "aberto" mudar. */
export function publicarEstadoChat(novo: EstadoChat): void {
  if (novo.naoLidas === estado.naoLidas && novo.aberto === estado.aberto) return;
  estado = novo;
  ouvintes.forEach((avisar) => avisar());
}

export function lerEstadoChat(): EstadoChat {
  return estado;
}

export const ESTADO_CHAT_SERVIDOR: EstadoChat = { naoLidas: 0, aberto: false };

export function assinarEstadoChat(aoMudar: () => void): () => void {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

/** Abre o chat (ou fecha, se já estiver aberto). */
export function alternarChat(): void {
  window.dispatchEvent(new Event(EVENTO_ALTERNAR_CHAT));
}
