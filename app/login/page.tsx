"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BarraCarregamento, CruzIcone } from "@/components/CarregamentoCatolico";
import { AlertTriangle, Eye, EyeOff, Handshake, Lock, Package, ShieldCheck, ShoppingBag, User } from "lucide-react";

const CLASSE_INPUT =
  "w-full pl-10 pr-3 py-3 rounded-xl border border-border bg-surface text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition";

const DESTAQUES = [
  { icone: ShoppingBag, texto: "Vendas e caixa" },
  { icone: Package, texto: "Estoque" },
  { icone: Handshake, texto: "Consignados" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLigado, setCapsLigado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [mensagemEspera, setMensagemEspera] = useState("");

  // O backend (Render, plano free) hiberna depois de um tempo sem uso e pode
  // levar até ~1 minuto pra "acordar" na primeira requisição do dia. Sem essa
  // barra, a tela fica parada com só um spinner e parece travada. A barra
  // avança rápido no início e desacelera (nunca chega a 100% sozinha — só
  // quando a resposta do servidor realmente chegar), e a mensagem muda
  // conforme o tempo passa pra explicar o que está acontecendo.
  useEffect(() => {
    if (!carregando) {
      setProgresso(0);
      setMensagemEspera("");
      return;
    }
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      const segundos = (Date.now() - inicio) / 1000;
      setProgresso(Math.min(96, 100 * (1 - Math.exp(-segundos / 12))));
      if (segundos < 3) setMensagemEspera("Conectando...");
      else if (segundos < 10) setMensagemEspera("Autenticando...");
      else
        setMensagemEspera(
          "O servidor estava inativo e está iniciando — pode levar até 1 minuto na primeira vez do dia."
        );
    }, 200);
    return () => clearInterval(intervalo);
  }, [carregando]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(loginValue, senha);
    } catch (e) {
      // 429 = login bloqueado por muitas tentativas erradas: o servidor já manda
      // a mensagem pronta ("aguarde X minutos"), então mostramos ela em vez da genérica
      const resposta = (e as { response?: { status?: number; data?: { message?: string } } }).response;
      if (resposta?.status === 429 && resposta.data?.message) {
        setErro(resposta.data.message);
      } else if (!resposta || (resposta.status ?? 0) >= 500) {
        // sem resposta (rede/CORS/proxy) ou erro do servidor: não é senha errada
        setErro("Não foi possível conectar ao servidor. Aguarde um instante e tente de novo.");
      } else {
        setErro("Login ou senha inválidos.");
      }
      setCarregando(false);
    }
    // Em caso de sucesso o carregamento continua visível até a tela trocar
    // para o painel (o login chama router.push), sem "piscar" o botão.
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Faixa de marca no celular/tablet (no desktop vira o painel lateral) */}
      <div className="lg:hidden relative h-44 sm:h-56 shrink-0 overflow-hidden bg-primary-dark">
        <img
          src="/images/sao-miguel-arcanjo.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/50 to-primary-dark/10" />
        <div className="relative z-10 h-full flex items-end gap-3 px-6 pb-5">
          <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-accent shrink-0">
            <img src="/images/logo-loja.jpg" alt="Presente de Deus" className="w-full h-full object-cover" />
          </div>
          <div className="text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Loja</p>
            <p className="font-semibold text-lg leading-tight">Presente de Deus</p>
          </div>
        </div>
      </div>

      {/* Painel de marca (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary text-white flex-col justify-between p-12 relative overflow-hidden">
        <img
          src="/images/sao-miguel-arcanjo.jpg"
          alt="São Miguel Arcanjo"
          className="absolute inset-0 w-full h-full object-cover object-top opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-primary-dark/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/60 via-transparent to-transparent" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-accent shadow-lg">
            <img src="/images/logo-loja.jpg" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-lg tracking-tight">Presente de Deus</span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent mb-4">LOJA PRESENTE DE DEUS</p>
          <h1 className="text-4xl xl:text-5xl font-semibold leading-tight tracking-tight">
            Fé, tradição e cuidado em cada detalhe.
          </h1>
          <p className="mt-4 text-white/75 leading-relaxed">
            Gerencie vendas, estoque de imagens sacras, terços, livros e paramentos com controle total em tempo real.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li
                key={texto}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/15 px-3.5 py-1.5 text-xs font-medium text-white/90"
              >
                <Icone className="w-3.5 h-3.5 text-accent" />
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 font-mono text-xs text-white/50">
          <ShieldCheck className="w-3.5 h-3.5" />
          Acesso restrito &middot; uso interno
        </div>
      </div>

      {/* Painel de login */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-background px-5 sm:px-6 py-8 lg:py-12">
        {/* detalhes de fundo, só decorativos */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative w-full max-w-md rounded-2xl bg-surface/95 border border-border/70 shadow-xl shadow-primary/10 p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-tight">Entrar no sistema</h2>
              <p className="text-sm text-muted">Acesse o caixa da loja</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-foreground mb-1.5">
                Login
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="login"
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  className={CLASSE_INPUT}
                  placeholder="login"
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-foreground mb-1.5">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  onKeyDown={(e) => setCapsLigado(e.getModifierState("CapsLock"))}
                  onKeyUp={(e) => setCapsLigado(e.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLigado(false)}
                  className={`${CLASSE_INPUT} pr-11`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsLigado && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-dark">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Caps Lock está ligado
                </p>
              )}
            </div>

            {erro && (
              <div role="alert" className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2.5">
                {erro}
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-dark hover:brightness-110 text-white font-semibold py-3 rounded-xl shadow-md shadow-primary/25 transition disabled:opacity-60"
            >
              {carregando && <CruzIcone className="w-4 h-4 animate-pulse" />}
              {carregando ? "Entrando..." : "Entrar"}
            </button>

            {carregando && (
              <div className="space-y-1.5">
                <BarraCarregamento progresso={progresso} />
                <p className="text-xs text-muted text-center">{mensagemEspera}</p>
              </div>
            )}
          </form>

          <p className="mt-6 pt-5 border-t border-border/50 text-center font-mono text-[11px] text-muted flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acesso restrito &middot; uso interno
          </p>
        </div>
      </div>
    </div>
  );
}
