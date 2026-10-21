"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Despesa, TipoDespesa, FormaPagamento, Venda } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataCurta,
  dataBrasiliaISO,
  limiteDiaBrasiliaParaUtc,
  LABEL_FORMA_PAGAMENTO,
  LABEL_TIPO_DESPESA,
  CATEGORIAS_DESPESA_SUGERIDAS,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  TrendingDown,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Search,
  CalendarClock,
  Layers,
  ChevronDown,
} from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import { AtalhosPeriodo, CampoFiltro, ChipFiltro, PainelFiltros } from "@/components/FiltrosPadrao";

const TIPOS: TipoDespesa[] = ["DESPESA", "SANGRIA", "SUPRIMENTO"];

const COR_TIPO: Record<TipoDespesa, string> = {
  // vermelho = dinheiro saindo (despesa e sangria), azul = dinheiro entrando (suprimento)
  DESPESA: "bg-danger-light text-danger",
  SANGRIA: "bg-danger-light text-danger",
  SUPRIMENTO: "bg-info-light text-info-dark",
};

const BORDA_TIPO: Record<TipoDespesa, string> = {
  DESPESA: "border-l-danger",
  SANGRIA: "border-l-danger",
  SUPRIMENTO: "border-l-info",
};

const COR_VALOR_TIPO: Record<TipoDespesa, string> = {
  DESPESA: "text-danger",
  SANGRIA: "text-danger",
  SUPRIMENTO: "text-info",
};

// cada forma de pagamento com uma cor própria, pra bater o olho na listagem
// sem precisar ler o texto
const COR_FORMA: Record<string, string> = {
  PIX: "bg-primary-light text-primary-dark",
  DINHEIRO: "bg-accent-light text-accent-dark",
  CARTAO_CREDITO: "bg-primary-soft text-primary-dark border border-primary/20",
  CARTAO_DEBITO: "bg-surface-alt text-foreground border border-border",
  CHEQUE: "bg-danger-light text-danger",
  BOLETO: "bg-secondary-light text-secondary-dark border border-secondary/20",
  MULTIPLO: "bg-surface-alt text-muted border border-border border-dashed",
};

type FiltroStatus = "TODOS" | "PENDENTE" | "PAGO";

/** Hoje no fuso de Brasília como "YYYY-MM-DD", pra comparar com datas de
 *  vencimento (que são calendário puro, sem hora/fuso). Comparação de string
 *  funciona porque o formato ISO é ordenável lexicograficamente. */
function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Dias entre hoje e a data (negativo = já passou). */
function diasAte(dataYYYYMMDD: string): number {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const [ah, mh, dh] = hojeISO().split("-").map(Number);
  const alvo = Date.UTC(a, m - 1, d);
  const hoje = Date.UTC(ah, mh - 1, dh);
  return Math.round((alvo - hoje) / 86400000);
}

/** Soma (ou subtrai) dias de uma data "YYYY-MM-DD" sem depender de fuso. */
function somarDias(dataYYYYMMDD: string, dias: number): string {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Soma meses a uma data "YYYY-MM-DD"; se o dia não existir no mês de destino (31 → fevereiro), usa o último dia dele. */
function somarMeses(dataYYYYMMDD: string, meses: number): string {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/** Primeiro e último dia do mês da data informada. */
function limitesDoMes(dataYYYYMMDD: string): { inicio: string; fim: string } {
  const [a, m] = dataYYYYMMDD.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(a, m - 1, 1)).toISOString().slice(0, 10),
    fim: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10),
  };
}

type StatusVencimento = "VENCIDO" | "VENCE_HOJE" | "PROXIMO" | "EM_DIA";

/** Um vencimento só é "vencido"/"a vencer" enquanto não estiver pago — depois
 *  de quitado a data vira histórico e não deve mais alarmar ninguém. */
function statusVencimento(dataYYYYMMDD: string | null, pago: boolean): StatusVencimento | null {
  if (!dataYYYYMMDD || pago) return null;
  const dias = diasAte(dataYYYYMMDD);
  if (dias < 0) return "VENCIDO";
  if (dias === 0) return "VENCE_HOJE";
  if (dias <= 7) return "PROXIMO";
  return "EM_DIA";
}

const COR_VENCIMENTO: Record<StatusVencimento, string> = {
  VENCIDO: "text-danger font-semibold",
  VENCE_HOJE: "text-danger font-semibold",
  PROXIMO: "text-secondary-dark font-medium",
  EM_DIA: "text-foreground",
};

const LABEL_VENCIMENTO: Record<StatusVencimento, string> = {
  VENCIDO: "vencido",
  VENCE_HOJE: "vence hoje",
  PROXIMO: "a vencer",
  EM_DIA: "",
};

/** Resumo de pagamento de um lançamento: quantas parcelas pagas e quanto falta.
 *  Para lançamento à vista, trata como "1 parcela" pra unificar a leitura. */
function resumoPagamento(d: Despesa) {
  if (d.parcelas.length === 0) {
    return {
      parcelado: false,
      pagas: d.pago ? 1 : 0,
      total: 1,
      restante: d.pago ? 0 : d.valor,
    };
  }
  const pagas = d.parcelas.filter((p) => p.pago).length;
  const restante = d.parcelas.filter((p) => !p.pago).reduce((acc, p) => acc + p.valor, 0);
  return { parcelado: true, pagas, total: d.parcelas.length, restante };
}

/** O vencimento "que importa" de um lançamento: à vista é o próprio, parcelado
 *  é o da próxima parcela em aberto (a mais antiga não paga). */
function vencimentoRelevante(d: Despesa): { data: string | null; pago: boolean } {
  if (d.parcelas.length === 0) return { data: d.dataVencimento, pago: d.pago };
  const emAberto = d.parcelas
    .filter((p) => !p.pago && p.dataVencimento)
    .sort((a, b) => (a.dataVencimento! < b.dataVencimento! ? -1 : 1));
  if (emAberto.length === 0) return { data: null, pago: true };
  return { data: emAberto[0].dataVencimento, pago: false };
}

type GrupoUrgencia = "VENCIDO" | "HOJE" | "SEMANA" | "DEPOIS" | "SEM_DATA" | "PAGO" | "MOVIMENTO";

const ORDEM_GRUPOS: GrupoUrgencia[] = ["VENCIDO", "HOJE", "SEMANA", "DEPOIS", "SEM_DATA", "PAGO", "MOVIMENTO"];

const LABEL_GRUPO: Record<GrupoUrgencia, string> = {
  VENCIDO: "Vencidos",
  HOJE: "Vencem hoje",
  SEMANA: "Próximos 7 dias",
  DEPOIS: "Mais adiante",
  SEM_DATA: "Em aberto, sem data de vencimento",
  PAGO: "Pagos",
  MOVIMENTO: "Sangrias e suprimentos",
};

const COR_GRUPO: Record<GrupoUrgencia, string> = {
  VENCIDO: "text-danger",
  HOJE: "text-danger",
  SEMANA: "text-secondary-dark",
  DEPOIS: "text-foreground",
  SEM_DATA: "text-muted",
  PAGO: "text-primary-dark",
  MOVIMENTO: "text-muted",
};

/** Em qual faixa de urgência o lançamento se encaixa. */
function grupoDe(d: Despesa): GrupoUrgencia {
  if (d.tipo !== "DESPESA") return "MOVIMENTO";
  const { pagas, total } = resumoPagamento(d);
  if (pagas === total) return "PAGO";
  const { data, pago } = vencimentoRelevante(d);
  const st = statusVencimento(data, pago);
  if (!st) return "SEM_DATA";
  return st === "VENCIDO" ? "VENCIDO" : st === "VENCE_HOJE" ? "HOJE" : st === "PROXIMO" ? "SEMANA" : "DEPOIS";
}

