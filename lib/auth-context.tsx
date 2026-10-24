"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import api from "./api";
import { Usuario } from "./types";
import { atualizarUsuarioSalvo, lerToken, lerUsuarioSalvo, limparSessao, salvarSessao } from "./sessao";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (login: string, senha: string) => Promise<void>;
  trocarUsuario: (login: string, senha: string) => Promise<void>;
  /**
   * Pergunta ao servidor quem é o dono do token desta aba e corrige o usuário mostrado
   * se estiver diferente. Devolve o usuário confirmado, ou null se não deu para confirmar
   * (sem rede, servidor fora). Use antes de ações que gravam "quem fez" (ex.: abrir caixa).
   */
  revalidar: () => Promise<Usuario | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// não precisa perguntar ao servidor toda vez que a aba volta a ficar visível
const INTERVALO_MIN_REVALIDACAO_MS = 30_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();
  const usuarioRef = useRef<Usuario | null>(null);
  const ultimaRevalidacao = useRef(0);

  const aplicarUsuario = useCallback((novo: Usuario | null) => {
    usuarioRef.current = novo;
    setUsuario(novo);
  }, []);

  const revalidar = useCallback(async (): Promise<Usuario | null> => {
    if (!lerToken()) return null;
    try {
      const { data } = await api.get<Usuario>("/auth/me");
      ultimaRevalidacao.current = Date.now();
      const confirmado: Usuario = { login: data.login, nome: data.nome, perfil: data.perfil };
      const atual = usuarioRef.current;
      if (!atual || atual.login !== confirmado.login || atual.nome !== confirmado.nome || atual.perfil !== confirmado.perfil) {
        atualizarUsuarioSalvo(JSON.stringify(confirmado));
        aplicarUsuario(confirmado);
      }
      return confirmado;
    } catch {
      // 401 já é tratado pelo interceptor (limpa a sessão e vai para o login)
      return null;
    }
  }, [aplicarUsuario]);

  useEffect(() => {
    const stored = lerUsuarioSalvo();
    const token = lerToken();
    if (stored && token) {
      aplicarUsuario(JSON.parse(stored));
      // mostra a tela já com o usuário salvo e, em segundo plano, confere com o servidor
      void revalidar();
    }
    setCarregando(false);
  }, [aplicarUsuario, revalidar]);

  // ao voltar para a aba (ex.: depois de usar outra aba/janela), reconfere quem está logado
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== "visible") return;
      if (!usuarioRef.current) return;
      if (Date.now() - ultimaRevalidacao.current < INTERVALO_MIN_REVALIDACAO_MS) return;
      void revalidar();
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [revalidar]);

  async function autenticar(loginValue: string, senha: string) {
    const { data } = await api.post("/auth/login", { login: loginValue, senha });
    const usuarioLogado: Usuario = {
      login: data.login,
      nome: data.nome,
      perfil: data.perfil,
    };
    salvarSessao(data.token, JSON.stringify(usuarioLogado));
    ultimaRevalidacao.current = Date.now();
    aplicarUsuario(usuarioLogado);
  }

  async function login(loginValue: string, senha: string) {
    await autenticar(loginValue, senha);
    router.push("/inicio");
  }

  // Reautentica com outro usuário sem passar pela tela de login: mantém a
  // pessoa na tela em que já estava, só troca o token/usuário da sessão.
  async function trocarUsuario(loginValue: string, senha: string) {
    await autenticar(loginValue, senha);
  }

  function logout() {
    // avisa o servidor para marcar como offline na hora (best-effort)
    api.post("/presenca/sair").catch(() => {});
    limparSessao();
    aplicarUsuario(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, trocarUsuario, revalidar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
