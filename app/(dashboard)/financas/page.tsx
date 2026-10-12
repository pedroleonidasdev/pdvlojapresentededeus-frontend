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
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  CalendarClock,
  Layers,
  ChevronDown,
} from "lucide-react";

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
/** Cabeçalho de coluna clicável, com seta indicando a ordenação atual. */
function BotaoOrdenar({
  coluna,
  label,
  ativo,
  asc,
  onClick,
  alinhamento = "left",
}: {
  coluna: "vencimento" | "valor" | "registro";
  label: string;
  ativo: "vencimento" | "valor" | "registro";
  asc: boolean;
  onClick: (coluna: "vencimento" | "valor" | "registro") => void;
  alinhamento?: "left" | "right";
}) {
  const estaAtivo = ativo === coluna;
  const Icone = !estaAtivo ? ArrowUpDown : asc ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onClick(coluna)}
      className={`inline-flex items-center gap-1 hover:text-foreground transition ${
        estaAtivo ? "text-foreground" : "text-muted"
      } ${alinhamento === "right" ? "flex-row-reverse" : ""}`}
      title={`Ordenar por ${label.toLowerCase()}`}
    >
      {label}
      <Icone className={`w-3 h-3 ${estaAtivo ? "" : "opacity-40"}`} />
    </button>
  );
}

