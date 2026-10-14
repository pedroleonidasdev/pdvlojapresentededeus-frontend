"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Handshake,
  Lock,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Unlock,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BarraCarregamento } from "@/components/CarregamentoCatolico";
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
const CORES: Record<string, { bg: string; ring: string }> = {
  "/trocas": { bg: "bg-info", ring: "hover:ring-info/30" },
  "/consignados": { bg: "bg-primary", ring: "hover:ring-primary/30" },
  "/vendas": { bg: "bg-secondary", ring: "hover:ring-secondary/30" },
  "/fechar-caixa": { bg: "bg-accent", ring: "hover:ring-accent/30" },
  "/reabrir-caixa": { bg: "bg-danger", ring: "hover:ring-danger/30" },
  "/estoque": { bg: "bg-success", ring: "hover:ring-success/30" },
  "/categorias": { bg: "bg-secondary", ring: "hover:ring-secondary/30" },
  "/relatorios": { bg: "bg-info", ring: "hover:ring-info/30" },
  "/financas": { bg: "bg-accent", ring: "hover:ring-accent/30" },
  "/usuarios": { bg: "bg-primary-dark", ring: "hover:ring-primary/30" },
};

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

const LIMITE_HORAS_CAIXA_ESQUECIDO = 12;

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

function CartaoResumo({
  icone,
  titulo,
  tom = "neutro",
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  tom?: "neutro" | "sucesso" | "perigo" | "alerta";
  children: React.ReactNode;
}) {
  const faixa =
    tom === "sucesso"
      ? "border-l-success"
      : tom === "perigo"
        ? "border-l-danger"
        : tom === "alerta"
          ? "border-l-accent"
          : "border-l-primary";
  return (
    <div className={`rounded-xl bg-surface border border-border border-l-4 ${faixa} p-3.5 flex flex-col gap-1 min-w-0 shadow-sm`}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted">
        {icone}
        {titulo}
      </div>
      {children}
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

  const horasCaixa = caixa ? Math.floor(horasDesde(caixa.dataAbertura)) : 0;
  const caixaEsquecido = horasCaixa >= LIMITE_HORAS_CAIXA_ESQUECIDO;

  const temAlerta = (estoqueBaixo ?? 0) > 0 || (consignacoesAbertas?.length ?? 0) > 0;

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
      {/* Faixa de boas-vindas, no mesmo espírito visual do painel de login */}
      <div className="shrink-0 relative overflow-hidden bg-primary text-white px-4 py-3 sm:px-8 sm:py-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-dark" />
        <div className="absolute -right-14 -top-14 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/60">
              {saudacao()}, {primeiroNome}
            </p>
            <h1 className="mt-0.5 text-lg sm:text-xl font-semibold tracking-tight">O que você precisa fazer agora?</h1>
          </div>
          <p className="text-xs sm:text-sm text-white/70">{dataPorExtenso()}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-4 py-3 sm:px-8 sm:py-4 max-w-7xl w-full mx-auto">
        {/* ---------- Resumo de hoje ---------- */}
        <section aria-label="Resumo de hoje" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <CartaoResumo
            titulo="Caixa"
            tom={carregando || caixa === undefined ? "neutro" : caixa ? "sucesso" : "perigo"}
            icone={caixa ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          >
            {carregando ? (
              <CarregandoCartao mensagem="Consultando o caixa…" progresso={progressoCarga} demorando={servidorDemorando} />
            ) : caixa === undefined ? (
              <p className="text-sm text-muted">Não foi possível consultar o caixa.</p>
            ) : caixa ? (
              <>
                <p className="text-xl font-semibold text-success">Aberto</p>
                <p className="text-xs text-muted truncate">
                  {caixa.usuarioAberturaNome} · desde {horaCurta(caixa.dataAbertura)}
                </p>
                {caixaEsquecido && (
                  <p className="text-xs font-medium text-accent-dark flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    Aberto há {horasCaixa}h — confira se precisa fechar
                  </p>
                )}
                <Link
                  href="/fechar-caixa"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Fechar caixa <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-danger">Fechado</p>
                <p className="text-xs text-muted">Abra o caixa para começar a vender.</p>
                <Link
                  href="/pdv"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Abrir caixa <ArrowRight className="w-3 h-3" />
                </Link>
              </>
            )}
          </CartaoResumo>

          <CartaoResumo titulo="Vendido hoje" icone={<ShoppingBag className="w-3.5 h-3.5" />}>
            {carregando ? (
              <CarregandoCartao mensagem="Somando as vendas de hoje…" progresso={progressoCarga} demorando={servidorDemorando} />
            ) : vendas ? (
              <>
                <p className="text-xl font-semibold text-foreground">{formatarMoeda(totalHoje)}</p>
                <p className="text-xs text-muted">
                  {vendas.length === 0
                    ? "Nenhuma venda ainda"
                    : `${vendas.length} ${vendas.length === 1 ? "venda" : "vendas"}`}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Não foi possível consultar as vendas.</p>
            )}
          </CartaoResumo>

          <CartaoResumo titulo="Ticket médio" icone={<TrendingUp className="w-3.5 h-3.5" />}>
            {carregando ? (
              <CarregandoCartao mensagem="Calculando o ticket médio…" progresso={progressoCarga} demorando={servidorDemorando} />
            ) : vendas ? (
              <>
                <p className="text-xl font-semibold text-foreground">
                  {ticketMedio !== null ? formatarMoeda(ticketMedio) : "—"}
                </p>
                <p className="text-xs text-muted">Valor médio por venda hoje</p>
              </>
            ) : (
              <p className="text-sm text-muted">—</p>
            )}
          </CartaoResumo>

          <CartaoResumo
            titulo="Atenção"
            tom={!carregando && temAlerta ? "alerta" : "sucesso"}
            icone={
              !carregando && temAlerta ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )
            }
          >
            {carregando ? (
              <CarregandoCartao mensagem="Verificando pendências…" progresso={progressoCarga} demorando={servidorDemorando} />
            ) : !temAlerta ? (
              <p className="text-sm text-muted">Tudo em ordem por aqui.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {(estoqueBaixo ?? 0) > 0 && (
                  <li>
                    <Link href="/estoque" className="flex items-center gap-2 text-sm hover:underline">
                      <Package className="w-4 h-4 text-accent-dark shrink-0" />
                      <span>
                        <strong>{estoqueBaixo}</strong> {estoqueBaixo === 1 ? "produto" : "produtos"} abaixo do mínimo
                      </span>
                    </Link>
                  </li>
                )}
                {consignacoesAbertas && consignacoesAbertas.length > 0 && (
                  <li>
                    <Link href="/consignados" className="flex items-center gap-2 text-sm hover:underline">
                      <Handshake className="w-4 h-4 text-info shrink-0" />
                      <span>
                        <strong>{consignacoesAbertas.length}</strong>{" "}
                        {consignacoesAbertas.length === 1 ? "consignação aberta" : "consignações abertas"}
                        {consignacoesVencidas ? (
                          <span className="text-danger font-medium"> ({consignacoesVencidas} vencida{consignacoesVencidas === 1 ? "" : "s"})</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </CartaoResumo>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] gap-3 items-start">
          {/* ---------- Atalhos ---------- */}
          <div className="flex flex-col gap-3 min-w-0">
            {destaque && (
              <Link
                href={destaque.href}
                className="group flex items-center justify-between gap-4 rounded-xl bg-primary text-white p-3 sm:p-3.5 shadow-sm hover:bg-primary-dark hover:shadow-md transition"
              >
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <destaque.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-base sm:text-lg leading-tight">{destaque.label}</p>
                    <p className="text-xs sm:text-sm text-white/70 truncate">{destaque.descricao}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 shrink-0 opacity-70 group-hover:translate-x-1 transition" />
              </Link>
            )}

            {grupos.map((grupo) => (
              <section key={grupo.titulo} aria-label={grupo.titulo}>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-1.5 px-0.5">
                  {grupo.titulo}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {grupo.itens.map((item) => {
                    const cor = CORES[item.href] ?? { bg: "bg-primary", ring: "hover:ring-primary/30" };
                    const Icon = item.icon;
                    const selo = selos[item.href];
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-xl bg-surface border border-border px-3 py-2.5 hover:-translate-y-0.5 hover:ring-2 hover:shadow-sm transition ${cor.ring}`}
                      >
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg ${cor.bg} flex items-center justify-center text-white shrink-0 shadow-sm`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{item.label}</p>
                            {selo && (
                              <span
                                className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${selo.classe}`}
                              >
                                {selo.texto}
                              </span>
                            )}
                          </div>
                          {item.descricao && (
                            <p className="text-xs text-muted truncate [@media(max-height:760px)]:hidden">{item.descricao}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* ---------- Últimas vendas de hoje ---------- */}
          <aside className="rounded-xl bg-surface border border-border overflow-hidden min-w-0 shadow-sm">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-secondary" />
                Últimas vendas de hoje
              </h2>
              <Link href="/vendas" className="text-xs font-medium text-primary hover:underline shrink-0">
                Ver todas
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
              <ul className="divide-y divide-border/60">
                {ultimasVendas.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {horaCurta(v.dataHora)} · {LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento}
                      </p>
                      <p className="text-xs text-muted truncate">
                        {v.itens.length} {v.itens.length === 1 ? "item" : "itens"} · {v.usuarioNome}
                      </p>
                    </div>
                    <p className="text-sm font-semibold shrink-0">{formatarMoeda(v.total)}</p>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
