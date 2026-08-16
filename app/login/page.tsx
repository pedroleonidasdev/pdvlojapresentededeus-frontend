"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2, Lock, User, Church } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(loginValue, senha);
    } catch {
      setErro("Login ou senha inválidos.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Painel de marca */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-primary-dark/40" />
        <div className="absolute -left-16 bottom-0 w-64 h-64 rounded-full bg-white/5" />

        <div className="relative z-10">
          <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center text-primary-dark">
            <Church className="w-5 h-5" />
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60 mb-4">
            LOJA PRESENTE DE DEUS
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Fé, tradição e cuidado em cada detalhe.
          </h1>
          <p className="mt-4 text-white/70 leading-relaxed">
            Gerencie vendas, estoque de imagens sacras, terços, livros e
            paramentos com controle total em tempo real.
          </p>
        </div>

        <div className="relative z-10 font-mono text-xs text-white/40">
          Acesso restrito &middot; uso interno
        </div>
      </div>

      {/* Painel de login */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white">
              <Church className="w-4 h-4" />
            </div>
            <span className="font-semibold text-lg">Casa da Fé</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Entrar no sistema
          </h2>
          <p className="mt-1 text-sm text-muted">
            Use seu login e senha para acessar o caixa da loja.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-foreground mb-1.5">
                Login
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="login"
                  type="text"
                  required
                  autoFocus
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  placeholder="seu.login"
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-foreground mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="senha"
                  type="password"
                  required
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-60"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}