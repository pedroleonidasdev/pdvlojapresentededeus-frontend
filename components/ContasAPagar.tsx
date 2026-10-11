"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { Despesa } from "@/lib/types";
import { formatarDataCurta, formatarMoeda, LABEL_FORMA_PAGAMENTO } from "@/lib/format";

type Modo = "PENDENTES" | "PAGAS" | "TODAS";
type Faixa = "TODAS" | "VENCIDAS" | "7DIAS" | "MES";

/** Uma "conta" na lista: um lançamento à vista, ou UMA parcela de um lançamento parcelado. */
interface ItemConta {
  chave: string; // mesmo formato usado pela tela de Finanças: "id" (à vista) ou "id-numero" (parcela)
  despesa: Despesa;
  numeroParcela: number | null; // null = lançamento à vista
  totalParcelas: number;
  vencimento: string | null; // YYYY-MM-DD
  valor: number;
  pago: boolean;
}

interface Grupo {
  chave: string;
  titulo: string;
  tom: "perigo" | "normal" | "neutro";
  itens: ItemConta[];
  total: number;
}

/** Hoje no fuso de Brasília como "YYYY-MM-DD". */
function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Dias entre hoje e a data (negativo = já passou). */
function diasAte(dataYYYYMMDD: string, hoje: string): number {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const [ah, mh, dh] = hoje.split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ah, mh - 1, dh)) / 86400000);
}

function rotuloMes(chave: string, hoje: string): string {
  const [ano, mes] = chave.split("-").map(Number);
  const texto = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(ano, mes - 1, 1)));
  const titulo = texto.charAt(0).toUpperCase() + texto.slice(1);
  return chave === hoje.slice(0, 7) ? `${titulo} (este mês)` : titulo;
}

function paraItens(despesas: Despesa[]): ItemConta[] {
  const itens: ItemConta[] = [];
  for (const d of despesas) {
    // sangria e suprimento são movimento de caixa, não conta a pagar
    if (d.tipo !== "DESPESA") continue;
    if (d.parcelas.length === 0) {
      itens.push({
        chave: `${d.id}`,
        despesa: d,
        numeroParcela: null,
        totalParcelas: 1,
        vencimento: d.dataVencimento,
        valor: d.valor,
        pago: d.pago === true,
      });
    } else {
      for (const p of d.parcelas) {
        itens.push({
          chave: `${d.id}-${p.numero}`,
          despesa: d,
          numeroParcela: p.numero,
          totalParcelas: d.parcelas.length,
          vencimento: p.dataVencimento,
          valor: p.valor,
          pago: p.pago,
        });
      }
    }
  }
  return itens;
}

function soma(itens: ItemConta[]): number {
  return itens.reduce((acc, i) => acc + i.valor, 0);
}

/** Texto e cor do prazo de uma conta em aberto. */
function descricaoPrazo(vencimento: string, dias: number): { texto: string; classe: string } {
  if (dias < 0) {
    const n = -dias;
    return { texto: `Vencida há ${n} dia${n > 1 ? "s" : ""}`, classe: "bg-danger-light text-danger" };
  }
  if (dias === 0) return { texto: "Vence hoje", classe: "bg-danger-light text-danger" };
  if (dias === 1) return { texto: "Vence amanhã", classe: "bg-accent-light text-accent-dark" };
  if (dias <= 7) return { texto: `Em ${dias} dias`, classe: "bg-accent-light text-accent-dark" };
  return { texto: `Em ${dias} dias`, classe: "bg-surface-alt text-muted" };
}

interface Props {
  despesas: Despesa[];
  carregando: boolean;
  erro: string | null;
  oculto: boolean;
  marcandoId: string | null;
  onPagarAvista: (d: Despesa) => void;
  onPagarParcela: (d: Despesa, numeroParcela: number, pagoAtual: boolean) => void;
  onEditar: (d: Despesa) => void;
  onAtualizar: () => void;
}

/**
 * Painel "Contas a pagar": mostra TODAS as contas e parcelas, de qualquer mês,
 * sem depender do filtro de período da tela. É a visão pra acompanhar o que
 * vence, pagar com um clique e consultar o que já foi pago.
 */
