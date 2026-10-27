/**
 * Login guardado POR ABA (sessionStorage), para dar para entrar com usuários
 * diferentes em abas diferentes do mesmo navegador sem um derrubar o outro.
 *
 * O localStorage guarda o "último login" só para uso interno (ex.: notificações push);
 * uma aba nova NÃO o herda — precisa entrar com usuário e senha.
 *
 * Regras que mantêm "quem aparece logado" == "dono do token enviado ao servidor":
 *  1. Token e usuário SEMPRE são lidos/copiados como um par. Nunca se mistura o
 *     token de um lado com o nome do outro.
 *  2. Nenhuma aba herda o login de outra: só tem sessão quem entrou nela.
 */
const CHAVE_TOKEN = "pdv_token";
const CHAVE_USUARIO = "pdv_user";
// marca, só nesta aba, que ela saiu (mantida por compatibilidade)
const CHAVE_SAIU = "pdv_aba_saiu";

interface Sessao {
  token: string | null;
  usuario: string | null;
}

const SEM_SESSAO: Sessao = { token: null, usuario: null };

function resolverSessao(): Sessao {
  try {
    const tokenAba = sessionStorage.getItem(CHAVE_TOKEN);
    const usuarioAba = sessionStorage.getItem(CHAVE_USUARIO);

    if (tokenAba !== null && usuarioAba !== null) {
      return { token: tokenAba, usuario: usuarioAba };
    }

    // par incompleto nesta aba: estado inconsistente, não dá para confiar em quem é o usuário
    if (tokenAba !== null || usuarioAba !== null) {
      sessionStorage.removeItem(CHAVE_TOKEN);
      sessionStorage.removeItem(CHAVE_USUARIO);
      return SEM_SESSAO;
    }

    // Aba nova (ou app reaberto) NÃO herda o login de outra aba: cada pessoa precisa entrar
    // com o próprio usuário. Antes, a aba nova herdava o "último login" do navegador, e quem
    // abria o sistema sem perceber operava (e abria o caixa) como o usuário anterior.
    return SEM_SESSAO;
  } catch {
    return SEM_SESSAO;
  }
}

export function lerToken(): string | null {
  return resolverSessao().token;
}

export function lerUsuarioSalvo(): string | null {
  return resolverSessao().usuario;
}

export function salvarSessao(token: string, usuarioJson: string): void {
  try {
    sessionStorage.removeItem(CHAVE_SAIU);
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
 * Corrige o usuário salvo desta aba (quando o servidor disser que o dono do token
 * é outro). O "último login" do localStorage só é tocado se ainda for o desta aba.
 */
export function atualizarUsuarioSalvo(usuarioJson: string): void {
  try {
    const meuToken = sessionStorage.getItem(CHAVE_TOKEN);
    sessionStorage.setItem(CHAVE_USUARIO, usuarioJson);
    if (meuToken !== null && localStorage.getItem(CHAVE_TOKEN) === meuToken) {
      localStorage.setItem(CHAVE_USUARIO, usuarioJson);
    }
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
    sessionStorage.setItem(CHAVE_SAIU, "1");
    if (meuToken === null || localStorage.getItem(CHAVE_TOKEN) === meuToken) {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
    }
  } catch {
    // ver salvarSessao
  }
}
