"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import api from "./api";
import { Usuario } from "./types";
import { lerToken, lerUsuarioSalvo, limparSessao, salvarSessao } from "./sessao";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (login: string, senha: string) => Promise<void>;
  trocarUsuario: (login: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = lerUsuarioSalvo();
    const token = lerToken();
    if (stored && token) {
      setUsuario(JSON.parse(stored));
    }
    setCarregando(false);
  }, []);

  async function autenticar(loginValue: string, senha: string) {
    const { data } = await api.post("/auth/login", { login: loginValue, senha });
    const usuarioLogado: Usuario = {
      login: data.login,
      nome: data.nome,
      perfil: data.perfil,
    };
    salvarSessao(data.token, JSON.stringify(usuarioLogado));
    setUsuario(usuarioLogado);
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
    setUsuario(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, trocarUsuario, logout }}>
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