export default function ContasAPagar({
  despesas,
  carregando,
  erro,
  oculto,
  marcandoId,
  onPagarAvista,
  onPagarParcela,
  onEditar,
  onAtualizar,
}: Props) {
  const [modo, setModo] = useState<Modo>("PENDENTES");
  const [faixa, setFaixa] = useState<Faixa>("TODAS");
  const [busca, setBusca] = useState("");
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const hoje = hojeISO();
  const moeda = (v: number) => (oculto ? "R$ ••••••" : formatarMoeda(v));

  const itens = useMemo(() => paraItens(despesas), [despesas]);

  // números dos cartões: sempre sobre TODAS as contas em aberto, sem influência da busca
  const resumo = useMemo(() => {
    const abertas = itens.filter((i) => !i.pago);
    const vencidas = abertas.filter((i) => i.vencimento && diasAte(i.vencimento, hoje) < 0);
    const proximos7 = abertas.filter((i) => {
      if (!i.vencimento) return false;
      const dias = diasAte(i.vencimento, hoje);
      return dias >= 0 && dias <= 7;
    });
    const esteMes = abertas.filter((i) => i.vencimento?.slice(0, 7) === hoje.slice(0, 7));
    return {
      abertas,
      vencidas,
      proximos7,
      esteMes,
      pagas: itens.filter((i) => i.pago).length,
    };
  }, [itens, hoje]);

  const grupos = useMemo<Grupo[]>(() => {
    const termo = busca.trim().toLowerCase();

    const visiveis = itens.filter((i) => {
      if (modo === "PENDENTES" && i.pago) return false;
      if (modo === "PAGAS" && !i.pago) return false;
      if (modo === "PENDENTES" && faixa !== "TODAS") {
        if (!i.vencimento) return false;
        const dias = diasAte(i.vencimento, hoje);
        if (faixa === "VENCIDAS" && dias >= 0) return false;
        if (faixa === "7DIAS" && (dias < 0 || dias > 7)) return false;
        if (faixa === "MES" && i.vencimento.slice(0, 7) !== hoje.slice(0, 7)) return false;
      }
      if (termo) {
        const alvo = [i.despesa.fornecedor, i.despesa.descricao, i.despesa.categoria]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });

    // mais antigo primeiro; nas "Pagas" o mais recente primeiro. Sem data vai pro fim.
    const sinal = modo === "PAGAS" ? -1 : 1;
    visiveis.sort((a, b) => {
      if (!a.vencimento && !b.vencimento) return a.despesa.id - b.despesa.id;
      if (!a.vencimento) return 1;
      if (!b.vencimento) return -1;
      if (a.vencimento === b.vencimento) return a.despesa.id - b.despesa.id;
      return (a.vencimento < b.vencimento ? -1 : 1) * sinal;
    });

    const mapa = new Map<string, Grupo>();
    function adicionar(chave: string, titulo: string, tom: Grupo["tom"], item: ItemConta) {
      let grupo = mapa.get(chave);
      if (!grupo) {
        grupo = { chave, titulo, tom, itens: [], total: 0 };
        mapa.set(chave, grupo);
      }
      grupo.itens.push(item);
      grupo.total += item.valor;
    }

    for (const item of visiveis) {
      if (!item.vencimento) {
        adicionar("sem-data", "Sem data de vencimento", "neutro", item);
      } else if (!item.pago && diasAte(item.vencimento, hoje) < 0) {
        // contas vencidas e em aberto ficam juntas no topo, pra não se perderem nos meses passados
        adicionar("vencidas", "Vencidas", "perigo", item);
      } else {
        const mes = item.vencimento.slice(0, 7);
        adicionar(mes, rotuloMes(mes, hoje), "normal", item);
      }
    }

    const ordem = (g: Grupo) => (g.chave === "vencidas" ? 0 : g.chave === "sem-data" ? 2 : 1);
    return Array.from(mapa.values()).sort((a, b) => {
      if (ordem(a) !== ordem(b)) return ordem(a) - ordem(b);
      if (ordem(a) !== 1) return 0;
      return (a.chave < b.chave ? -1 : 1) * sinal;
    });
  }, [itens, modo, faixa, busca, hoje]);

  const totalVisivel = grupos.reduce((acc, g) => acc + g.total, 0);
  const quantidadeVisivel = grupos.reduce((acc, g) => acc + g.itens.length, 0);

  function escolherFaixa(nova: Faixa) {
    setModo("PENDENTES");
    setFaixa((atual) => (atual === nova && nova !== "TODAS" ? "TODAS" : nova));
  }

  function alternarGrupo(chave: string) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  const cartoes: {
    faixa: Faixa;
    label: string;
    icone: React.ReactNode;
    itens: ItemConta[];
    cor: string;
  }[] = [
    { faixa: "TODAS", label: "Total em aberto", icone: <Wallet className="w-4 h-4" />, itens: resumo.abertas, cor: "text-foreground" },
    { faixa: "VENCIDAS", label: "Vencidas", icone: <AlertTriangle className="w-4 h-4" />, itens: resumo.vencidas, cor: "text-danger" },
    { faixa: "7DIAS", label: "Próximos 7 dias", icone: <CalendarClock className="w-4 h-4" />, itens: resumo.proximos7, cor: "text-accent-dark" },
    { faixa: "MES", label: "Vencem este mês", icone: <CalendarDays className="w-4 h-4" />, itens: resumo.esteMes, cor: "text-info-dark" },
  ];

  return (
    <section className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">Contas a pagar</h2>
          <p className="text-xs text-muted">Todas as parcelas e vencimentos, de qualquer mês — sem precisar mudar o filtro.</p>
        </div>
        <button
          type="button"
          onClick={onAtualizar}
          disabled={carregando}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition disabled:opacity-50"
          title="Atualizar"
        >
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar
        </button>
      </div>

      {erro && <div className="m-4 rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

      {/* cartões: também funcionam como filtro rápido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4">
        {cartoes.map((c) => {
          const ativo = modo === "PENDENTES" && faixa === c.faixa;
          return (
            <button
              key={c.faixa}
              type="button"
              onClick={() => escolherFaixa(c.faixa)}
              className={`text-left rounded-xl border p-3 transition ${
                ativo ? "border-primary bg-primary-light ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                {c.icone}
                {c.label}
              </div>
              <p className={`text-lg font-semibold font-mono mt-1 ${c.cor}`}>{moeda(soma(c.itens))}</p>
              <p className="text-[11px] text-muted">
                {c.itens.length} {c.itens.length === 1 ? "conta" : "contas"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
        <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-medium">
          {(
            [
              ["PENDENTES", `Pendentes (${resumo.abertas.length})`],
              ["PAGAS", `Pagas (${resumo.pagas})`],
              ["TODAS", "Todas"],
            ] as [Modo, string][]
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => {
                setModo(valor);
                if (valor !== "PENDENTES") setFaixa("TODAS");
              }}
              className={`px-3 py-1.5 transition ${
                modo === valor ? "bg-primary text-white" : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, descrição ou categoria"
            className="input text-sm pl-9 w-full"
          />
        </div>
      </div>

      <div className="border-t border-border">
        {carregando && despesas.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas...
          </div>
        ) : grupos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {modo === "PENDENTES" && faixa === "TODAS" && !busca
              ? "Nenhuma conta em aberto. Tudo em dia."
              : "Nenhuma conta encontrada com esses filtros."}
          </p>
        ) : (
          grupos.map((grupo) => {
            const recolhido = recolhidos.has(grupo.chave);
            return (
              <div key={grupo.chave}>
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.chave)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left border-b border-border ${
                    grupo.tom === "perigo" ? "bg-danger-light" : "bg-surface-alt"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${
                      grupo.tom === "perigo" ? "text-danger" : "text-foreground/80"
                    }`}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${recolhido ? "-rotate-90" : ""}`} />
                    {grupo.titulo}
                    <span className="font-normal normal-case text-muted">
                      · {grupo.itens.length} {grupo.itens.length === 1 ? "conta" : "contas"}
                    </span>
                  </span>
                  <span className={`font-mono text-sm font-semibold ${grupo.tom === "perigo" ? "text-danger" : "text-foreground"}`}>
                    {moeda(grupo.total)}
                  </span>
                </button>

                {!recolhido && (
                  <ul>
                    {grupo.itens.map((item) => (
                      <LinhaConta
                        key={item.chave}
                        item={item}
                        hoje={hoje}
                        moeda={moeda}
                        processando={marcandoId === item.chave}
                        onPagar={() =>
                          item.numeroParcela === null
                            ? onPagarAvista(item.despesa)
                            : onPagarParcela(item.despesa, item.numeroParcela, item.pago)
                        }
                        onEditar={() => onEditar(item.despesa)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>

      {grupos.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-surface-alt/60 text-xs">
          <span className="text-muted">
            {quantidadeVisivel} {quantidadeVisivel === 1 ? "conta" : "contas"} na lista
          </span>
          <span className="font-mono font-semibold text-foreground">Total: {moeda(totalVisivel)}</span>
        </div>
      )}
    </section>
  );
}

function LinhaConta({
  item,
  hoje,
  moeda,
  processando,
  onPagar,
  onEditar,
}: {
  item: ItemConta;
  hoje: string;
  moeda: (v: number) => string;
  processando: boolean;
  onPagar: () => void;
  onEditar: () => void;
}) {
  const { despesa } = item;
  const dias = item.vencimento ? diasAte(item.vencimento, hoje) : null;
  const atrasada = !item.pago && dias !== null && dias <= 0;
  const prazo = !item.pago && item.vencimento && dias !== null ? descricaoPrazo(item.vencimento, dias) : null;
  const titulo = despesa.fornecedor?.trim() || despesa.descricao;
  const subtitulo = despesa.fornecedor?.trim() ? despesa.descricao : null;
  const parcelasPagas = despesa.parcelas.filter((p) => p.pago).length;

  return (
    <li
      className={`flex items-center gap-3 px-3 sm:px-4 py-2.5 border-b border-border last:border-0 ${
        atrasada ? "bg-danger-light/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={onPagar}
        disabled={processando}
        title={item.pago ? "Marcar como pendente" : "Marcar como paga"}
        aria-label={item.pago ? "Marcar como pendente" : "Marcar como paga"}
        className="shrink-0 p-1 rounded-full transition disabled:opacity-50"
      >
        {processando ? (
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        ) : item.pago ? (
          <CheckCircle2 className="w-6 h-6 text-primary" />
        ) : (
          <Circle className={`w-6 h-6 ${atrasada ? "text-danger" : "text-muted"} hover:text-primary`} />
        )}
      </button>

      <div className="w-[58px] shrink-0 text-center leading-tight">
        {item.vencimento ? (
          <>
            <p className="text-sm font-semibold font-mono">{formatarDataCurta(item.vencimento).slice(0, 5)}</p>
            <p className="text-[10px] text-muted">{item.vencimento.slice(0, 4)}</p>
          </>
        ) : (
          <p className="text-xs text-muted">sem data</p>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${item.pago ? "text-muted line-through" : "text-foreground"}`}>
          {titulo}
        </p>
        {subtitulo && <p className="truncate text-xs text-muted">{subtitulo}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {item.numeroParcela !== null && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-light text-primary-dark">
              Parcela {item.numeroParcela}/{item.totalParcelas}
            </span>
          )}
          {item.numeroParcela !== null && (
            <span className="text-[10px] text-muted">
              {parcelasPagas} de {item.totalParcelas} pagas
            </span>
          )}
          {despesa.categoria && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-alt text-foreground/70 border border-border">
              {despesa.categoria}
            </span>
          )}
          <span className="text-[10px] text-muted">{LABEL_FORMA_PAGAMENTO[despesa.formaPagamento] ?? despesa.formaPagamento}</span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={`font-mono text-sm font-semibold ${item.pago ? "text-muted" : "text-danger"}`}>{moeda(item.valor)}</p>
        {prazo && (
          <span className={`inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${prazo.classe}`}>
            {prazo.texto}
          </span>
        )}
        {item.pago && <span className="inline-block mt-0.5 text-[10px] text-primary-dark font-medium">Paga</span>}
      </div>

      <button
        type="button"
        onClick={onEditar}
        title="Editar lançamento"
        aria-label="Editar lançamento"
        className="shrink-0 p-1.5 text-muted hover:text-primary transition"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </li>
  );
}
