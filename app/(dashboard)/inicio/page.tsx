"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Lock,
  Moon,
  QrCode,
  Receipt,
  ShoppingBag,
  Sun,
  Sunrise,
  Unlock,
  UserRound,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BarraCarregamento } from "@/components/CarregamentoCatolico";
import EditarAberturaCaixa from "@/components/EditarAberturaCaixa";
import { NAV_ITEMS } from "@/lib/nav-items";
import { Caixa, Consignacao, Produto, Venda } from "@/lib/types";
import {
  dataBrasiliaISO,
  formatarDataHora,
  formatarMoeda,
  horasDesde,
  LABEL_FORMA_PAGAMENTO,
  limiteDiaBrasiliaParaUtc,
} from "@/lib/format";

// Cor de destaque de cada atalho — usa os mesmos tokens de cor do resto do
// sistema (ver app/globals.css), só escolhendo qual delas cada área usa.
const CORES: Record<string, { bg: string; anel: string; brilho: string }> = {
  "/trocas": { bg: "bg-gradient-to-br from-info to-info-dark", anel: "hover:ring-info/60", brilho: "shadow-info/40" },
  "/consignados": { bg: "bg-gradient-to-br from-primary to-primary-dark", anel: "hover:ring-primary/60", brilho: "shadow-primary/40" },
  "/vendas": { bg: "bg-gradient-to-br from-secondary to-secondary-dark", anel: "hover:ring-secondary/60", brilho: "shadow-secondary/40" },
  "/fechar-caixa": { bg: "bg-gradient-to-br from-accent to-accent-dark", anel: "hover:ring-accent/60", brilho: "shadow-accent/40" },
  "/reabrir-caixa": { bg: "bg-gradient-to-br from-danger to-danger/70", anel: "hover:ring-danger/60", brilho: "shadow-danger/40" },
  "/estoque": { bg: "bg-gradient-to-br from-success to-success/70", anel: "hover:ring-success/60", brilho: "shadow-success/40" },
  "/categorias": { bg: "bg-gradient-to-br from-secondary to-secondary-dark", anel: "hover:ring-secondary/60", brilho: "shadow-secondary/40" },
  "/relatorios": { bg: "bg-gradient-to-br from-info to-info-dark", anel: "hover:ring-info/60", brilho: "shadow-info/40" },
  "/financas": { bg: "bg-gradient-to-br from-accent to-accent-dark", anel: "hover:ring-accent/60", brilho: "shadow-accent/40" },
  "/usuarios": { bg: "bg-gradient-to-br from-primary to-primary-dark", anel: "hover:ring-primary/60", brilho: "shadow-primary/40" },
};

// Ícone e cor de cada forma de pagamento na lista de últimas vendas
const PAGAMENTO_VISUAL: Record<string, { icon: LucideIcon; classe: string }> = {
  PIX: { icon: QrCode, classe: "bg-success-light text-success" },
  DINHEIRO: { icon: Banknote, classe: "bg-accent-light text-accent-dark" },
  CARTAO_CREDITO: { icon: CreditCard, classe: "bg-info-light text-info" },
  CARTAO_DEBITO: { icon: CreditCard, classe: "bg-info-light text-info" },
};
const PAGAMENTO_PADRAO = { icon: Receipt, classe: "bg-primary-light text-primary" };

// Vidro + sombra suave usados em todos os cartões da tela
const CARTAO_VIDRO =
  "bg-surface/90 backdrop-blur border border-white/70 ring-1 ring-border/40 shadow-[0_10px_30px_-14px_rgba(15,51,42,0.45)]";

// Seção de cada atalho (as mesmas do menu lateral). Fica aqui na própria página,
// sem depender de campo extra no NAV_ITEMS.
const GRUPO_POR_ROTA: Record<string, string> = {
  "/trocas": "Operação",
  "/consignados": "Operação",
  "/vendas": "Caixa",
  "/fechar-caixa": "Caixa",
  "/reabrir-caixa": "Caixa",
  "/estoque": "Gestão",
  "/categorias": "Gestão",
  "/relatorios": "Gestão",
  "/financas": "Gestão",
  "/usuarios": "Gestão",
};

