"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import api from "./api";
import { Usuario } from "./types";

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  login: (login: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("pdv_user");
    const token = localStorage.getItem("pdv_token");
    if (stored && token) {
      setUsuario(JSON.parse(stored));
    }
    setCarregando(false);
  }, []);

  async function login(loginValue: string, senha: string) {
    const { data } = await api.post("/auth/login", { login: loginValue, senha });
    const usuarioLogado: Usuario = {
      login: data.login,
      nome: data.nome,
      perfil: data.perfil,
    };
    localStorage.setItem("pdv_token", data.token);
    localStorage.setItem("pdv_user", JSON.stringify(usuarioLogado));
    setUsuario(usuarioLogado);
    router.push("/pdv");
  }

  function logout() {
    localStorage.removeItem("pdv_token");
    localStorage.removeItem("pdv_user");
    setUsuario(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
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