export default function FinancasPage() {
  // datas no fuso de Brasília (toISOString() usaria UTC e viraria o dia depois das 21h)
  const [inicio, setInicio] = useState(() => limitesDoMes(hojeISO()).inicio);
  const [fim, setFim] = useState(() => hojeISO());
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  // lançamentos de ANTES do período escolhido que ainda têm algo em aberto
  // (parcelas/contas pendentes). Sem isso, uma compra parcelada registrada em
  // setembro sumiria da tela só porque o filtro está em outubro.
  const [pendentesAnteriores, setPendentesAnteriores] = useState<Despesa[]>([]);
  const [painelParceladosAberto, setPainelParceladosAberto] = useState(true);
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
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
      // janela larga (2 anos até hoje) só pra achar o que ainda está em aberto
      const paramsAbertos = {
        inicio: limiteDiaBrasiliaParaUtc(somarDias(hojeISO(), -730), false),
        fim: limiteDiaBrasiliaParaUtc(hojeISO(), true),
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
  const idsAnteriores = useMemo(() => new Set(pendentesAnteriores.map((d) => d.id)), [pendentesAnteriores]);

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

  function alternarOrdenacao(coluna: "vencimento" | "valor" | "registro") {
    if (ordenarPor === coluna) {
      setOrdemAscendente((atual) => !atual);
    } else {
      setOrdenarPor(coluna);
      setOrdemAscendente(true);
    }
  }

  const despesasFiltradas = useMemo(() => {
    let lista = filtroTipo === "TODOS" ? todasAbertas : todasAbertas.filter((d) => d.tipo === filtroTipo);
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
    if (filtroStatus !== "TODOS") {
      lista = lista.filter((d) => {
        // sangria/suprimento não têm status de pagamento — só aparecem em "Todos"
        if (d.tipo !== "DESPESA") return false;
        const { pagas, total } = resumoPagamento(d);
        return filtroStatus === "PAGO" ? pagas === total : pagas < total;
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
  }, [todasAbertas, filtroTipo, filtroStatus, filtroCategoria, busca, ordenarPor, ordemAscendente, agrupar]);

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

  // total do que está listado agora (respeita todos os filtros)
  const totalListado = useMemo(
    () => despesasFiltradas.reduce((acc, d) => acc + d.valor, 0),
    [despesasFiltradas]
  );

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
        {/* filtro de período */}
        <div className="flex flex-wrap items-end gap-3 bg-surface border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">De</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Até</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="input text-sm" />
          </div>
          <button
            onClick={() => carregar()}
            disabled={carregando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Filtrar
          </button>
          <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
            {[
              { label: "Hoje", get: () => ({ inicio: hojeISO(), fim: hojeISO() }) },
              { label: "7 dias", get: () => ({ inicio: somarDias(hojeISO(), -6), fim: hojeISO() }) },
              { label: "Este mês", get: () => limitesDoMes(hojeISO()) },
              {
                label: "Mês passado",
                get: () => limitesDoMes(somarDias(limitesDoMes(hojeISO()).inicio, -1)),
              },
              {
                label: "Próximo mês",
                get: () => limitesDoMes(somarDias(limitesDoMes(hojeISO()).fim, 1)),
              },
            ].map((atalho) => (
              <button
                key={atalho.label}
                onClick={() => aplicarPeriodo(atalho.get())}
                disabled={carregando}
                className="text-xs px-2.5 py-1.5 rounded-full border border-border text-muted hover:text-primary hover:border-primary/40 transition disabled:opacity-50"
              >
                {atalho.label}
              </button>
            ))}
          </div>
        </div>

        {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

        {/* cards de resumo — só aparecem depois que o usuário filtrar ao menos uma vez */}
        {buscou && (
          <>
            {/* 1) o que exige ação: quanto falta pagar */}
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                O que falta pagar
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <CardResumo
                  icone={<Clock className="w-4 h-4" />}
                  label="A pagar (em aberto)"
                  valor={resumo.totalAPagar}
                  oculto={valoresOcultos}
                  cor="text-danger"
                  destaque
                />
                <CardResumo
                  icone={<CalendarClock className="w-4 h-4" />}
                  label="Vence hoje e em 7 dias"
                  valor={resumo.totalVenceLogo}
                  oculto={valoresOcultos}
                  cor={resumo.totalVenceLogo > 0 ? "text-secondary-dark" : "text-muted"}
                />
                <CardResumo
                  icone={<AlertTriangle className="w-4 h-4" />}
                  label="Vencido"
                  valor={resumo.totalVencido}
                  oculto={valoresOcultos}
                  cor={resumo.totalVencido > 0 ? "text-danger" : "text-muted"}
                  destaque={resumo.totalVencido > 0}
                />
              </div>
            </section>

            {/* 2) resultado do período escolhido */}
            <section>
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                Resultado do período
              </h2>
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
              <p className="text-xs text-muted mt-2">
                Lucro líquido estimado = faturamento bruto do período − despesas. Sangria e suprimento não
                entram nessa conta: são só dinheiro mudando de lugar, não um custo novo.
              </p>
            </section>

            {/* compras parceladas em andamento — sempre visíveis, independente do filtro */}
            {parceladosEmAndamento.length > 0 && (
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
                    restam{" "}
                    {moeda(parceladosEmAndamento.reduce((acc, d) => acc + resumoPagamento(d).restante, 0))}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-muted transition ${painelParceladosAberto ? "rotate-180" : ""}`}
                  />
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
                            <div className="font-medium text-foreground leading-tight">
                              {d.fornecedor || d.descricao}
                            </div>
                            {d.fornecedor && (
                              <div className="text-xs text-muted leading-tight">{d.descricao}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 w-44">
                            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(pagas / total) * 100}%` }}
                              />
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
                          <div className="w-28 text-right text-xs font-mono text-muted">
                            restam {moeda(restante)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {/* lista de lançamentos */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
            <Filter className="w-3.5 h-3.5 text-muted" />
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setFiltroTipo("TODOS")}
                className={`text-xs px-2.5 py-1 rounded-full transition ${
                  filtroTipo === "TODOS" ? "bg-primary text-white" : "bg-background text-muted hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {TIPOS.map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipo(tipo)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${
                    filtroTipo === tipo ? "bg-primary text-white" : "bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {LABEL_TIPO_DESPESA[tipo]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAgrupar((v) => !v)}
              aria-pressed={agrupar}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                agrupar
                  ? "bg-primary-light border-primary/30 text-primary-dark font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}
              title="Agrupar por urgência de vencimento"
            >
              Agrupar por urgência
            </button>
            <div className="relative ml-2 min-w-[160px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar fornecedor, descrição..."
                aria-label="Buscar lançamentos"
                className="input text-xs py-1.5 pl-8 w-full"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap ml-auto items-center">
              <span className="text-[11px] text-muted uppercase tracking-wide mr-0.5">Pagamento</span>
              {(["TODOS", "PENDENTE", "PAGO"] as FiltroStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-full transition ${
                    filtroStatus === s
                      ? s === "PENDENTE"
                        ? "bg-danger text-white"
                        : s === "PAGO"
                        ? "bg-primary text-white"
                        : "bg-foreground text-white"
                      : "bg-background text-muted hover:text-foreground"
                  }`}
                >
                  {s === "TODOS" ? "Todos" : s === "PENDENTE" ? "Em aberto" : "Pagos"}
                </button>
              ))}
            </div>
          </div>

          {carregando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !buscou ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-4">
              <Filter className="w-5 h-5 text-muted" />
              <p className="text-sm text-muted">
                Escolha o período acima e clique em <strong>Filtrar</strong> para carregar os lançamentos.
              </p>
            </div>
          ) : despesasFiltradas.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">
              {todasAbertas.length > 0
                ? "Nenhum lançamento com esses filtros."
                : "Nenhum lançamento no período."}
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead className="bg-background border-b border-border">
                <tr className="text-left text-muted">
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Categoria</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Fornecedor / descrição</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Forma</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">
                    <BotaoOrdenar coluna="registro" label="Registro" ativo={ordenarPor} asc={ordemAscendente} onClick={alternarOrdenacao} />
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">
                    <BotaoOrdenar coluna="vencimento" label="Vencimento" ativo={ordenarPor} asc={ordemAscendente} onClick={alternarOrdenacao} />
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide">Usuário</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide text-right">
                    <BotaoOrdenar coluna="valor" label="Valor" ativo={ordenarPor} asc={ordemAscendente} onClick={alternarOrdenacao} alinhamento="right" />
                  </th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide text-center">Pagamento</th>
                  <th className="px-4 py-2.5 font-semibold text-[11px] uppercase tracking-wide text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesasFiltradas.map((d, idx) => {
                  const vencRelevante = vencimentoRelevante(d);
                  const statusLinha = statusVencimento(vencRelevante.data, vencRelevante.pago);
                  const linhaAtrasada = statusLinha === "VENCIDO";
                  const grupo = grupoDe(d);
                  const novoGrupo = agrupar && (idx === 0 || grupoDe(despesasFiltradas[idx - 1]) !== grupo);
                  const infoGrupo = resumoGrupos.get(grupo);
                  return (
                  <Fragment key={d.id}>
                    {novoGrupo && infoGrupo && (
                      <tr className="bg-surface-alt/70 border-y border-border">
                        <td colSpan={10} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold uppercase tracking-wide ${COR_GRUPO[grupo]}`}>
                              {LABEL_GRUPO[grupo]}
                            </span>
                            <span className="text-xs text-muted">({infoGrupo.qtd})</span>
                            <span className="ml-auto text-xs font-mono text-muted">
                              {grupo === "PAGO" || grupo === "MOVIMENTO" ? "total" : "em aberto"}{" "}
                              {moeda(infoGrupo.valor)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`border-b ${
                        d.parcelas.length > 0 ? "border-transparent" : "border-border"
                      } last:border-0 align-top border-l-4 ${BORDA_TIPO[d.tipo]} ${
                        linhaAtrasada ? "bg-danger-light/40" : ""
                      } hover:bg-background/60 transition`}
                    >
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COR_TIPO[d.tipo]}`}>
                          {LABEL_TIPO_DESPESA[d.tipo]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {d.categoria ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt border border-border text-foreground font-medium whitespace-nowrap">
                            {d.categoria}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {d.fornecedor ? (
                          <>
                            <div className="text-foreground font-medium leading-tight">{d.fornecedor}</div>
                            <div className="text-muted text-xs leading-tight mt-0.5">{d.descricao}</div>
                          </>
                        ) : (
                          <div className="text-foreground">{d.descricao}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            COR_FORMA[d.formaPagamento] ?? "bg-surface-alt text-muted border border-border"
                          }`}
                        >
                          {LABEL_FORMA_PAGAMENTO[d.formaPagamento]}
                          {d.numeroParcelas && d.numeroParcelas > 1 ? ` ${d.numeroParcelas}x` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted whitespace-nowrap text-xs">
                        {formatarDataCurta(dataBrasiliaISO(d.dataHora))}
                        {idsAnteriores.has(d.id) && (
                          <div className="text-[10px] text-secondary-dark uppercase tracking-wide mt-0.5">
                            em aberto de antes
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {(() => {
                          const { data, pago } = vencimentoRelevante(d);
                          if (!data) return <span className="text-muted">—</span>;
                          const status = statusVencimento(data, pago);
                          const label = status ? LABEL_VENCIMENTO[status] : "";
                          return (
                            <div className="leading-tight">
                              <div className={status ? COR_VENCIMENTO[status] : "text-muted"}>
                                {formatarDataCurta(data)}
                              </div>
                              {label && (
                                <div
                                  className={`text-[10px] uppercase tracking-wide mt-0.5 ${
                                    status === "VENCIDO" || status === "VENCE_HOJE"
                                      ? "text-danger"
                                      : "text-secondary-dark"
                                  }`}
                                >
                                  {label}
                                </div>
                              )}
                              {d.parcelas.length > 0 && (
                                <div className="text-[10px] text-muted mt-0.5">próxima parcela</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{d.usuarioNome}</td>
                      <td className={`px-4 py-2.5 text-right font-mono font-semibold ${COR_VALOR_TIPO[d.tipo]}`}>
                        {moeda(d.valor)}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {d.tipo === "DESPESA" && d.parcelas.length === 0 ? (
                          <button
                            onClick={() => alternarPago(d)}
                            disabled={marcandoPagoId === `${d.id}`}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition disabled:opacity-50 ${
                              d.pago
                                ? "bg-primary-light text-primary-dark hover:bg-primary-soft"
                                : "bg-danger-light text-danger hover:bg-danger-light/70"
                            }`}
                            title={d.pago ? "Marcar como pendente" : "Marcar como pago"}
                          >
                            {marcandoPagoId === `${d.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : d.pago ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Circle className="w-3.5 h-3.5" />
                            )}
                            {d.pago ? "Pago" : "Pendente"}
                          </button>
                        ) : d.tipo === "DESPESA" && d.parcelas.length > 0 ? (
                          (() => {
                            const { pagas, total, restante } = resumoPagamento(d);
                            const quitado = pagas === total;
                            return (
                              <div className="leading-tight">
                                <div
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                                    quitado ? "bg-primary-light text-primary-dark" : "bg-danger-light text-danger"
                                  }`}
                                >
                                  {quitado ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5" />
                                  )}
                                  {pagas}/{total} pagas
                                </div>
                                {!quitado && (
                                  <div className="text-[10px] text-muted mt-0.5 font-mono">
                                    restam {moeda(restante)}
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setDespesaEmEdicao(d)}
                            className="p-1.5 rounded-md text-muted hover:bg-background hover:text-primary transition"
                            title="Editar lançamento"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => excluir(d.id)}
                            disabled={excluindoId === d.id}
                            className="p-1.5 rounded-md text-muted hover:bg-background hover:text-danger transition disabled:opacity-50"
                            title="Excluir lançamento"
                          >
                            {excluindoId === d.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {d.parcelas.length > 0 && (
                      <tr className={`border-b border-border last:border-0 border-l-4 ${BORDA_TIPO[d.tipo]}`}>
                        {/* célula vazia alinhando o bloco de parcelas sob a descrição, pra
                            deixar claro que é um detalhe da linha acima, não outro lançamento */}
                        <td className="pb-3 pt-0" />
                        <td colSpan={10} className="px-4 pb-3 pt-0">
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-alt/60 px-3 py-2">
                            <span className="text-[11px] font-semibold text-muted uppercase tracking-wide shrink-0">
                              ↳ {resumoPagamento(d).pagas} de {d.parcelas.length} pagas
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {d.parcelas.map((p) => {
                                const chave = `${d.id}-${p.numero}`;
                                const status = statusVencimento(p.dataVencimento, p.pago);
                                const atrasada = status === "VENCIDO" || status === "VENCE_HOJE";
                                return (
                                  <button
                                    key={p.numero}
                                    onClick={() => alternarParcelaPaga(d, p.numero, p.pago)}
                                    disabled={marcandoPagoId === chave}
                                    title={p.pago ? "Marcar parcela como pendente" : "Marcar parcela como paga"}
                                    className={`flex items-center gap-1.5 text-xs border rounded-full pl-1 pr-2.5 py-0.5 transition disabled:opacity-50 ${
                                      p.pago
                                        ? "bg-primary-light border-primary/30"
                                        : atrasada
                                        ? "bg-danger-light border-danger/40 hover:border-danger"
                                        : "bg-surface border-border hover:border-primary/40"
                                    }`}
                                  >
                                    <span
                                      className={`w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                        p.pago ? "bg-primary" : atrasada ? "bg-danger" : "bg-accent"
                                      }`}
                                    >
                                      {p.numero}
                                    </span>
                                    <span
                                      className={`font-mono font-semibold ${
                                        p.pago ? "text-muted line-through" : "text-foreground"
                                      }`}
                                    >
                                      {moeda(p.valor)}
                                    </span>
                                    <span className={atrasada ? "text-danger font-medium" : "text-muted"}>
                                      {p.dataVencimento ? formatarDataCurta(p.dataVencimento) : "sem data"}
                                    </span>
                                    {marcandoPagoId === chave ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
                                    ) : p.pago ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-primary-dark" />
                                    ) : (
                                      <Circle className={`w-3.5 h-3.5 ${atrasada ? "text-danger" : "text-muted"}`} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                            {resumoPagamento(d).restante > 0 && (
                              <span className="text-[11px] text-muted font-mono ml-auto shrink-0">
                                restam {moeda(resumoPagamento(d).restante)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-background border-t border-border">
                <tr>
                  <td colSpan={7} className="px-4 py-2.5 text-xs text-muted">
                    {despesasFiltradas.length}{" "}
                    {despesasFiltradas.length === 1 ? "lançamento" : "lançamentos"} listados
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">
                    {moeda(totalListado)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </div>

        {/* gráfico por categoria — fica por último */}
        {buscou && (
          <>
            {/* despesas por categoria — clique numa linha pra filtrar a lista */}
            {resumo.categoriasOrdenadas.length > 0 && (
              <div className="bg-surface border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide">
                    Despesas por categoria
                  </p>
                  {filtroCategoria && (
                    <button
                      onClick={() => setFiltroCategoria(null)}
                      className="text-xs text-primary hover:underline"
                    >
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
                        onClick={() => setFiltroCategoria(ativa ? null : categoria)}
                        title={ativa ? "Remover filtro" : `Filtrar lista por ${categoria}`}
                        className={`w-full flex items-center gap-3 text-sm rounded-md px-1.5 py-1 text-left transition ${
                          ativa ? "bg-primary-light" : "hover:bg-background"
                        } ${filtroCategoria && !ativa ? "opacity-50" : ""}`}
                      >
                        <span className="w-40 shrink-0 truncate text-foreground">{categoria}</span>
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-danger/70 rounded-full"
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs text-muted">
                          {percentual.toFixed(0)}%
                        </span>
                        <span className="w-28 shrink-0 text-right font-mono text-muted">
                          {moeda(valor)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {(modalAberto || despesaEmEdicao) && (
        <ModalNovoLancamento
          despesa={despesaEmEdicao}
          onClose={() => {
            setModalAberto(false);
            setDespesaEmEdicao(null);
          }}
          onSalvo={() => {
            setModalAberto(false);
            setDespesaEmEdicao(null);
            carregar(undefined, true);
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
}: {
  icone: React.ReactNode;
  label: string;
  valor: number;
  cor: string;
  destaque?: boolean;
  oculto?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        destaque ? "border-primary/30 bg-primary-light" : "border-border bg-surface"
      }`}
    >
      <div className={`flex items-center gap-1.5 text-xs font-medium ${destaque ? "text-primary-dark/70" : "text-muted"}`}>
        {icone}
        {label}
      </div>
      <p className={`text-lg font-semibold font-mono mt-1 ${cor}`}>
        {oculto ? "R$ ••••••" : formatarMoeda(valor)}
      </p>
    </div>
  );
}

function ModalNovoLancamento({
  despesa,
  onClose,
  onSalvo,
}: {
  despesa?: Despesa | null;
  onClose: () => void;
  onSalvo: () => void;
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
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ehMovimentoCaixa = tipo !== "DESPESA";

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
        await api.post("/despesas", payload);
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
      <div className="bg-surface rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
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
            {ehMovimentoCaixa && (
              <p className="text-xs text-muted mt-1.5">
                Sempre em dinheiro, e só pode ser lançado com o caixa aberto.
              </p>
            )}
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
              <p className={`text-[11px] mt-1.5 ${somaParcelasDiverge ? "text-danger" : "text-muted"}`}>
                Soma das parcelas: {formatarMoeda(somaParcelas)}
                {somaParcelasDiverge && " — diferente do valor total"}
              </p>
            </div>
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
