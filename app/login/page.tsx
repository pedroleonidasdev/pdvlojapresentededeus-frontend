"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BarraCarregamento, CruzIcone } from "@/components/CarregamentoCatolico";
import { AlertTriangle, ArrowRight, Eye, EyeOff, Handshake, Lock, Package, ShieldCheck, ShoppingBag, User } from "lucide-react";

const CLASSE_INPUT =
  "w-full pl-11 pr-3 py-3.5 rounded-xl border border-border/80 bg-white/70 text-foreground placeholder:text-muted/60 shadow-inner shadow-primary/5 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary focus:bg-white transition";

// Grade fina (mesma das faixas do painel) usada como textura de fundo
const GRADE_FINA =
  "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)";

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
      <div className="lg:hidden relative h-48 sm:h-60 shrink-0 overflow-hidden bg-primary-dark">
        <img
          src="/images/sao-miguel-arcanjo.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/55 to-primary-dark/10" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/80 to-transparent" />
        <div className="relative z-10 h-full flex items-end gap-3 px-6 pb-6">
          <div className="p-[2px] rounded-full bg-gradient-to-br from-accent to-accent-dark shadow-lg shadow-accent/30 shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary-dark">
              <img src="/images/logo-loja.jpg" alt="Presente de Deus" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="text-white">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Livraria Católica</p>
            <p className="font-semibold text-xl leading-tight tracking-tight">Presente de Deus</p>
          </div>
        </div>
      </div>

      {/* Painel de marca (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-dark text-white flex-col justify-between p-12 xl:p-16 relative overflow-hidden">
        <img
          src="/images/sao-miguel-arcanjo.jpg"
          alt="São Miguel Arcanjo"
          className="absolute inset-0 w-full h-full object-cover object-top opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary-dark via-primary-dark/80 to-primary-dark/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary-dark/70 via-primary-dark/10 to-transparent" />
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: GRADE_FINA, backgroundSize: "32px 32px" }}
        />
        {/* brilho dourado, como uma luz de vela ao fundo */}
        <div aria-hidden className="login-orb absolute -bottom-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-accent/25 blur-3xl" />
        {/* fio dourado na divisa dos dois painéis */}
        <div aria-hidden className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent/70 to-transparent" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="p-[2px] rounded-full bg-gradient-to-br from-accent to-accent-dark shadow-lg shadow-accent/30">
            <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-primary-dark">
              <img src="/images/logo-loja.jpg" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="leading-tight">
            <span className="block font-semibold text-lg tracking-tight">Presente de Deus</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/55">
              Livraria Católica e Presentes
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-accent mb-5">
            <span aria-hidden className="h-px w-8 bg-accent/80" />
            LOJA PRESENTE DE DEUS
          </p>
          <h1 className="text-4xl xl:text-[3.4rem] font-semibold leading-[1.08] tracking-tight drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)]">
            Fé, tradição e{" "}
            <span className="bg-gradient-to-r from-accent-light via-accent to-accent-dark bg-clip-text text-transparent">
              cuidado em cada detalhe.
            </span>
          </h1>

          {/* ornamento: fio — cruz — fio */}
          <div aria-hidden className="mt-6 flex items-center gap-3">
            <span className="h-px w-16 bg-gradient-to-r from-accent/80 to-transparent" />
            <CruzIcone className="w-3.5 h-3.5 text-accent" />
            <span className="h-px flex-1 max-w-24 bg-gradient-to-r from-accent/40 to-transparent" />
          </div>

          <p className="mt-5 text-white/80 leading-relaxed">
            Gerencie vendas, estoque de imagens sacras, terços, livros e paramentos com controle total em tempo real.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {DESTAQUES.map(({ icone: Icone, texto }) => (
              <li
                key={texto}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 pl-1.5 pr-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-black/10"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-primary-dark">
                  <Icone className="w-3.5 h-3.5" strokeWidth={2.25} />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 font-mono text-xs text-white/55">
          <ShieldCheck className="w-3.5 h-3.5" />
          Acesso restrito &middot; uso interno
        </div>
      </div>

      {/* Painel de login */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center bg-background px-5 sm:px-6 py-10 lg:py-12">
        {/* fundo: degradê suave, pontinhos e luzes coloridas, só decorativos */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-info-light/60" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: "radial-gradient(rgba(27,77,62,0.10) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="login-orb pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="login-orb pointer-events-none absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-accent/20 blur-3xl [animation-delay:-7s]" />

        <div className="login-entra relative w-full max-w-md overflow-hidden rounded-3xl bg-surface/90 backdrop-blur-xl border border-white/80 ring-1 ring-border/50 shadow-[0_30px_70px_-25px_rgba(15,51,42,0.5)] p-7 sm:p-10">
          {/* barra de destaque no topo do cartão */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-primary" />

          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shrink-0 shadow-lg shadow-primary/40 ring-1 ring-white/30">
              <span aria-hidden className="absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/25 blur-[2px]" />
              <Lock className="relative w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-dark">Bem-vindo</p>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-tight">Entrar no sistema</h2>
              <p className="text-sm text-muted">Acesse o caixa da loja</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-foreground mb-1.5">
                Login
              </label>
              <div className="group relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted transition-colors group-focus-within:text-primary" />
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
              <div className="group relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted transition-colors group-focus-within:text-primary" />
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
                  className={`${CLASSE_INPUT} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted hover:text-foreground hover:bg-primary-soft transition"
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
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger-light text-danger text-sm px-3.5 py-3"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={carregando}
              className="group relative w-full overflow-hidden flex items-center justify-center gap-2 bg-gradient-to-r from-primary via-primary to-primary-dark text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-primary/30 ring-1 ring-white/10 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {/* brilho que atravessa o botão ao passar o mouse */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -translate-x-full skew-x-[-20deg] bg-white/20 transition-transform duration-700 ease-out group-hover:translate-x-[460%]"
              />
              {carregando && <CruzIcone className="relative w-4 h-4 animate-pulse" />}
              <span className="relative">{carregando ? "Entrando..." : "Entrar"}</span>
              {!carregando && (
                <ArrowRight className="relative w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={2.25} />
              )}
            </button>

            {carregando && (
              <div className="space-y-1.5">
                <BarraCarregamento progresso={progresso} />
                <p className="text-xs text-muted text-center">{mensagemEspera}</p>
              </div>
            )}
          </form>

          <p className="mt-7 pt-5 border-t border-border/40 text-center font-mono text-[11px] text-muted flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Acesso restrito &middot; uso interno
          </p>
        </div>

        <p className="relative mt-6 text-center font-mono text-[11px] tracking-wide text-muted/80">
          Presente de Deus &middot; Livraria Católica e Presentes
        </p>
      </div>
    </div>
  );
}