/**
 * Controle Finanças: cadastro de custos/despesas do negócio e de
 * sangria/suprimento de caixa (dinheiro que sai/entra da gaveta fora de uma
 * venda). Tela restrita a ADMIN — é o painel de quem controla o financeiro.
 *
 * O "lucro líquido estimado" aqui é só faturamento bruto do período menos as
 * despesas reais (tipo=DESPESA). Sangria e suprimento não entram nessa conta:
 * são apenas dinheiro mudando de lugar (gaveta -> banco/bolso e vice-versa),
 * não uma despesa nova.
 */
export default function FinancasPage() {
  // datas no fuso de Brasília (toISOString() usaria UTC e viraria o dia depois das 21h)
  const [inicio, setInicio] = useState(() => limitesDoMes(hojeISO()).inicio);
  const [fim, setFim] = useState(() => hojeISO());
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  // lançamentos de ANTES do período escolhido que ainda têm algo em aberto
  // (parcelas/contas pendentes). Sem isso, uma compra parcelada registrada em
  // setembro sumiria da tela só porque o filtro está em outubro.
  const [pendentesAnteriores, setPendentesAnteriores] = useState<Despesa[]>([]);
  const [painelParceladosAberto, setPainelParceladosAberto] = useState(false);
  // descarta respostas antigas se o usuário disparar outra busca antes da primeira terminar
  const ultimaBusca = useRef(0);
  const [totalFaturado, setTotalFaturado] = useState(0);
  const [carregando, setCarregando] = useState(false);
  // só passa a "true" depois do primeiro clique em Filtrar — evita buscar
  // automaticamente ao abrir a tela, antes do usuário escolher o período
  const [buscou, setBuscou] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [despesaEmEdicao, setDespesaEmEdicao] = useState<Despesa | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [marcandoPagoId, setMarcandoPagoId] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoDespesa | "TODOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [busca, setBusca] = useState("");
  // agrupa a lista por urgência (vencidos, hoje, próximos 7 dias...)
  const [agrupar, setAgrupar] = useState(true);
  // ABERTO = todas as contas a pagar, de qualquer data (padrão);
  // PERIODO = só os lançamentos registrados no período escolhido
  const [visao, setVisao] = useState<"ABERTO" | "PERIODO">("ABERTO");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  // faixa de urgência escolhida ao clicar num cartão de "O que falta pagar"
  const [filtroGrupos, setFiltroGrupos] = useState<GrupoUrgencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const refLista = useRef<HTMLDivElement>(null);
  const refPeriodo = useRef<HTMLDivElement>(null);

  function rolarPara(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  /** Clique num cartão de resumo: mostra a lista de contas a pagar já filtrada por aquela faixa. */
  function verContas(grupos: GrupoUrgencia[] | null) {
    setVisao("ABERTO");
    setFiltroGrupos(grupos);
    rolarPara(refLista);
  }

  // esconde os valores da tela (útil com a loja cheia de gente por perto).
  // sempre começa oculto ao abrir essa tela — a pessoa decide se quer
  // revelar os valores naquela visita, mas ao sair e voltar começa oculto de novo.
  const [valoresOcultos, setValoresOcultos] = useState(true);
  function alternarValoresOcultos() {
    setValoresOcultos((atual) => !atual);
  }
  function moeda(valor: number) {
    return valoresOcultos ? "R$ ••••••" : formatarMoeda(valor);
  }

  /** `periodo` permite carregar um intervalo diferente do que está nos campos
   *  (atalhos). `silencioso` recarrega sem trocar a tabela pelo spinner — usado
   *  depois de marcar pago/editar/excluir, pra tela não "piscar" nem perder a
   *  posição da rolagem. */
  async function carregar(periodo?: { inicio: string; fim: string }, silencioso = false) {
    const de = periodo?.inicio ?? inicio;
    const ate = periodo?.fim ?? fim;
    if (de > ate) {
      setErro("A data inicial não pode ser maior que a data final.");
      return;
    }
    if (!silencioso) setCarregando(true);
    setErro(null);
    const idBusca = ++ultimaBusca.current;
    try {
      const params = {
        inicio: limiteDiaBrasiliaParaUtc(de, false),
        fim: limiteDiaBrasiliaParaUtc(ate, true),
      };
      // janela bem larga (10 anos atrás até 1 ano à frente) só pra achar TUDO
      // que ainda está em aberto, não importa a data em que foi lançado
      const paramsAbertos = {
        inicio: limiteDiaBrasiliaParaUtc(somarDias(hojeISO(), -3650), false),
        fim: limiteDiaBrasiliaParaUtc(somarDias(hojeISO(), 365), true),
      };
      const [resDespesas, resVendas, resAbertos] = await Promise.all([
        api.get<Despesa[]>("/despesas", { params }),
        api.get<Venda[]>("/vendas", { params }),
        // se essa busca extra falhar, a tela continua funcionando com o período
        api.get<Despesa[]>("/despesas", { params: paramsAbertos }).catch(() => null),
      ]);
      if (idBusca !== ultimaBusca.current) return;
      setDespesas(resDespesas.data);
      setTotalFaturado(resVendas.data.reduce((acc, v) => acc + v.total, 0));
      const idsDoPeriodo = new Set(resDespesas.data.map((d) => d.id));
      setPendentesAnteriores(
        (resAbertos?.data ?? []).filter((d) => {
          if (d.tipo !== "DESPESA" || idsDoPeriodo.has(d.id)) return false;
          const { pagas, total } = resumoPagamento(d);
          return pagas < total;
        })
      );
    } catch {
      if (idBusca !== ultimaBusca.current) return;
      setErro("Não foi possível carregar os dados financeiros do período.");
    } finally {
      if (idBusca === ultimaBusca.current) {
        setCarregando(false);
        setBuscou(true);
      }
    }
  }

  // carrega sozinho ao abrir a tela, já com o período padrão (mês atual)
  useEffect(() => {
    const t = setTimeout(() => carregar(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarPeriodo(p: { inicio: string; fim: string }) {
    setInicio(p.inicio);
    setFim(p.fim);
    carregar(p);
  }

  // Sem carregamento automático ao abrir a tela: o usuário escolhe o período
  // (ou mantém o padrão já preenchido) e clica em "Filtrar" para buscar.

  async function excluir(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    setExcluindoId(id);
    try {
      await api.delete(`/despesas/${id}`);
      await carregar(undefined, true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível excluir este lançamento.";
      setErro(msg);
    } finally {
      setExcluindoId(null);
    }
  }

  async function alternarPago(d: Despesa) {
    const chave = `${d.id}`;
    setMarcandoPagoId(chave);
    try {
      await api.patch(`/despesas/${d.id}/pago`, null, { params: { pago: !d.pago } });
      await carregar(undefined, true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível atualizar o pagamento.";
      setErro(msg);
    } finally {
      setMarcandoPagoId(null);
    }
  }

  async function alternarParcelaPaga(d: Despesa, numeroParcela: number, pagoAtual: boolean) {
    const chave = `${d.id}-${numeroParcela}`;
    setMarcandoPagoId(chave);
    try {
      await api.patch(`/despesas/${d.id}/parcelas/${numeroParcela}/pago`, null, {
        params: { pago: !pagoAtual },
      });
      await carregar(undefined, true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível atualizar o pagamento da parcela.";
      setErro(msg);
    } finally {
      setMarcandoPagoId(null);
    }
  }

  // período escolhido + pendências de períodos anteriores: base de tudo que é
  // "o que falta pagar". Os totais de despesa/faturamento seguem só o período.
  const todasAbertas = useMemo(() => [...despesas, ...pendentesAnteriores], [despesas, pendentesAnteriores]);

  // compras parceladas ainda não quitadas — ficam sempre visíveis, sem filtro
  const parceladosEmAndamento = useMemo(
    () =>
      todasAbertas
        .filter((d) => d.tipo === "DESPESA" && d.parcelas.length > 0)
        .filter((d) => resumoPagamento(d).pagas < d.parcelas.length)
        .sort((a, b) => {
          const da = vencimentoRelevante(a).data;
          const db = vencimentoRelevante(b).data;
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da < db ? -1 : da > db ? 1 : 0;
        }),
    [todasAbertas]
  );

  const resumo = useMemo(() => {
    const totalDespesas = despesas
      .filter((d) => d.tipo === "DESPESA")
      .reduce((acc, d) => acc + d.valor, 0);
    const totalSangrias = despesas
      .filter((d) => d.tipo === "SANGRIA")
      .reduce((acc, d) => acc + d.valor, 0);
    const totalSuprimentos = despesas
      .filter((d) => d.tipo === "SUPRIMENTO")
      .reduce((acc, d) => acc + d.valor, 0);

    const porCategoria = new Map<string, number>();
    for (const d of despesas) {
      if (d.tipo !== "DESPESA") continue;
      const chave = d.categoria?.trim() || "Sem categoria";
      porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + d.valor);
    }
    const categoriasOrdenadas = Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]);

    return {
      totalDespesas,
      totalSangrias,
      totalSuprimentos,
      lucroLiquido: totalFaturado - totalDespesas,
      categoriasOrdenadas,
      // quanto ainda falta pagar, somando lançamentos à vista em aberto e
      // parcelas não pagas — só DESPESA (sangria/suprimento já aconteceram).
      totalAPagar: todasAbertas
        .filter((d) => d.tipo === "DESPESA")
        .reduce((acc, d) => acc + resumoPagamento(d).restante, 0),
      // vencendo hoje e nos próximos 7 dias (só o que ainda não foi pago)
      totalVenceLogo: todasAbertas
        .filter((d) => d.tipo === "DESPESA")
        .reduce((acc, d) => {
          const itens =
            d.parcelas.length === 0
              ? [{ data: d.dataVencimento, pago: d.pago, valor: d.valor }]
              : d.parcelas.map((p) => ({ data: p.dataVencimento, pago: p.pago, valor: p.valor }));
          return (
            acc +
            itens
              .filter((i) => {
                const st = statusVencimento(i.data, i.pago);
                return st === "VENCE_HOJE" || st === "PROXIMO";
              })
              .reduce((s, i) => s + i.valor, 0)
          );
        }, 0),
      totalVencido: todasAbertas
        .filter((d) => d.tipo === "DESPESA")
        .reduce((acc, d) => {
          if (d.parcelas.length === 0) {
            return acc + (statusVencimento(d.dataVencimento, d.pago) === "VENCIDO" ? d.valor : 0);
          }
          return (
            acc +
            d.parcelas
              .filter((p) => statusVencimento(p.dataVencimento, p.pago) === "VENCIDO")
              .reduce((s, p) => s + p.valor, 0)
          );
        }, 0),
    };
  }, [despesas, todasAbertas, totalFaturado]);

  // ordenação da lista: por padrão, vencimento do mais antigo pro mais novo —
  // é o que faz mais sentido pra acompanhar o que vence primeiro. O usuário
  // pode clicar nos cabeçalhos das colunas pra trocar o critério/direção.
  const [ordenarPor, setOrdenarPor] = useState<"vencimento" | "valor" | "registro">("vencimento");
  const [ordemAscendente, setOrdemAscendente] = useState(true);

    // tudo que ainda tem algo a pagar (à vista pendente ou parcela em aberto), de qualquer data
  const contasEmAberto = useMemo(
    () =>
      todasAbertas.filter((d) => {
        if (d.tipo !== "DESPESA") return false;
        const { pagas, total } = resumoPagamento(d);
        return pagas < total;
      }),
    [todasAbertas]
  );

  const despesasFiltradas = useMemo(() => {
    const base = visao === "ABERTO" ? contasEmAberto : despesas;
    // em "Contas a pagar" tudo já é despesa em aberto: tipo e pagamento só valem em "Lançamentos do período"
    const tipoEfetivo = visao === "PERIODO" ? filtroTipo : "TODOS";
    const statusEfetivo = visao === "PERIODO" ? filtroStatus : "TODOS";
    let lista = tipoEfetivo === "TODOS" ? base : base.filter((d) => d.tipo === tipoEfetivo);
    if (filtroGrupos) lista = lista.filter((d) => filtroGrupos.includes(grupoDe(d)));
    if (filtroCategoria) {
      lista = lista.filter(
        (d) => d.tipo === "DESPESA" && (d.categoria?.trim() || "Sem categoria") === filtroCategoria
      );
    }
    const termo = busca.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((d) =>
        [d.fornecedor, d.descricao, d.categoria, d.usuarioNome]
          .filter(Boolean)
          .some((campo) => campo!.toLowerCase().includes(termo))
      );
    }
    if (statusEfetivo !== "TODOS") {
      lista = lista.filter((d) => {
        // sangria/suprimento não têm status de pagamento — só aparecem em "Todos"
        if (d.tipo !== "DESPESA") return false;
        const { pagas, total } = resumoPagamento(d);
        return statusEfetivo === "PAGO" ? pagas === total : pagas < total;
      });
    }
    const sinal = ordemAscendente ? 1 : -1;

    const ordenada = [...lista].sort((a, b) => {
      if (ordenarPor === "valor") {
        return (a.valor - b.valor) * sinal;
      }
      if (ordenarPor === "registro") {
        return (a.dataHora < b.dataHora ? -1 : a.dataHora > b.dataHora ? 1 : 0) * sinal;
      }
      // "vencimento": à vista é a própria data, parcelado é a parcela em
      // aberto mais antiga — sem data vai pro fim, não mistura com datas reais
      const dataA = vencimentoRelevante(a).data;
      const dataB = vencimentoRelevante(b).data;
      if (!dataA && !dataB) return 0;
      if (!dataA) return 1;
      if (!dataB) return -1;
      return (dataA < dataB ? -1 : dataA > dataB ? 1 : 0) * sinal;
    });
    // agrupado: junta por faixa de urgência (ordenação estável mantém o critério escolhido dentro de cada faixa)
    return agrupar
      ? ordenada.sort((a, b) => ORDEM_GRUPOS.indexOf(grupoDe(a)) - ORDEM_GRUPOS.indexOf(grupoDe(b)))
      : ordenada;
  }, [contasEmAberto, despesas, visao, filtroTipo, filtroStatus, filtroCategoria, filtroGrupos, busca, ordenarPor, ordemAscendente, agrupar]);

  // quantidade e valor em aberto de cada faixa (cabeçalhos dos grupos)
  const resumoGrupos = useMemo(() => {
    const m = new Map<GrupoUrgencia, { qtd: number; valor: number }>();
    for (const d of despesasFiltradas) {
      const g = grupoDe(d);
      const atual = m.get(g) ?? { qtd: 0, valor: 0 };
      atual.qtd += 1;
      atual.valor += g === "PAGO" || g === "MOVIMENTO" ? d.valor : resumoPagamento(d).restante;
      m.set(g, atual);
    }
    return m;
  }, [despesasFiltradas]);

  // categorias que a pessoa já usa, da mais frequente para a menos: viram atalhos no cadastro
  const categoriasUsadas = useMemo(() => {
    const cont = new Map<string, number>();
    for (const d of [...despesas, ...pendentesAnteriores]) {
      const c = d.tipo === "DESPESA" ? d.categoria?.trim() : null;
      if (c) cont.set(c, (cont.get(c) ?? 0) + 1);
    }
    return Array.from(cont.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
  }, [despesas, pendentesAnteriores]);

  // total do que está listado agora (respeita todos os filtros)
  const totalListado = useMemo(
    () => despesasFiltradas.reduce((acc, d) => acc + d.valor, 0),
    [despesasFiltradas]
  );

  const periodoTexto = `${formatarDataCurta(inicio)} a ${formatarDataCurta(fim)}`;

  return (
    <div>
      <PageHeader
        title="Controle Finanças"
        subtitle="Custos, despesas, sangria e suprimento de caixa"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={alternarValoresOcultos}
              title={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
              aria-label={valoresOcultos ? "Mostrar valores" : "Ocultar valores"}
              className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted hover:text-foreground hover:bg-background transition shrink-0"
            >
              {valoresOcultos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Novo lançamento
            </button>
          </div>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        {erro && (
          <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="flex-1">{erro}</span>
            <button onClick={() => setErro(null)} aria-label="Fechar aviso" className="shrink-0 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1) o que exige ação: cartões que também funcionam como atalhos para a lista */}
        {buscou && (
          <section>
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              O que falta pagar
              <span className="normal-case font-normal tracking-normal"> — clique num cartão para ver as contas</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CardResumo
                icone={<Clock className="w-4 h-4" />}
                label="A pagar (em aberto)"
                valor={resumo.totalAPagar}
                oculto={valoresOcultos}
                cor="text-danger"
                destaque
                onClick={() => verContas(null)}
                selecionado={visao === "ABERTO" && !filtroGrupos}
              />
              <CardResumo
                icone={<CalendarClock className="w-4 h-4" />}
                label="Vence hoje e em 7 dias"
                valor={resumo.totalVenceLogo}
                oculto={valoresOcultos}
                cor={resumo.totalVenceLogo > 0 ? "text-secondary-dark" : "text-muted"}
                onClick={() => verContas(["HOJE", "SEMANA"])}
                selecionado={visao === "ABERTO" && !!filtroGrupos?.includes("SEMANA")}
              />
              <CardResumo
                icone={<AlertTriangle className="w-4 h-4" />}
                label="Vencido"
                valor={resumo.totalVencido}
                oculto={valoresOcultos}
                cor={resumo.totalVencido > 0 ? "text-danger" : "text-muted"}
                destaque={resumo.totalVencido > 0}
                onClick={() => verContas(["VENCIDO"])}
                selecionado={visao === "ABERTO" && !!filtroGrupos?.includes("VENCIDO")}
              />
            </div>
          </section>
        )}

        {/* 2) a lista, logo abaixo: é nela que se paga, edita e exclui */}
        <div ref={refLista} className="bg-surface border border-border rounded-xl overflow-hidden scroll-mt-4">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-background">
              {(
                [
                  ["ABERTO", `Contas a pagar (${contasEmAberto.length})`],
                  ["PERIODO", "Lançamentos do período"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => {
                    setVisao(v);
                    setFiltroGrupos(null);
                  }}
                  aria-pressed={visao === v}
                  className={`text-sm px-3.5 py-1.5 rounded-md transition ${
                    visao === v ? "bg-primary text-white font-medium" : "text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted">
              {visao === "ABERTO" ? (
                "Tudo que está em aberto, de qualquer data."
              ) : (
                <>
                  Registrados de <strong className="text-foreground">{periodoTexto}</strong>.{" "}
                  <button type="button" onClick={() => rolarPara(refPeriodo)} className="text-primary hover:underline">
                    Alterar período
                  </button>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por fornecedor, descrição ou categoria"
                aria-label="Buscar lançamentos"
                className="input text-sm w-full"
                style={{ paddingLeft: "2.25rem" }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="ordenar-por" className="text-xs text-muted">
                Ordenar por
              </label>
              <select
                id="ordenar-por"
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value as "vencimento" | "valor" | "registro")}
                className="input text-sm py-1.5"
                style={{ width: "auto" }}
              >
                <option value="vencimento">Vencimento</option>
                <option value="valor">Valor</option>
                <option value="registro">Data de registro</option>
              </select>
              <button
                type="button"
                onClick={() => setOrdemAscendente((v) => !v)}
                title={ordemAscendente ? "Do menor para o maior (clique para inverter)" : "Do maior para o menor (clique para inverter)"}
                className="flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-2 hover:bg-background transition"
              >
                {ordemAscendente ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                {ordemAscendente ? "Crescente" : "Decrescente"}
              </button>
            </div>
            <ChipFiltro ativo={agrupar} onClick={() => setAgrupar((v) => !v)} title="Separar a lista por urgência: vencidos, hoje, próximos 7 dias...">
              Agrupar por urgência
            </ChipFiltro>
          </div>

          {/* tipo e pagamento só fazem sentido em "Lançamentos do período" */}
          {visao === "PERIODO" && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted">Tipo</span>
                <ChipFiltro ativo={filtroTipo === "TODOS"} onClick={() => setFiltroTipo("TODOS")}>
                  Todos
                </ChipFiltro>
                {TIPOS.map((tipo) => (
                  <ChipFiltro key={tipo} ativo={filtroTipo === tipo} onClick={() => setFiltroTipo(tipo)}>
                    {LABEL_TIPO_DESPESA[tipo]}
                  </ChipFiltro>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted">Pagamento</span>
                {(["TODOS", "PENDENTE", "PAGO"] as FiltroStatus[]).map((st) => (
                  <ChipFiltro key={st} ativo={filtroStatus === st} onClick={() => setFiltroStatus(st)}>
                    {st === "TODOS" ? "Todos" : st === "PENDENTE" ? "Em aberto" : "Pagos"}
                  </ChipFiltro>
                ))}
              </div>
            </div>
          )}

          {/* filtros ativos sempre visíveis, com um clique para remover */}
          {(filtroGrupos || filtroCategoria) && (
            <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
              <span className="text-xs text-muted">Mostrando só:</span>
              {filtroGrupos && (
                <button
                  type="button"
                  onClick={() => setFiltroGrupos(null)}
                  className="flex items-center gap-1 text-xs bg-primary-light text-primary-dark rounded-full pl-3 pr-2 py-1 hover:bg-primary-soft transition"
                >
                  {filtroGrupos.map((g) => LABEL_GRUPO[g].toLowerCase()).join(" e ")}
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {filtroCategoria && (
                <button
                  type="button"
                  onClick={() => setFiltroCategoria(null)}
                  className="flex items-center gap-1 text-xs bg-primary-light text-primary-dark rounded-full pl-3 pr-2 py-1 hover:bg-primary-soft transition"
                >
                  categoria {filtroCategoria}
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="border-t border-border">
            {carregando || !buscou ? (
              <CarregandoSecao />
            ) : despesasFiltradas.length === 0 ? (
              <p className="text-center text-sm text-muted py-10">
                {(visao === "ABERTO" ? contasEmAberto.length : despesas.length) > 0
                  ? "Nenhum lançamento com esses filtros."
                  : visao === "ABERTO"
                  ? "Nenhuma conta em aberto. Tudo pago!"
                  : "Nenhum lançamento no período."}
              </p>
            ) : (
              <>
                {despesasFiltradas.map((d, idx) => {
                  const grupo = grupoDe(d);
                  const novoGrupo = agrupar && (idx === 0 || grupoDe(despesasFiltradas[idx - 1]) !== grupo);
                  const infoGrupo = resumoGrupos.get(grupo);
                  return (
                    <Fragment key={d.id}>
                      {novoGrupo && infoGrupo && (
                        <div className="bg-surface-alt/70 border-b border-border px-4 py-2 flex items-center gap-2">
                          <span className={`text-xs font-semibold uppercase tracking-wide ${COR_GRUPO[grupo]}`}>
                            {LABEL_GRUPO[grupo]}
                          </span>
                          <span className="text-xs text-muted">({infoGrupo.qtd})</span>
                          <span className="ml-auto text-xs font-mono text-muted">
                            {grupo === "PAGO" || grupo === "MOVIMENTO" ? "total" : "em aberto"} {moeda(infoGrupo.valor)}
                          </span>
                        </div>
                      )}
                      <LinhaLancamento
                        d={d}
                        moeda={moeda}
                        marcandoPagoId={marcandoPagoId}
                        excluindo={excluindoId === d.id}
                        onEditar={() => setDespesaEmEdicao(d)}
                        onExcluir={() => excluir(d.id)}
                        onAlternarPago={() => alternarPago(d)}
                        onAlternarParcela={(numero, pagoAtual) => alternarParcelaPaga(d, numero, pagoAtual)}
                      />
                    </Fragment>
                  );
                })}
                <div className="bg-background border-t border-border px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>
                    {despesasFiltradas.length} {despesasFiltradas.length === 1 ? "lançamento" : "lançamentos"} listados
                  </span>
                  <span className="font-mono font-semibold text-sm text-foreground">{moeda(totalListado)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* compras parceladas em andamento — recolhido por padrão, para não poluir */}
        {buscou && parceladosEmAndamento.length > 0 && (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setPainelParceladosAberto((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-background/60 transition"
              aria-expanded={painelParceladosAberto}
            >
              <Layers className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted uppercase tracking-wide">
                Parcelados em andamento ({parceladosEmAndamento.length})
              </span>
              <span className="ml-auto text-xs text-muted font-mono">
                restam {moeda(parceladosEmAndamento.reduce((acc, d) => acc + resumoPagamento(d).restante, 0))}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted transition ${painelParceladosAberto ? "rotate-180" : ""}`} />
            </button>
            {painelParceladosAberto && (
              <div className="border-t border-border divide-y divide-border">
                {parceladosEmAndamento.map((d) => {
                  const { pagas, restante } = resumoPagamento(d);
                  const total = d.parcelas.length;
                  const venc = vencimentoRelevante(d);
                  const status = statusVencimento(venc.data, venc.pago);
                  const proxima = d.parcelas
                    .filter((p) => !p.pago)
                    .sort((a, b) => ((a.dataVencimento ?? "9") < (b.dataVencimento ?? "9") ? -1 : 1))[0];
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
                      <div className="min-w-[180px] flex-1">
                        <div className="font-medium text-foreground leading-tight">{d.fornecedor || d.descricao}</div>
                        {d.fornecedor && <div className="text-xs text-muted leading-tight">{d.descricao}</div>}
                      </div>
                      <div className="flex items-center gap-2 w-44">
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${(pagas / total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted whitespace-nowrap">
                          {pagas}/{total}
                        </span>
                      </div>
                      <div className="w-40 text-xs leading-tight">
                        {proxima ? (
                          <>
                            <div className="text-muted">
                              próxima: <span className="font-mono">{moeda(proxima.valor)}</span>
                            </div>
                            <div className={status ? COR_VENCIMENTO[status] : "text-muted"}>
                              {proxima.dataVencimento ? formatarDataCurta(proxima.dataVencimento) : "sem data"}
                              {status && LABEL_VENCIMENTO[status] ? ` · ${LABEL_VENCIMENTO[status]}` : ""}
                            </div>
                          </>
                        ) : null}
                      </div>
                      <div className="w-28 text-right text-xs font-mono text-muted">restam {moeda(restante)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3) resultado do período: o filtro de período mora aqui, junto do que ele altera */}
        <section ref={refPeriodo} className="space-y-3 scroll-mt-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Resultado do período</h2>
          <PainelFiltros>
            <AtalhosPeriodo
              inicio={inicio}
              fim={fim}
              desabilitado={carregando}
              onSelecionar={(a) => aplicarPeriodo({ inicio: a.inicio, fim: a.fim })}
              atalhos={[
                { rotulo: "Hoje", inicio: hojeISO(), fim: hojeISO() },
                { rotulo: "7 dias", inicio: somarDias(hojeISO(), -6), fim: hojeISO() },
                { rotulo: "Este mês", ...limitesDoMes(hojeISO()) },
                { rotulo: "Mês passado", ...limitesDoMes(somarDias(limitesDoMes(hojeISO()).inicio, -1)) },
                { rotulo: "Próximo mês", ...limitesDoMes(somarDias(limitesDoMes(hojeISO()).fim, 1)) },
              ]}
            />
            <CampoFiltro label="De">
              <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input" />
            </CampoFiltro>
            <CampoFiltro label="Até">
              <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="input" />
            </CampoFiltro>
            <button
              onClick={() => carregar()}
              disabled={carregando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              Filtrar
            </button>
            <p className="w-full text-xs text-muted">
              O período vale para estes cartões e para a aba “Lançamentos do período”. “Contas a pagar” mostra tudo o
              que está em aberto, de qualquer data.
            </p>
          </PainelFiltros>

          {buscou && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <CardResumo
                  icone={<TrendingUp className="w-4 h-4" />}
                  label="Faturamento bruto"
                  valor={totalFaturado}
                  oculto={valoresOcultos}
                  cor="text-info"
                />
                <CardResumo
                  icone={<TrendingDown className="w-4 h-4" />}
                  label="Despesas"
                  valor={resumo.totalDespesas}
                  oculto={valoresOcultos}
                  cor="text-danger"
                />
                <CardResumo
                  icone={<Wallet className="w-4 h-4" />}
                  label="Lucro líquido estimado"
                  valor={resumo.lucroLiquido}
                  oculto={valoresOcultos}
                  cor={resumo.lucroLiquido >= 0 ? "text-info" : "text-danger"}
                />
                <CardResumo
                  icone={<ArrowDownCircle className="w-4 h-4" />}
                  label="Sangrias"
                  valor={resumo.totalSangrias}
                  oculto={valoresOcultos}
                  cor="text-danger"
                />
                <CardResumo
                  icone={<ArrowUpCircle className="w-4 h-4" />}
                  label="Suprimentos"
                  valor={resumo.totalSuprimentos}
                  oculto={valoresOcultos}
                  cor="text-info"
                />
              </div>
              <p className="text-xs text-muted">
                Lucro líquido estimado = faturamento bruto do período − despesas. Sangria e suprimento não entram
                nessa conta: são só dinheiro mudando de lugar, não um custo novo.
              </p>
            </>
          )}
        </section>

        {/* despesas por categoria — clique numa linha pra filtrar a lista lá em cima */}
        {buscou && resumo.categoriasOrdenadas.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">
                Despesas por categoria
                <span className="normal-case font-normal tracking-normal"> — clique para filtrar a lista</span>
              </p>
              {filtroCategoria && (
                <button onClick={() => setFiltroCategoria(null)} className="text-xs text-primary hover:underline">
                  Limpar filtro: {filtroCategoria}
                </button>
              )}
            </div>
            <div className="space-y-1">
              {resumo.categoriasOrdenadas.map(([categoria, valor]) => {
                const percentual = resumo.totalDespesas > 0 ? (valor / resumo.totalDespesas) * 100 : 0;
                const ativa = filtroCategoria === categoria;
                return (
                  <button
                    type="button"
                    key={categoria}
                    onClick={() => {
                      setFiltroCategoria(ativa ? null : categoria);
                      if (!ativa) {
                        setVisao("PERIODO");
                        rolarPara(refLista);
                      }
                    }}
                    title={ativa ? "Remover filtro" : `Filtrar lista por ${categoria}`}
                    className={`w-full flex items-center gap-3 text-sm rounded-md px-1.5 py-1 text-left transition ${
                      ativa ? "bg-primary-light" : "hover:bg-background"
                    } ${filtroCategoria && !ativa ? "opacity-50" : ""}`}
                  >
                    <span className="w-40 shrink-0 truncate text-foreground">{categoria}</span>
                    <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                      <div className="h-full bg-danger/70 rounded-full" style={{ width: `${percentual}%` }} />
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs text-muted">{percentual.toFixed(0)}%</span>
                    <span className="w-28 shrink-0 text-right font-mono text-muted">{moeda(valor)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {(modalAberto || despesaEmEdicao) && (
        <ModalNovoLancamento
          despesa={despesaEmEdicao}
          categoriasUsadas={categoriasUsadas}
          onClose={() => {
            setModalAberto(false);
            setDespesaEmEdicao(null);
          }}
          onSalvo={(aviso) => {
            setModalAberto(false);
            setDespesaEmEdicao(null);
            carregar(undefined, true);
            if (aviso) setErro(aviso);
          }}
        />
      )}
    </div>
  );
}

function CardResumo({
  icone,
  label,
  valor,
  cor,
  destaque,
  oculto,
  onClick,
  selecionado,
}: {
  icone: React.ReactNode;
  label: string;
  valor: number;
  cor: string;
  destaque?: boolean;
  oculto?: boolean;
  /** Com onClick o cartão vira um botão (atalho para a lista). */
  onClick?: () => void;
  selecionado?: boolean;
}) {
  const classes = `rounded-xl border p-4 text-left w-full ${
    destaque ? "border-primary/30 bg-primary-light" : "border-border bg-surface"
  } ${selecionado ? "ring-2 ring-primary" : ""} ${
    onClick ? "cursor-pointer hover:border-primary/60 hover:shadow-sm transition" : ""
  }`;
  const conteudo = (
    <>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${destaque ? "text-primary-dark/70" : "text-muted"}`}>
        {icone}
        {label}
      </div>
      <p className={`text-lg font-semibold font-mono mt-1 ${cor}`}>{oculto ? "R$ ••••••" : formatarMoeda(valor)}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selecionado} className={classes}>
      {conteudo}
    </button>
  ) : (
    <div className={classes}>{conteudo}</div>
  );
}

/** "venceu há 3 dias", "vence amanhã", "em 12 dias"... */
function textoVencimento(data: string): string {
  const dias = diasAte(data);
  if (dias < 0) return dias === -1 ? "venceu ontem" : `venceu há ${-dias} dias`;
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `em ${dias} dias`;
}

/**
 * Uma conta na lista: vencimento (com "em quantos dias"), o que é, valor, o botão
 * principal (Marcar como pago / Pagar parcela) e editar/excluir. Parcelas ficam
 * logo abaixo, cada uma clicável.
 */
function LinhaLancamento({
  d,
  moeda,
  marcandoPagoId,
  excluindo,
  onEditar,
  onExcluir,
  onAlternarPago,
  onAlternarParcela,
}: {
  d: Despesa;
  moeda: (v: number) => string;
  marcandoPagoId: string | null;
  excluindo: boolean;
  onEditar: () => void;
  onExcluir: () => void;
  onAlternarPago: () => void;
  onAlternarParcela: (numero: number, pagoAtual: boolean) => void;
}) {
  const ehDespesa = d.tipo === "DESPESA";
  const { pagas, total, restante } = resumoPagamento(d);
  const parcelado = d.parcelas.length > 0;
  const quitado = ehDespesa && pagas === total;
  const venc = vencimentoRelevante(d);
  const status = statusVencimento(venc.data, venc.pago);
  const atrasada = status === "VENCIDO";
  const proxima = d.parcelas.filter((p) => !p.pago).sort((a, b) => a.numero - b.numero)[0];
  const processando = marcandoPagoId === `${d.id}` || (proxima ? marcandoPagoId === `${d.id}-${proxima.numero}` : false);

  const botaoPrincipal =
    "flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition disabled:opacity-60 whitespace-nowrap";

  return (
    <div
      className={`border-b border-border last:border-0 border-l-4 ${BORDA_TIPO[d.tipo]} ${
        atrasada ? "bg-danger-light/40" : ""
      } px-4 py-3 hover:bg-background/60 transition`}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-x-4 gap-y-2">
        {/* quando vence */}
        <div className="md:w-32 shrink-0 leading-tight">
          {!ehDespesa ? (
            <>
              <div className="text-sm font-semibold text-foreground">{formatarDataCurta(dataBrasiliaISO(d.dataHora))}</div>
              <div className="text-xs text-muted mt-0.5">registrado</div>
            </>
          ) : quitado ? (
            <>
              <div className="flex items-center gap-1 text-sm font-semibold text-primary-dark">
                <CheckCircle2 className="w-4 h-4" /> Pago
              </div>
              {!parcelado && d.dataVencimento && (
                <div className="text-xs text-muted mt-0.5">venc. {formatarDataCurta(d.dataVencimento)}</div>
              )}
            </>
          ) : venc.data ? (
            <>
              <div className={`text-sm ${status ? COR_VENCIMENTO[status] : "text-foreground font-medium"}`}>
                {formatarDataCurta(venc.data)}
              </div>
              <div className={`text-xs mt-0.5 ${status ? COR_VENCIMENTO[status] : "text-muted"}`}>
                {textoVencimento(venc.data)}
              </div>
              {parcelado && <div className="text-[10px] text-muted mt-0.5">próxima parcela</div>}
            </>
          ) : (
            <>
              <div className="text-sm text-muted">Sem vencimento</div>
              <div className="text-xs text-muted mt-0.5">em aberto</div>
            </>
          )}
        </div>

        {/* o que é */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground leading-tight break-words">{d.fornecedor || d.descricao}</div>
          {d.fornecedor && <div className="text-xs text-muted leading-tight mt-0.5 break-words">{d.descricao}</div>}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {!ehDespesa && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${COR_TIPO[d.tipo]}`}>
                {LABEL_TIPO_DESPESA[d.tipo]}
              </span>
            )}
            {d.categoria && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-alt border border-border text-foreground font-medium">
                {d.categoria}
              </span>
            )}
            {ehDespesa && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                  COR_FORMA[d.formaPagamento] ?? "bg-surface-alt text-muted border border-border"
                }`}
              >
                {LABEL_FORMA_PAGAMENTO[d.formaPagamento]}
                {d.numeroParcelas && d.numeroParcelas > 1 ? ` ${d.numeroParcelas}x` : ""}
              </span>
            )}
            <span className="text-[11px] text-muted">
              registrado em {formatarDataCurta(dataBrasiliaISO(d.dataHora))} por {d.usuarioNome}
            </span>
          </div>
        </div>

        {/* valor */}
        <div className="md:w-32 md:text-right leading-tight">
          <div className={`font-mono font-semibold ${COR_VALOR_TIPO[d.tipo]}`}>{moeda(d.valor)}</div>
          {parcelado && !quitado && <div className="text-[11px] text-muted font-mono mt-0.5">restam {moeda(restante)}</div>}
        </div>

        {/* ação principal: pagar */}
        <div className="md:w-52 flex md:justify-end">
          {!ehDespesa ? null : quitado ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full font-medium bg-primary-light text-primary-dark">
                <CheckCircle2 className="w-3.5 h-3.5" /> Quitado
              </span>
              {!parcelado && (
                <button
                  type="button"
                  onClick={onAlternarPago}
                  disabled={processando}
                  className="text-xs text-muted hover:text-foreground underline disabled:opacity-50"
                  title="Voltar este lançamento para pendente"
                >
                  {processando ? "..." : "Desfazer"}
                </button>
              )}
            </div>
          ) : parcelado && proxima ? (
            <button
              type="button"
              onClick={() => onAlternarParcela(proxima.numero, false)}
              disabled={processando}
              className={`${botaoPrincipal} bg-primary hover:bg-primary-dark text-white`}
              title="Marcar a próxima parcela como paga"
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Pagar parcela {proxima.numero}/{total} · {moeda(proxima.valor)}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAlternarPago}
              disabled={processando}
              className={`${botaoPrincipal} bg-primary hover:bg-primary-dark text-white`}
              title="Marcar este lançamento como pago"
            >
              {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Marcar como pago
            </button>
          )}
        </div>

        {/* editar / excluir */}
        <div className="flex gap-1 md:justify-end shrink-0">
          <button
            onClick={onEditar}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted hover:bg-background hover:text-primary transition"
            title="Editar lançamento"
            aria-label="Editar lançamento"
          >
            <Pencil className="w-4 h-4" />
            <span className="md:hidden">Editar</span>
          </button>
          <button
            onClick={onExcluir}
            disabled={excluindo}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-muted hover:bg-background hover:text-danger transition disabled:opacity-50"
            title="Excluir lançamento"
            aria-label="Excluir lançamento"
          >
            {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span className="md:hidden">Excluir</span>
          </button>
        </div>
      </div>

      {/* parcelas: clique em qualquer uma para marcar/desmarcar como paga */}
      {parcelado && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-alt/60 px-3 py-2">
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wide shrink-0">
            Parcelas · {pagas} de {total} pagas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {d.parcelas.map((p) => {
              const chave = `${d.id}-${p.numero}`;
              const st = statusVencimento(p.dataVencimento, p.pago);
              const atrasadaP = st === "VENCIDO" || st === "VENCE_HOJE";
              return (
                <button
                  key={p.numero}
                  onClick={() => onAlternarParcela(p.numero, p.pago)}
                  disabled={marcandoPagoId === chave}
                  title={p.pago ? "Clique para marcar a parcela como pendente" : "Clique para marcar a parcela como paga"}
                  className={`flex items-center gap-1.5 text-xs border rounded-full pl-1 pr-2.5 py-0.5 transition disabled:opacity-50 ${
                    p.pago
                      ? "bg-primary-light border-primary/30"
                      : atrasadaP
                      ? "bg-danger-light border-danger/40 hover:border-danger"
                      : "bg-surface border-border hover:border-primary/40"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${
                      p.pago ? "bg-primary" : atrasadaP ? "bg-danger" : "bg-accent"
                    }`}
                  >
                    {p.numero}
                  </span>
                  <span className={`font-mono font-semibold ${p.pago ? "text-muted line-through" : "text-foreground"}`}>
                    {moeda(p.valor)}
                  </span>
                  <span className={atrasadaP ? "text-danger font-medium" : "text-muted"}>
                    {p.dataVencimento ? formatarDataCurta(p.dataVencimento) : "sem data"}
                  </span>
                  {marcandoPagoId === chave ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                  ) : p.pago ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary-dark" />
                  ) : (
                    <Circle className={`w-3.5 h-3.5 ${atrasadaP ? "text-danger" : "text-muted"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalNovoLancamento({
  despesa,
  categoriasUsadas,
  onClose,
  onSalvo,
}: {
  despesa?: Despesa | null;
  /** Categorias que a pessoa já usa (mais frequentes primeiro): viram atalhos de um clique. */
  categoriasUsadas: string[];
  onClose: () => void;
  /** `aviso` é preenchido quando o lançamento foi salvo mas algo secundário falhou. */
  onSalvo: (aviso?: string) => void;
}) {
  const editando = !!despesa;
  const [tipo, setTipo] = useState<TipoDespesa>(despesa?.tipo ?? "DESPESA");
  const [categoria, setCategoria] = useState(despesa?.categoria ?? "");
  const [fornecedor, setFornecedor] = useState(despesa?.fornecedor ?? "");
  const [descricao, setDescricao] = useState(despesa?.descricao ?? "");
  const [valor, setValor] = useState(despesa ? String(despesa.valor).replace(".", ",") : "");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(despesa?.formaPagamento ?? "DINHEIRO");
  const [dataVencimento, setDataVencimento] = useState(despesa?.dataVencimento ?? "");
  const [numeroParcelas, setNumeroParcelas] = useState(
    despesa?.numeroParcelas && despesa.numeroParcelas > 1 ? String(despesa.numeroParcelas) : ""
  );
  const [parcelas, setParcelas] = useState<{ dataVencimento: string; valor: string }[]>(
    despesa?.parcelas?.length
      ? despesa.parcelas.map((p) => ({
          dataVencimento: p.dataVencimento ?? "",
          valor: String(p.valor).replace(".", ","),
        }))
      : []
  );
  const [jaPago, setJaPago] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehMovimentoCaixa = tipo !== "DESPESA";

  // atalhos de categoria: as que já são usadas primeiro, depois as sugeridas
  const atalhosCategoria = useMemo(() => {
    const usadas = categoriasUsadas.slice(0, 8);
    const resto = CATEGORIAS_DESPESA_SUGERIDAS.filter(
      (c) => !usadas.some((u) => u.toLowerCase() === c.toLowerCase())
    );
    return [...usadas, ...resto].slice(0, 12);
  }, [categoriasUsadas]);

  // Esc fecha o modal
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  // sempre que a quantidade de parcelas ou o valor total mudam, recalcula a
  // divisão automaticamente (a última parcela absorve os centavos de resto,
  // pra soma bater exatamente com o total). As datas já digitadas são
  // preservadas por posição; o valor de cada parcela continua editável depois
  // — só é recalculado se a quantidade ou o total mudarem de novo.
  useEffect(() => {
    const n = Number(numeroParcelas);
    if (ehMovimentoCaixa || !n || n < 2) {
      setParcelas([]);
      return;
    }
    const totalCentavos = Math.round((Number(valor.replace(",", ".")) || 0) * 100);
    const base = Math.floor(totalCentavos / n);
    const resto = totalCentavos - base * n;
    setParcelas((atual) =>
      Array.from({ length: n }, (_, i) => ({
        dataVencimento: atual[i]?.dataVencimento ?? "",
        valor: ((base + (i === n - 1 ? resto : 0)) / 100).toFixed(2).replace(".", ","),
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroParcelas, valor, ehMovimentoCaixa]);

  function atualizarParcela(index: number, campo: "dataVencimento" | "valor", valorNovo: string) {
    setParcelas((atual) => atual.map((p, i) => (i === index ? { ...p, [campo]: valorNovo } : p)));
  }

  const somaParcelas = useMemo(
    () => parcelas.reduce((acc, p) => acc + (Number(p.valor.replace(",", ".")) || 0), 0),
    [parcelas]
  );
  const somaParcelasDiverge = parcelas.length > 0 && Math.abs(somaParcelas - (Number(valor.replace(",", ".")) || 0)) > 0.009;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const payload = {
      tipo,
      categoria: categoria.trim() || null,
      fornecedor: !ehMovimentoCaixa && fornecedor.trim() ? fornecedor.trim() : null,
      descricao: descricao.trim(),
      valor: Number(valor.replace(",", ".")) || 0,
      formaPagamento: ehMovimentoCaixa ? "DINHEIRO" : formaPagamento,
      numeroParcelas: !ehMovimentoCaixa && numeroParcelas.trim() ? Number(numeroParcelas) : null,
      parcelas:
        !ehMovimentoCaixa && parcelas.length > 0
          ? parcelas.map((p) => ({
              dataVencimento: p.dataVencimento || null,
              valor: Number(p.valor.replace(",", ".")) || 0,
            }))
          : null,
      dataVencimento: !ehMovimentoCaixa && parcelas.length === 0 && dataVencimento ? dataVencimento : null,
    };
    try {
      if (editando && despesa) {
        await api.put(`/despesas/${despesa.id}`, payload);
      } else {
        const { data: criada } = await api.post<Despesa>("/despesas", payload);
        if (jaPago && !ehMovimentoCaixa && parcelas.length === 0) {
          try {
            await api.patch(`/despesas/${criada.id}/pago`, null, { params: { pago: true } });
          } catch {
            onSalvo("O lançamento foi salvo, mas não foi possível marcá-lo como pago. Use o botão “Marcar como pago” na lista.");
            return;
          }
        }
      }
      onSalvo();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível salvar o lançamento.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  const faltaCategoria = tipo === "DESPESA" && !categoria.trim();
  const desabilitado = salvando || !descricao.trim() || valor === "" || faltaCategoria;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface">
          <h3 className="font-semibold">{editando ? "Editar lançamento" : "Novo lançamento"}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">Tipo</span>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={editando}
                  onClick={() => setTipo(t)}
                  className={`text-xs px-2 py-2 rounded-lg border transition ${
                    tipo === t
                      ? "border-primary bg-primary-light text-primary-dark font-medium"
                      : "border-border text-muted hover:bg-background"
                  } ${editando ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {LABEL_TIPO_DESPESA[t]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-1.5">
              {tipo === "DESPESA" && "Conta ou gasto da loja: aluguel, fornecedor, luz, salários..."}
              {tipo === "SANGRIA" && "Dinheiro que SAI da gaveta do caixa (ex.: levar ao banco). Sempre em dinheiro e só com o caixa aberto."}
              {tipo === "SUPRIMENTO" && "Dinheiro que ENTRA na gaveta do caixa (ex.: troco). Sempre em dinheiro e só com o caixa aberto."}
            </p>
            {editando && (
              <p className="text-xs text-muted mt-1.5">O tipo do lançamento não pode ser alterado depois de criado.</p>
            )}
          </div>

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">
              Categoria {tipo === "DESPESA" ? "" : "(opcional)"}
            </span>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              list="categorias-sugeridas"
              placeholder={tipo === "DESPESA" ? "Ex: Aluguel, Fornecedor..." : "Ex: Retirada para banco"}
              className="input"
            />
            <datalist id="categorias-sugeridas">
              {CATEGORIAS_DESPESA_SUGERIDAS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {tipo === "DESPESA" && (
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Categorias">
                {atalhosCategoria.map((c) => {
                  const ativa = categoria.trim().toLowerCase() === c.toLowerCase();
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoria(c)}
                      aria-pressed={ativa}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        ativa
                          ? "border-primary bg-primary-light text-primary-dark font-medium"
                          : "border-border text-muted hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </label>

          {!ehMovimentoCaixa && (
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">
                Fornecedor <span className="font-normal">(opcional)</span>
              </span>
              <input
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Ex: Distribuidora Central"
                className="input"
              />
            </label>
          )}

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Descrição</span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que foi?"
              autoFocus
              className="input"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Valor total</span>
            <input
              inputMode="decimal"
              value={valor}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValor(v);
              }}
              placeholder="R$ 0,00"
              className="input font-mono"
            />
          </label>

          {!ehMovimentoCaixa && parcelas.length === 0 && (
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">
                Data de vencimento <span className="font-normal">(opcional)</span>
              </span>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="input"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(
                  [
                    ["Hoje", 0],
                    ["Em 7 dias", 7],
                    ["Em 15 dias", 15],
                    ["Em 30 dias", 30],
                  ] as const
                ).map(([rotulo, dias]) => (
                  <button
                    key={rotulo}
                    type="button"
                    onClick={() => setDataVencimento(somarDias(hojeISO(), dias))}
                    className="text-xs px-2.5 py-1 rounded-full border border-border text-muted hover:border-primary/40 hover:text-foreground transition"
                  >
                    {rotulo}
                  </button>
                ))}
                {dataVencimento && (
                  <button
                    type="button"
                    onClick={() => setDataVencimento("")}
                    className="text-xs px-2.5 py-1 rounded-full text-muted hover:text-danger transition"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </label>
          )}

          {!ehMovimentoCaixa && (
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Forma de pagamento</span>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                className="input"
              >
                {(Object.keys(LABEL_FORMA_PAGAMENTO) as FormaPagamento[]).map((f) => (
                  <option key={f} value={f}>
                    {LABEL_FORMA_PAGAMENTO[f]}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!ehMovimentoCaixa && (
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">
                Parcelas <span className="font-normal">(deixe em branco se for à vista)</span>
              </span>
              <input
                type="number"
                min={2}
                step={1}
                inputMode="numeric"
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(e.target.value)}
                placeholder="Ex: 5"
                className="input font-mono"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setNumeroParcelas("")}
                  aria-pressed={numeroParcelas === ""}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    numeroParcelas === ""
                      ? "border-primary bg-primary-light text-primary-dark font-medium"
                      : "border-border text-muted hover:border-primary/40"
                  }`}
                >
                  À vista
                </button>
                {[2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumeroParcelas(String(n))}
                    aria-pressed={numeroParcelas === String(n)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      numeroParcelas === String(n)
                        ? "border-primary bg-primary-light text-primary-dark font-medium"
                        : "border-border text-muted hover:border-primary/40"
                    }`}
                  >
                    {n}x
                  </button>
                ))}
              </div>
            </label>
          )}

          {!ehMovimentoCaixa && parcelas.length > 0 && (
            <div>
              <span className="block text-xs font-medium text-muted mb-1.5">
                Vencimento e valor de cada parcela
              </span>
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {parcelas.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted w-6 shrink-0">{i + 1}ª</span>
                    <input
                      type="date"
                      value={p.dataVencimento}
                      onChange={(e) => atualizarParcela(i, "dataVencimento", e.target.value)}
                      className="input text-xs flex-1 py-1.5"
                    />
                    <input
                      inputMode="decimal"
                      value={p.valor}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) atualizarParcela(i, "valor", v);
                      }}
                      className="input text-xs font-mono w-24 py-1.5"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={!parcelas[0]?.dataVencimento}
                onClick={() =>
                  setParcelas((atual) =>
                    atual.map((p, i) => (i === 0 ? p : { ...p, dataVencimento: somarMeses(atual[0].dataVencimento, i) }))
                  )
                }
                title={parcelas[0]?.dataVencimento ? "Preenche as outras datas, uma por mês" : "Informe primeiro a data da 1ª parcela"}
                className="mt-2 text-xs px-2.5 py-1 rounded-full border border-border text-primary hover:border-primary/40 transition disabled:opacity-50 disabled:text-muted"
              >
                Repetir a data da 1ª parcela mês a mês
              </button>
              <p className={`text-[11px] mt-1.5 ${somaParcelasDiverge ? "text-danger" : "text-muted"}`}>
                Soma das parcelas: {formatarMoeda(somaParcelas)}
                {somaParcelasDiverge && " — diferente do valor total"}
              </p>
            </div>
          )}

          {!editando && !ehMovimentoCaixa && parcelas.length === 0 && (
            <label className="flex items-start gap-2 text-sm cursor-pointer rounded-lg border border-border px-3 py-2.5 hover:bg-background transition">
              <input
                type="checkbox"
                checked={jaPago}
                onChange={(e) => setJaPago(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <span>
                <span className="font-medium">Já está pago</span>
                <span className="block text-xs text-muted">Marque se você já pagou: o lançamento entra direto como pago.</span>
              </span>
            </label>
          )}

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-background transition">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={desabilitado}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {editando ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
