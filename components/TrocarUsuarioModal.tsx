"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/auth-context";
import { X, Loader2, UserCog } from "lucide-react";

/**
 * Permite trocar de usuário logado sem precisar sair do sistema e refazer
 * login pela tela inicial. Pede login e senha do usuário que vai assumir a
 * sessão e reautentica em segundo plano, mantendo a pessoa na tela atual.
 *
 * Renderizado via portal em document.body: o botão que abre este modal fica
 * dentro da sidebar (que define text-white, sticky e overflow-hidden para o
 * próprio menu), e se o modal fosse montado ali dentro ele herdaria esses
 * estilos — texto invisível, cliques bloqueados, layout quebrado. O portal
 * tira o modal dessa árvore e o coloca direto no body, isolado.
 */
export default function TrocarUsuarioModal({ onFechar }: { onFechar: () => void }) {
  const { trocarUsuario } = useAuth();
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [trocando, setTrocando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setTrocando(true);
    setErro(null);
    try {
      await trocarUsuario(loginValue.trim(), senha);
      onFechar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Login ou senha inválidos.";
      setErro(msg);
    } finally {
      setTrocando(false);
    }
  }

  const faltaPreencher = !loginValue.trim() || !senha;

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 text-foreground">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="flex items-center gap-2 font-semibold text-sm text-foreground">
            <UserCog className="w-4 h-4" />
            Trocar usuário
          </h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-muted">
            Informe o login e a senha do usuário que vai assumir o sistema. A sessão atual será substituída.
          </p>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Login</label>
            <input
              type="text"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !faltaPreencher && confirmar()}
              className="input w-full"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !faltaPreencher && confirmar()}
              className="input w-full"
              autoComplete="off"
            />
          </div>

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-background transition"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={trocando || faltaPreencher}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {trocando && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