interface Resumo {
  /** undefined = não deu para consultar (não mostra um estado errado); null = caixa fechado */
  caixa: Caixa | null | undefined;
  vendas: Venda[] | null;
  produtos: Produto[] | null;
  consignacoes: Consignacao[] | null;
}

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 5) return "Boa madrugada";
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function dataPorExtenso(): string {
  const texto = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "HH:mm" de um horário vindo do backend (já convertido para Brasília). */
function horaCurta(iso: string): string {
  return formatarDataHora(iso).slice(-5);
}

/**
 * Carregamento de um cartão: a mesma barra de terço do resto do sistema. As contas acendem
 * conforme o servidor vai respondendo as consultas (progresso real, não de enfeite) e, se
 * o servidor demorar (ex.: acordando depois de um tempo parado), a frase avisa.
 */
function CarregandoCartao({
  mensagem,
  progresso,
  demorando = false,
}: {
  mensagem: string;
  progresso: number;
  demorando?: boolean;
}) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
      <BarraCarregamento progresso={progresso} />
      <p className="text-xs text-muted">
        {demorando ? "O servidor está acordando — pode levar até 1 minuto…" : mensagem}
      </p>
    </div>
  );
}

/** Relógio de Brasília (HH:mm). Começa vazio e só preenche no navegador, para não divergir do servidor. */
function Relogio() {
  const [agora, setAgora] = useState<string | null>(null);
  useEffect(() => {
    const atualizar = () =>
      setAgora(
        new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(
          new Date()
        )
      );
    atualizar();
    const intervalo = setInterval(atualizar, 15_000);
    return () => clearInterval(intervalo);
  }, []);
  const [hora, minuto] = (agora ?? "--:--").split(":");
  return (
    <span className="font-mono text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight" aria-label={agora ?? undefined}>
      {hora}
      <span className="animate-pulse text-accent-light/80">:</span>
      {minuto}
    </span>
  );
}

/** Ícone do período do dia, acompanhando a saudação (madrugada/noite = lua, manhã = nascer do sol, tarde = sol). */
function PeriodoIcon({ className }: { className?: string }) {
  const hora = new Date().getHours();
  const Icone = hora < 5 || hora >= 18 ? Moon : hora < 12 ? Sunrise : Sun;
  return <Icone aria-hidden className={className} />;
}

/**
 * Indicador da faixa de comando: título pequeno, valor em destaque e uma linha de detalhe.
 * Todos têm a mesma altura e o mesmo formato, então a faixa se lê da esquerda para a direita.
 */
