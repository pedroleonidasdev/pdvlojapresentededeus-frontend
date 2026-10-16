/**
 * Login guardado POR ABA (sessionStorage), para dar para entrar com usuários
 * diferentes em abas diferentes do mesmo navegador sem um derrubar o outro.
 *
 * O localStorage continua guardando o "último login" só para uma aba nova (ou
 * o app reaberto) começar já logada: ao abrir, a aba copia esse login para a
 * sua própria sessão e, daí em diante, não é mais afetada pelas outras abas.
 */
const CHAVE_TOKEN = "pdv_token";
const CHAVE_USUARIO = "pdv_user";

function ler(chave: string): string | null {
  try {
    const daAba = sessionStorage.getItem(chave);
    if (daAba !== null) return daAba;
    const ultimo = localStorage.getItem(chave);
    if (ultimo !== null) sessionStorage.setItem(chave, ultimo); // aba nova herda o último login
    return ultimo;
  } catch {
    return null;
  }
}

export function lerToken(): string | null {
  return ler(CHAVE_TOKEN);
}

export function lerUsuarioSalvo(): string | null {
  return ler(CHAVE_USUARIO);
}

export function salvarSessao(token: string, usuarioJson: string): void {
  try {
    sessionStorage.setItem(CHAVE_TOKEN, token);
    sessionStorage.setItem(CHAVE_USUARIO, usuarioJson);
    localStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_USUARIO, usuarioJson);
  } catch {
    // armazenamento bloqueado: o login vale só até recarregar
  }
}

/** Troca só o token (ex.: depois de "encerrar sessões"), mantendo o usuário da aba. */
export function atualizarToken(token: string): void {
  try {
    sessionStorage.setItem(CHAVE_TOKEN, token);
    localStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    // ver salvarSessao
  }
}

/**
 * Sai desta aba. O "último login" do localStorage só é apagado se for o desta
 * própria aba, para não derrubar quem entrou depois em outra aba.
 */
export function limparSessao(): void {
  try {
    const meuToken = sessionStorage.getItem(CHAVE_TOKEN);
    sessionStorage.removeItem(CHAVE_TOKEN);
    sessionStorage.removeItem(CHAVE_USUARIO);
    if (meuToken === null || localStorage.getItem(CHAVE_TOKEN) === meuToken) {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
    }
  } catch {
    // ver salvarSessao
  }
}