function IndicadorHero({
  icone,
  titulo,
  valor,
  detalhe,
  tom = "neutro",
  pulsar = false,
  href,
  acao,
  dica,
  className = "",
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  tom?: "neutro" | "sucesso" | "perigo" | "alerta";
  pulsar?: boolean;
  href?: string;
  /** Botão extra à direita (ex.: lápis para corrigir o valor). Só em indicador sem link. */
  acao?: React.ReactNode;
  /** Texto completo ao passar o mouse. */
  dica?: string;
  className?: string;
}) {
  const estilo = {
    neutro: {
      caixa: "border-white/15 from-white/15 to-white/[0.04]",
      icone: "from-white/30 to-white/10 text-white",
      valor: "text-white",
    },
    sucesso: {
      caixa: "border-emerald-300/35 from-emerald-400/25 to-emerald-400/[0.04]",
      icone: "from-emerald-300/55 to-emerald-500/20 text-emerald-50",
      valor: "text-emerald-50",
    },
    perigo: {
      caixa: "border-red-300/35 from-red-400/25 to-red-400/[0.04]",
      icone: "from-red-300/55 to-red-500/20 text-red-50",
      valor: "text-red-50",
    },
    alerta: {
      caixa: "border-amber-300/45 from-amber-400/25 to-amber-400/[0.04]",
      icone: "from-amber-300/60 to-amber-500/20 text-amber-50",
      valor: "text-amber-50",
    },
  }[tom];
  const classe = `group relative flex min-w-0 items-center gap-2 rounded-xl border bg-gradient-to-br px-2.5 py-2 shadow-lg shadow-black/10 ring-1 ring-inset ring-white/5 backdrop-blur ${estilo.caixa} ${
    href ? "hover:from-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition" : ""
  } ${className}`;
  const conteudo = (
    <>
      <span
        className={`relative hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-white/20 sm:flex ${estilo.icone}`}
      >
        {icone}
        {pulsar && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 ring-2 ring-primary-dark" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/55">
          {pulsar && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-300 sm:hidden" />}
          {titulo}
        </span>
        <span className={`block break-words text-sm font-bold tabular-nums sm:truncate sm:text-[15px] ${estilo.valor}`}>
          {valor}
        </span>
        <span className="block break-words text-[10.5px] text-white/60 sm:truncate">{detalhe}</span>
      </span>
      {acao}
      {href && <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/35 transition-colors group-hover:text-white/80" />}
    </>
  );
  return href ? (
    <Link href={href} title={dica} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div title={dica} className={classe}>
      {conteudo}
    </div>
  );
}

export default function InicioPage() {
  const { usuario } = useAuth();
  const [resumo, setResumo] = useState<Resumo | null>(null);
  // quantas das 4 consultas ao servidor já foram respondidas (só na primeira carga) e se o servidor está demorando
  const [consultasRespondidas, setConsultasRespondidas] = useState(0);
  const [servidorDemorando, setServidorDemorando] = useState(false);

  useEffect(() => {
    let ativo = true;
    let primeiraCarga = true;

    // conta cada consulta respondida (com sucesso ou erro) pra barra mostrar o avanço real
    function contar<T>(consulta: Promise<T>): Promise<T> {
      return consulta.finally(() => {
        if (ativo && primeiraCarga) setConsultasRespondidas((n) => n + 1);
      });
    }

    async function carregar() {
      const hoje = dataBrasiliaISO(new Date().toISOString());
      // allSettled: se uma consulta falhar, as outras continuam aparecendo
      const [rCaixa, rVendas, rProdutos, rConsig] = await Promise.allSettled([
        contar(api.get<Caixa>("/caixa/atual")),
        contar(
          api.get<Venda[]>("/vendas", {
            params: {
              inicio: limiteDiaBrasiliaParaUtc(hoje, false),
              fim: limiteDiaBrasiliaParaUtc(hoje, true),
            },
          })
        ),
        contar(api.get<Produto[]>("/produtos")),
        contar(api.get<Consignacao[]>("/consignacoes")),
      ]);
      if (!ativo) return;
      primeiraCarga = false;
      setResumo({
        caixa:
          rCaixa.status === "fulfilled"
            ? rCaixa.value.status === 204 || !rCaixa.value.data || !("id" in rCaixa.value.data)
              ? null
              : rCaixa.value.data
            : undefined,
        vendas: rVendas.status === "fulfilled" ? rVendas.value.data : null,
        produtos: rProdutos.status === "fulfilled" ? rProdutos.value.data : null,
        consignacoes: rConsig.status === "fulfilled" ? rConsig.value.data : null,
      });
    }

    carregar();
    // atualiza sozinho: outra pessoa pode ter aberto/fechado o caixa ou feito uma venda
    const intervalo = setInterval(carregar, 60_000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  // se o servidor passar de 8s sem responder, avisa (pode estar acordando)
  const aguardandoServidor = resumo === null;
  useEffect(() => {
    if (!aguardandoServidor) {
      setServidorDemorando(false);
      return;
    }
    const espera = setTimeout(() => setServidorDemorando(true), 8_000);
    return () => clearTimeout(espera);
  }, [aguardandoServidor]);

  // a DashboardLayout só renderiza esta página depois de confirmar que existe
  // um usuário logado, mas mantemos essa guarda por segurança/tipagem.
  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.href !== "/inicio" && item.perfis.includes(usuario.perfil));
  const destaque = itens.find((item) => item.href === "/pdv");
  const outros = itens.filter((item) => item.href !== "/pdv");
  const primeiroNome = usuario.nome.split(" ")[0];

  // agrupa os atalhos pelas mesmas seções do menu lateral (Operação / Caixa / Gestão)
  const grupos: { titulo: string; itens: typeof outros }[] = [];
  for (const item of outros) {
    const titulo = GRUPO_POR_ROTA[item.href] ?? "Outros";
    const existente = grupos.find((g) => g.titulo === titulo);
    if (existente) existente.itens.push(item);
    else grupos.push({ titulo, itens: [item] });
  }

  // ---- números do resumo ----
  const carregando = resumo === null;
  // mínimo de 5%: a primeira conta já acende, mostrando que começou
  const progressoCarga = Math.max(5, (consultasRespondidas / 4) * 100);
  const caixa = resumo?.caixa;
  const vendas = resumo?.vendas ?? null;
  const totalHoje = vendas ? vendas.reduce((soma, v) => soma + v.total, 0) : 0;
  const ticketMedio = vendas && vendas.length > 0 ? totalHoje / vendas.length : null;
  const ultimasVendas = vendas ? [...vendas].sort((a, b) => b.dataHora.localeCompare(a.dataHora)).slice(0, 6) : null;

  const hoje = dataBrasiliaISO(new Date().toISOString());
  const estoqueBaixo = resumo?.produtos
    ? resumo.produtos.filter(
        (p) => p.ativo !== false && p.estoqueMinimo != null && p.quantidadeEstoque <= p.estoqueMinimo
      ).length
    : null;
  const consignacoesAbertas = resumo?.consignacoes ? resumo.consignacoes.filter((c) => c.status === "ABERTA") : null;
  const consignacoesVencidas = consignacoesAbertas
    ? consignacoesAbertas.filter((c) => c.prazoDevolucao && c.prazoDevolucao < hoje).length
    : null;

  // quem abriu é a mesma pessoa logada neste aparelho?
  const abertoPorMim =
    !!caixa?.usuarioAberturaLogin && caixa.usuarioAberturaLogin.trim().toLowerCase() === usuario.login.trim().toLowerCase();

  const horasCaixa = caixa ? Math.floor(horasDesde(caixa.dataAbertura)) : 0;

  const temAlerta = (estoqueBaixo ?? 0) > 0 || (consignacoesAbertas?.length ?? 0) > 0;
  const alertasTotal = (estoqueBaixo ?? 0) + (consignacoesAbertas?.length ?? 0);

  // quem está operando agora (online no caixa aberto). O usuário técnico "admin" nunca entra na lista,
  // igual ao menu lateral; o usuário deste aparelho é somado para não depender do próximo ciclo de presença.
  const operadoresAgora: string[] = [];
  if (caixa) {
    const vistos = new Set<string>();
    for (const o of [...(caixa.operadoresOnline ?? []), usuario]) {
      const login = o.login.trim().toLowerCase();
      if (login === "admin" || vistos.has(login)) continue;
      vistos.add(login);
      operadoresAgora.push(o.nome.split(" ")[0]);
    }
    operadoresAgora.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // selos nos cards de atalho (ex: "3 abaixo do mínimo" no Estoque)
  const selos: Record<string, { texto: string; classe: string } | undefined> = {
    "/estoque":
      estoqueBaixo && estoqueBaixo > 0
        ? { texto: `${estoqueBaixo} abaixo do mínimo`, classe: "bg-accent-light text-accent-dark" }
        : undefined,
    "/consignados":
      consignacoesVencidas && consignacoesVencidas > 0
        ? {
            texto: `${consignacoesVencidas} com prazo vencido`,
            classe: "bg-danger-light text-danger",
          }
        : consignacoesAbertas && consignacoesAbertas.length > 0
          ? {
              texto: `${consignacoesAbertas.length} ${consignacoesAbertas.length === 1 ? "aberta" : "abertas"}`,
              classe: "bg-info-light text-info-dark",
            }
          : undefined,
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* ---------- Faixa de comando: saudação, relógio e situação do dia num relance ---------- */}
      <div className="shrink-0 relative overflow-hidden bg-primary-dark text-white px-4 py-3 sm:px-8 sm:py-3.5">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div aria-hidden className="absolute -left-24 -top-28 w-80 h-80 rounded-full bg-accent/25 blur-3xl" />
        <div aria-hidden className="absolute -right-16 -bottom-32 w-96 h-96 rounded-full bg-info/35 blur-3xl" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
        <div className="relative max-w-7xl mx-auto flex flex-col gap-2.5">
          {/* linha 1: quem é + pergunta | relógio e data */}
          <div className="flex items-center justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-white/60">
                <PeriodoIcon className="w-3.5 h-3.5 shrink-0 text-accent-light" />
                <span className="truncate">
                  {saudacao()}, {primeiroNome}
                </span>
              </p>
              <h1 className="mt-0.5 text-lg sm:text-2xl font-bold tracking-tight leading-tight">
                O que você precisa fazer agora?
              </h1>
            </div>
            <div className="shrink-0 text-right leading-none">
              <Relogio />
              <p className="mt-1 text-[11px] sm:text-xs text-white/65">{dataPorExtenso()}</p>
            </div>
          </div>

          {/* linha 2: situação do dia — indicadores do mesmo formato, cada um com título, valor e detalhe */}
          <section aria-label="Situação agora" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
            <IndicadorHero
              icone={caixa ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              titulo="Caixa"
              tom={carregando || caixa === undefined ? "neutro" : caixa ? "sucesso" : "perigo"}
              pulsar={!carregando && !!caixa}
              valor={carregando ? "Consultando…" : caixa === undefined ? "Indisponível" : caixa ? "Aberto" : "Fechado"}
              detalhe={
                carregando || caixa === undefined
                  ? "Falando com o servidor"
                  : caixa
                    ? caixa.usuarioReaberturaNome && caixa.dataReabertura
                      ? `Reaberto por ${caixa.usuarioReaberturaNome} às ${horaCurta(caixa.dataReabertura)}`
                      : `${caixa.usuarioAberturaNome}${abertoPorMim ? " (você)" : ""} · desde ${horaCurta(caixa.dataAbertura)}${horasCaixa >= 1 ? ` (${horasCaixa}h)` : ""}`
                    : "Abra o caixa para vender"
              }
              dica={
                caixa
                  ? `Aberto por ${caixa.usuarioAberturaNome} em ${formatarDataHora(caixa.dataAbertura).replace(", ", " às ")}` +
                    (caixa.usuarioReaberturaNome && caixa.dataReabertura
                      ? ` · Reaberto por ${caixa.usuarioReaberturaNome} em ${formatarDataHora(caixa.dataReabertura).replace(", ", " às ")}`
                      : "")
                  : undefined
              }
              href={!carregando && caixa === null ? "/pdv" : undefined}
            />
            <IndicadorHero
              icone={<Wallet className="w-4 h-4" />}
              titulo="Abertura"
              valor={carregando ? "—" : caixa ? formatarMoeda(caixa.valorInicial) : "—"}
              detalhe={
                carregando
                  ? "Consultando…"
                  : caixa
                    ? caixa.valorInicialOriginal !== null
                      ? `Corrigido (era ${formatarMoeda(caixa.valorInicialOriginal)})`
                      : "Valor inicial do caixa"
                    : "Sem caixa aberto"
              }
              dica={
                caixa && caixa.valorInicialOriginal !== null
                  ? `Valor corrigido por ${caixa.usuarioEdicaoAberturaNome ?? "—"} (era ${formatarMoeda(caixa.valorInicialOriginal)})`
                  : "Valor de abertura do caixa"
              }
              acao={
                caixa ? (
                  <EditarAberturaCaixa
                    caixa={caixa}
                    onAtualizado={(c) => setResumo((r) => (r ? { ...r, caixa: c } : r))}
                    className="shrink-0 text-white/70 hover:bg-white/10"
                  />
                ) : null
              }
            />
            <IndicadorHero
              icone={<UserRound className="w-4 h-4" />}
              titulo="Operando agora"
              valor={carregando ? "—" : operadoresAgora.length > 0 ? operadoresAgora.join(", ") : "Ninguém online"}
              detalhe={
                carregando || !caixa
                  ? "Aparece com o caixa aberto"
                  : `${operadoresAgora.length} ${operadoresAgora.length === 1 ? "pessoa" : "pessoas"} no sistema`
              }
            />
            <IndicadorHero
              icone={<ShoppingBag className="w-4 h-4" />}
              titulo="Vendido hoje"
              valor={carregando ? "—" : vendas ? formatarMoeda(totalHoje) : "Indisponível"}
              detalhe={
                carregando || !vendas
                  ? "Somando as vendas…"
                  : vendas.length === 0
                    ? "Nenhuma venda ainda"
                    : `${vendas.length} ${vendas.length === 1 ? "venda" : "vendas"}${ticketMedio !== null ? ` · méd. ${formatarMoeda(ticketMedio)}` : ""}`
              }
              dica={ticketMedio !== null ? `Ticket médio de hoje: ${formatarMoeda(ticketMedio)}` : undefined}
              href="/vendas"
            />
            <IndicadorHero
              className="col-span-2 xl:col-span-1"
              icone={temAlerta ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              titulo="Atenção"
              tom={carregando ? "neutro" : temAlerta ? "alerta" : "sucesso"}
              valor={carregando ? "—" : temAlerta ? `${alertasTotal} ${alertasTotal === 1 ? "pendência" : "pendências"}` : "Tudo em ordem"}
              detalhe={
                carregando
                  ? "Verificando…"
                  : temAlerta
                    ? [
                        (estoqueBaixo ?? 0) > 0 ? `${estoqueBaixo} estoque` : null,
                        (consignacoesAbertas?.length ?? 0) > 0
                          ? `${consignacoesAbertas!.length} consig.`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Estoque e consignações ok"
              }
              dica={
                temAlerta
                  ? `${estoqueBaixo ?? 0} produto(s) abaixo do mínimo · ${consignacoesAbertas?.length ?? 0} consignação(ões) aberta(s)${consignacoesVencidas ? ` (${consignacoesVencidas} vencida(s))` : ""}`
                  : undefined
              }
              href={(estoqueBaixo ?? 0) > 0 ? "/estoque" : (consignacoesAbertas?.length ?? 0) > 0 ? "/consignados" : undefined}
            />
          </section>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 px-4 py-4 sm:px-8 sm:py-5 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-4 items-start">
          {/* ---------- Atalhos ---------- */}
          <div className="flex flex-col gap-4 min-w-0">
            {destaque && (
              <Link
                href={destaque.href}
                className="group relative overflow-hidden flex items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-dark text-white p-4 sm:p-5 shadow-[0_14px_36px_-14px_rgba(15,51,42,0.7)] ring-1 ring-white/10 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-14px_rgba(15,51,42,0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition"
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-60"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
                <div aria-hidden className="absolute -right-10 -top-14 w-52 h-52 rounded-full bg-accent/25 blur-2xl" />
                <div className="relative flex items-center gap-4 min-w-0">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-primary-dark flex items-center justify-center shrink-0 shadow-lg shadow-accent/40 ring-1 ring-white/40">
                    <span aria-hidden className="absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/30 blur-[2px]" />
                    <destaque.icon className="relative w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
                      <Zap className="w-3 h-3" /> Atalho principal
                    </p>
                    <p className="font-bold text-xl sm:text-2xl leading-tight tracking-tight">{destaque.label}</p>
                    <p className="text-xs sm:text-sm text-white/75 truncate">
                      {caixa === null ? "Abra o caixa e comece a vender" : destaque.descricao}
                    </p>
                  </div>
                </div>
                <span className="relative w-11 h-11 rounded-full bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-primary-dark transition">
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition" />
                </span>
              </Link>
            )}

            {grupos.map((grupo) => (
              <section key={grupo.titulo} aria-label={grupo.titulo}>
                <h2 className="flex items-center gap-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted mb-2.5 px-0.5">
                  <span aria-hidden className="w-2 h-2 rounded-sm bg-accent rotate-45" />
                  {grupo.titulo}
                  <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                  {grupo.itens.map((item) => {
                    const cor = CORES[item.href] ?? {
                      bg: "bg-gradient-to-br from-primary to-primary-dark",
                      anel: "hover:ring-primary/60",
                      brilho: "shadow-primary/40",
                    };
                    const Icon = item.icon;
                    const selo = selos[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group relative flex items-center gap-3.5 rounded-2xl ${CARTAO_VIDRO} px-3.5 py-3 hover:-translate-y-0.5 hover:ring-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition ${cor.anel}`}
                      >
                        <div
                          className={`relative w-12 h-12 rounded-2xl ${cor.bg} flex items-center justify-center text-white shrink-0 shadow-lg ${cor.brilho} ring-1 ring-white/30 group-hover:scale-105 transition-transform`}
                        >
                          <span aria-hidden className="absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/25 blur-[2px]" />
                          <Icon className="relative w-6 h-6" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm leading-tight text-foreground line-clamp-2">{item.label}</p>
                          {selo && (
                            <span
                              className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${selo.classe}`}
                            >
                              {selo.texto}
                            </span>
                          )}
                          {item.descricao && (
                            <p className="mt-0.5 text-xs text-muted line-clamp-1 [@media(max-height:760px)]:hidden">
                              {item.descricao}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* ---------- Últimas vendas de hoje ---------- */}
          <aside className={`rounded-2xl ${CARTAO_VIDRO} overflow-hidden min-w-0 lg:sticky lg:top-3`}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-primary-dark to-primary text-white">
              <h2 className="text-sm font-semibold flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" strokeWidth={1.75} />
                </span>
                Últimas vendas
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> hoje
                </span>
              </h2>
              <Link
                href="/vendas"
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-white/90 hover:text-white hover:underline shrink-0"
              >
                Ver todas <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {carregando ? (
              <div className="p-4">
                <CarregandoCartao mensagem="Buscando as vendas de hoje…" progresso={progressoCarga} demorando={servidorDemorando} />
              </div>
            ) : !ultimasVendas ? (
              <p className="p-4 text-sm text-muted">Não foi possível consultar as vendas.</p>
            ) : ultimasVendas.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-sm text-muted">Nenhuma venda registrada hoje.</p>
                <Link href="/pdv" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Registrar a primeira venda <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {ultimasVendas.map((v) => {
                  const visual = PAGAMENTO_VISUAL[v.formaPagamento] ?? PAGAMENTO_PADRAO;
                  const IconePagamento = visual.icon;
                  return (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary-soft/70 transition-colors">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${visual.classe}`}>
                        <IconePagamento className="w-[18px] h-[18px]" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento}
                        </p>
                        <p className="text-xs text-muted truncate">
                          <span className="font-mono tabular-nums">{horaCurta(v.dataHora)}</span> · {v.itens.length}{" "}
                          {v.itens.length === 1 ? "item" : "itens"} · {v.usuarioNome}
                        </p>
                      </div>
                      <p className="text-sm font-bold shrink-0 tabular-nums">{formatarMoeda(v.total)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
