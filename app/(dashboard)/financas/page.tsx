"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Plus, Search, X } from "lucide-react";
import api from "@/lib/api";
import type { Despesa, TipoDespesa, Venda } from "@/lib/types";
import { formatarDataCurta, formatarMoeda, limiteDiaBrasiliaParaUtc } from "@/lib/format";
import {
  faixaDaData,
  faixaDe,
  hojeISO,
  limitesDoMes,
  obrigacoesEmAberto,
  ORDEM_FAIXAS,
  resumoPagamento,
  somarDias,
  temAlgoEmAberto,
  TITULO_FAIXA,
  vencimentoRelevante,
  type Faixa,
} from "@/lib/financas";
import PageHeader from "@/components/PageHeader";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import { AtalhosPeriodo, CampoFiltro, ChipFiltro } from "@/components/FiltrosPadrao";
import ResumoAPagar, { type FiltroFaixa, type TotaisAPagar } from "@/components/financas/ResumoAPagar";
import ResultadoPeriodo from "@/components/financas/ResultadoPeriodo";
import PorCategoria from "@/components/financas/PorCategoria";
import LinhaLancamento from "@/components/financas/LinhaLancamento";
import ModalLancamento from "@/components/financas/ModalLancamento";
import ConfirmarExclusao from "@/components/financas/ConfirmarExclusao";

const PAGINA = 12;

type FiltroStatus = "TODOS" | "PENDENTE" | "PAGO";
type Ordenacao = "recentes" | "vencimento" | "valor";

function textoBusca(d: Despesa): string {
  return [d.fornecedor, d.descricao, d.categoria, d.usuarioNome].filter(Boolean).join(" ").toLowerCase();
}

function mensagemDoErro(e: unknown, padrao: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? padrao;
}

/**
 * Controle Finanças. Duas zonas, cada uma com um assunto:
 *  1) Contas a pagar — tudo que está em aberto, de qualquer data (não depende do período).
 *  2) Resultado do período — vendas, despesas, lucro estimado e tudo que foi lançado no período.
 *
 * Lucro estimado = vendas do período − despesas. Sangria e suprimento não entram:
 * só mudam o dinheiro de lugar (caixa ⇄ banco/bolso). Tela restrita a ADMIN.
 */
export default function FinancasPage() {
  // datas no fuso de Brasília (toISOString() usaria UTC e viraria o dia depois das 21h)
  const [inicio, setInicio] = useState(() => limitesDoMes(hojeISO()).inicio);
  const [fim, setFim] = useState(() => limitesDoMes(hojeISO()).fim);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  // contas de ANTES do período que ainda têm algo em aberto: sem isso, uma compra
  // parcelada de setembro sumiria só porque o período escolhido é outubro
  const [pendentesAnteriores, setPendentesAnteriores] = useState<Despesa[]>([]);
  const [totalFaturado, setTotalFaturado] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [carregouAlgumaVez, setCarregouAlgumaVez] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // descarta respostas antigas se outra busca for disparada antes da primeira terminar
  const ultimaBusca = useRef(0);

  // esconde os valores (útil com a loja cheia); sempre começa oculto ao abrir a tela
  const [valoresOcultos, setValoresOcultos] = useState(true);
  const moeda = (valor: number) => (valoresOcultos ? "R$ ••••••" : formatarMoeda(valor));

  // zona 1: contas a pagar
  const [faixaFiltro, setFaixaFiltro] = useState<FiltroFaixa | null>(null);
  const [buscaContas, setBuscaContas] = useState("");
  const [soParcelados, setSoParcelados] = useState(false);
  const [limiteContas, setLimiteContas] = useState(PAGINA);

  // zona 2: período
  const [filtroTipo, setFiltroTipo] = useState<TipoDespesa | "TODOS">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [buscaPeriodo, setBuscaPeriodo] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [limitePeriodo, setLimitePeriodo] = useState(PAGINA);
  const listaPeriodoRef = useRef<HTMLDivElement>(null);

  // janelas e ações
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [marcando, setMarcando] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Despesa | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Despesa | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  /** `periodo` carrega outro intervalo que não o dos campos (atalhos). `silencioso`
   *  recarrega sem trocar a tela pelo carregando — usado depois de pagar/editar/excluir
   *  para a tela não piscar nem perder a posição da rolagem. */
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
      // janela larga (10 anos atrás até 1 ano à frente) só para achar TUDO que está em aberto
      const paramsAbertos = {
        inicio: limiteDiaBrasiliaParaUtc(somarDias(hojeISO(), -3650), false),
        fim: limiteDiaBrasiliaParaUtc(somarDias(hojeISO(), 365), true),
      };
      const [resDespesas, resVendas, resAbertos] = await Promise.all([
        api.get<Despesa[]>("/despesas", { params }),
        api.get<Venda[]>("/vendas", { params }),
        // se essa busca extra falhar, a tela continua funcionando só com o período
        api.get<Despesa[]>("/despesas", { params: paramsAbertos }).catch(() => null),
      ]);
      if (idBusca !== ultimaBusca.current) return;
      setDespesas(resDespesas.data);
      setTotalFaturado(resVendas.data.reduce((acc, v) => acc + v.total, 0));
      const idsDoPeriodo = new Set(resDespesas.data.map((d) => d.id));
      setPendentesAnteriores((resAbertos?.data ?? []).filter((d) => !idsDoPeriodo.has(d.id) && temAlgoEmAberto(d)));
      setLimitePeriodo(PAGINA);
    } catch {
      if (idBusca !== ultimaBusca.current) return;
      setErro("Não foi possível carregar os dados financeiros. Verifique a conexão e tente de novo.");
    } finally {
      if (idBusca === ultimaBusca.current) {
        setCarregando(false);
        setCarregouAlgumaVez(true);
      }
    }
  }

  // carrega sozinho ao abrir a tela, já com o mês atual
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

  async function alternarPago(d: Despesa) {
    setMarcando(`${d.id}`);
    try {
      await api.patch(`/despesas/${d.id}/pago`, null, { params: { pago: !d.pago } });
      await carregar(undefined, true);
    } catch (e) {
      setErro(mensagemDoErro(e, "Não foi possível atualizar o pagamento."));
    } finally {
      setMarcando(null);
    }
  }

  async function alternarParcela(d: Despesa, numero: number, pagoAtual: boolean) {
    setMarcando(`${d.id}-${numero}`);
    try {
      await api.patch(`/despesas/${d.id}/parcelas/${numero}/pago`, null, { params: { pago: !pagoAtual } });
      await carregar(undefined, true);
    } catch (e) {
      setErro(mensagemDoErro(e, "Não foi possível atualizar o pagamento da parcela."));
    } finally {
      setMarcando(null);
    }
  }

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    setExcluindo(true);
    try {
      await api.delete(`/despesas/${paraExcluir.id}`);
      setParaExcluir(null);
      await carregar(undefined, true);
    } catch (e) {
      setParaExcluir(null);
      setErro(mensagemDoErro(e, "Não foi possível excluir este lançamento."));
    } finally {
      setExcluindo(false);
    }
  }

  function alternarExpandido(id: number) {
    setExpandidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function escolherCategoria(categoria: string | null) {
    setFiltroCategoria(categoria);
    setFiltroTipo("TODOS");
    setLimitePeriodo(PAGINA);
    if (categoria) {
      const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      listaPeriodoRef.current?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
    }
  }

  // ---------- zona 1: contas a pagar ----------

  const contasEmAberto = useMemo(
    () => [...despesas, ...pendentesAnteriores].filter(temAlgoEmAberto),
    [despesas, pendentesAnteriores]
  );

  const totaisAPagar = useMemo<TotaisAPagar>(() => {
    const t: TotaisAPagar = {
      total: 0,
      contas: contasEmAberto.length,
      vencido: { valor: 0, contas: 0 },
      semana: { valor: 0, contas: 0 },
      depois: { valor: 0, contas: 0 },
      semData: { valor: 0, contas: 0 },
    };
    const grupoDe = (f: Faixa) =>
      f === "VENCIDO" ? t.vencido : f === "HOJE" || f === "SEMANA" ? t.semana : f === "DEPOIS" ? t.depois : t.semData;
    for (const d of contasEmAberto) {
      // o valor soma cada pagamento pendente (cada parcela no seu prazo)...
      for (const o of obrigacoesEmAberto(d)) {
        grupoDe(faixaDaData(o.data)).valor += o.valor;
        t.total += o.valor;
      }
      // ...e a contagem de contas segue a faixa em que a conta aparece na lista
      grupoDe(faixaDe(d)).contas += 1;
    }
    return t;
  }, [contasEmAberto]);

  const contasFiltradas = useMemo(() => {
    const termo = buscaContas.trim().toLowerCase();
    return contasEmAberto
      .filter((d) => {
        if (soParcelados && d.parcelas.length === 0) return false;
        if (faixaFiltro) {
          const f = faixaDe(d);
          if ((f === "HOJE" ? "SEMANA" : f) !== faixaFiltro) return false;
        }
        return !termo || textoBusca(d).includes(termo);
      })
      .sort((a, b) => {
        const porFaixa = ORDEM_FAIXAS.indexOf(faixaDe(a)) - ORDEM_FAIXAS.indexOf(faixaDe(b));
        if (porFaixa !== 0) return porFaixa;
        const da = vencimentoRelevante(a).data;
        const db = vencimentoRelevante(b).data;
        if (da && db && da !== db) return da < db ? -1 : 1;
        return b.valor - a.valor;
      });
  }, [contasEmAberto, buscaContas, soParcelados, faixaFiltro]);

  const contasVisiveis = contasFiltradas.slice(0, limiteContas);
  const contasFiltrando = !!faixaFiltro || soParcelados || buscaContas.trim() !== "";

  const contagemPorFaixa = useMemo(() => {
    const m = new Map<Faixa, number>();
    for (const d of contasFiltradas) m.set(faixaDe(d), (m.get(faixaDe(d)) ?? 0) + 1);
    return m;
  }, [contasFiltradas]);

  // ---------- zona 2: período ----------

  const resumoPeriodo = useMemo(() => {
    let totalDespesas = 0;
    let sangrias = 0;
    let suprimentos = 0;
    const porCategoria = new Map<string, number>();
    for (const d of despesas) {
      if (d.tipo === "DESPESA") {
        totalDespesas += d.valor;
        const chave = d.categoria?.trim() || "Sem categoria";
        porCategoria.set(chave, (porCategoria.get(chave) ?? 0) + d.valor);
      } else if (d.tipo === "SANGRIA") sangrias += d.valor;
      else suprimentos += d.valor;
    }
    return {
      totalDespesas,
      sangrias,
      suprimentos,
      categorias: Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [despesas]);

  const lancamentos = useMemo(() => {
    const termo = buscaPeriodo.trim().toLowerCase();
    const lista = despesas.filter((d) => {
      if (filtroTipo !== "TODOS" && d.tipo !== filtroTipo) return false;
      if (filtroCategoria && (d.tipo !== "DESPESA" || (d.categoria?.trim() || "Sem categoria") !== filtroCategoria)) {
        return false;
      }
      if (filtroStatus !== "TODOS") {
        // sangria e suprimento não têm pagamento a acompanhar: só aparecem em "Todos"
        if (d.tipo !== "DESPESA") return false;
        const { pagas, total } = resumoPagamento(d);
        if (filtroStatus === "PAGO" ? pagas !== total : pagas === total) return false;
      }
      return !termo || textoBusca(d).includes(termo);
    });
    return lista.sort((a, b) => {
      if (ordenacao === "valor") return b.valor - a.valor;
      if (ordenacao === "vencimento") {
        const da = vencimentoRelevante(a).data;
        const db = vencimentoRelevante(b).data;
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      }
      return a.dataHora < b.dataHora ? 1 : a.dataHora > b.dataHora ? -1 : 0;
    });
  }, [despesas, filtroTipo, filtroStatus, filtroCategoria, buscaPeriodo, ordenacao]);

  const lancamentosVisiveis = lancamentos.slice(0, limitePeriodo);
  const periodoFiltrando =
    filtroTipo !== "TODOS" || filtroStatus !== "TODOS" || !!filtroCategoria || buscaPeriodo.trim() !== "";

  const totaisListados = useMemo(() => {
    const t = { DESPESA: 0, SANGRIA: 0, SUPRIMENTO: 0 };
    for (const d of lancamentos) t[d.tipo] += d.valor;
    return t;
  }, [lancamentos]);

  function limparFiltrosContas() {
    setFaixaFiltro(null);
    setSoParcelados(false);
    setBuscaContas("");
  }

  function limparFiltrosPeriodo() {
    setFiltroTipo("TODOS");
    setFiltroStatus("TODOS");
    setFiltroCategoria(null);
    setBuscaPeriodo("");
  }

  const carregandoInicial = carregando && !carregouAlgumaVez;

  const linha = (d: Despesa, modo: "pagar" | "periodo") => (
    <LinhaLancamento
      key={d.id}
      d={d}
      modo={modo}
      moeda={moeda}
      expandido={expandidos.has(d.id)}
      marcando={marcando}
      onAlternarExpandido={() => alternarExpandido(d.id)}
      onAlternarPago={alternarPago}
      onAlternarParcela={alternarParcela}
      onEditar={setEmEdicao}
      onExcluir={setParaExcluir}
    />
  );

  return (
    <div>
      <PageHeader
        title="Controle Finanças"
        subtitle="Contas a pagar, resultado do período e movimento do caixa"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setValoresOcultos((v) => !v)}
              aria-pressed={!valoresOcultos}
              title={valoresOcultos ? "Mostrar os valores na tela" : "Esconder os valores da tela"}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition hover:bg-background hover:text-foreground"
            >
              {valoresOcultos ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              <span className="hidden sm:inline">{valoresOcultos ? "Mostrar valores" : "Ocultar valores"}</span>
            </button>
            <button
              type="button"
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
            >
              <Plus className="h-4 w-4" aria-hidden /> Novo lançamento
            </button>
          </div>
        }
      />

      <div className="space-y-10 p-4 md:p-8">
        {erro && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg bg-danger-light px-4 py-3 text-sm text-danger">
            <span className="flex-1">{erro}</span>
            <button type="button" onClick={() => carregar()} className="font-medium underline">
              Tentar de novo
            </button>
          </div>
        )}

        {carregandoInicial ? (
          <CarregandoSecao mensagem="Carregando as finanças…" />
        ) : (
          <>
            {/* ===== zona 1: contas a pagar ===== */}
            <section aria-labelledby="secao-pagar" className="space-y-4">
              <div>
                <h2 id="secao-pagar" className="text-lg font-semibold">
                  Contas a pagar
                </h2>
                <p className="text-sm text-muted">Tudo que está em aberto, de qualquer data. O período escolhido mais abaixo não muda isto.</p>
              </div>

              <ResumoAPagar
                totais={totaisAPagar}
                moeda={moeda}
                faixaAtiva={faixaFiltro}
                onFiltrar={(f) => {
                  setFaixaFiltro(f);
                  setLimiteContas(PAGINA);
                }}
              />

              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                  <h3 className="mr-auto text-sm font-medium">
                    Contas em aberto <span className="font-normal text-muted">({contasFiltradas.length})</span>
                  </h3>
                  <ChipFiltro ativo={soParcelados} onClick={() => setSoParcelados((v) => !v)} title="Mostrar só compras parceladas">
                    Só parcelados
                  </ChipFiltro>
                  <div className="relative w-full min-w-[12rem] sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                    <input
                      value={buscaContas}
                      onChange={(e) => {
                        setBuscaContas(e.target.value);
                        setLimiteContas(PAGINA);
                      }}
                      placeholder="Buscar fornecedor ou descrição"
                      aria-label="Buscar nas contas em aberto"
                      className="input py-1.5 pl-8 text-sm"
                    />
                  </div>
                </div>

                {contasFiltradas.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    {contasFiltrando ? (
                      <>
                        <p className="text-sm text-muted">Nenhuma conta com esses filtros.</p>
                        <button type="button" onClick={limparFiltrosContas} className="text-sm font-medium text-primary hover:underline">
                          Limpar filtros
                        </button>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-success" aria-hidden />
                        <p className="text-sm font-medium">Tudo pago por aqui.</p>
                        <p className="text-sm text-muted">Quando lançar uma conta nova, ela aparece nesta lista.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {ORDEM_FAIXAS.map((faixa) => {
                      const doGrupo = contasVisiveis.filter((d) => faixaDe(d) === faixa);
                      if (doGrupo.length === 0) return null;
                      return (
                        <div key={faixa}>
                          <h4 className="border-b border-border bg-surface-alt/70 px-4 py-2 text-sm font-medium">
                            {TITULO_FAIXA[faixa]}{" "}
                            <span className="font-normal text-muted">({contagemPorFaixa.get(faixa) ?? doGrupo.length})</span>
                          </h4>
                          <ul className="divide-y divide-border border-b border-border last:border-b-0">
                            {doGrupo.map((d) => linha(d, "pagar"))}
                          </ul>
                        </div>
                      );
                    })}
                    {contasFiltradas.length > limiteContas && (
                      <div className="border-t border-border px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setLimiteContas((n) => n + PAGINA)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Mostrar mais ({contasFiltradas.length - limiteContas} restantes)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* ===== zona 2: resultado do período ===== */}
            <section aria-labelledby="secao-periodo" className="space-y-4" aria-busy={carregando}>
              <div>
                <h2 id="secao-periodo" className="text-lg font-semibold">
                  Resultado do período
                </h2>
                <p className="text-sm text-muted">
                  Vendas, despesas e lançamentos de {formatarDataCurta(inicio)} a {formatarDataCurta(fim)}.
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
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
                <div className="flex flex-wrap items-end gap-3">
                  <CampoFiltro label="De">
                    <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="input w-40" />
                  </CampoFiltro>
                  <CampoFiltro label="Até">
                    <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="input w-40" />
                  </CampoFiltro>
                  <button
                    type="button"
                    onClick={() => carregar()}
                    disabled={carregando}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
                  >
                    {carregando ? "Carregando…" : "Aplicar datas"}
                  </button>
                </div>
              </div>

              <div className={`grid gap-4 lg:grid-cols-5 ${carregando ? "opacity-60" : ""}`}>
                <div className="lg:col-span-3">
                  <ResultadoPeriodo
                    faturamento={totalFaturado}
                    despesas={resumoPeriodo.totalDespesas}
                    sangrias={resumoPeriodo.sangrias}
                    suprimentos={resumoPeriodo.suprimentos}
                    moeda={moeda}
                  />
                </div>
                <div className="lg:col-span-2">
                  <PorCategoria
                    categorias={resumoPeriodo.categorias}
                    total={resumoPeriodo.totalDespesas}
                    moeda={moeda}
                    ativa={filtroCategoria}
                    onEscolher={escolherCategoria}
                  />
                </div>
              </div>

              <div ref={listaPeriodoRef} className={`scroll-mt-4 overflow-hidden rounded-xl border border-border bg-surface ${carregando ? "opacity-60" : ""}`}>
                <div className="space-y-3 border-b border-border px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto text-sm font-medium">
                      Lançamentos do período <span className="font-normal text-muted">({lancamentos.length})</span>
                    </h3>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Ordenar por
                      <select
                        value={ordenacao}
                        onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
                        className="input w-auto py-1.5 text-xs"
                      >
                        <option value="recentes">Mais recentes</option>
                        <option value="vencimento">Vencimento</option>
                        <option value="valor">Maior valor</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        ["TODOS", "Todos"],
                        ["DESPESA", "Despesas"],
                        ["SANGRIA", "Sangrias"],
                        ["SUPRIMENTO", "Suprimentos"],
                      ] as const
                    ).map(([id, rotulo]) => (
                      <ChipFiltro
                        key={id}
                        ativo={filtroTipo === id}
                        onClick={() => {
                          setFiltroTipo(id);
                          setLimitePeriodo(PAGINA);
                        }}
                      >
                        {rotulo}
                      </ChipFiltro>
                    ))}
                    <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
                    {(
                      [
                        ["TODOS", "Qualquer situação"],
                        ["PENDENTE", "Em aberto"],
                        ["PAGO", "Pagos"],
                      ] as const
                    ).map(([id, rotulo]) => (
                      <ChipFiltro
                        key={id}
                        ativo={filtroStatus === id}
                        onClick={() => {
                          setFiltroStatus(id);
                          setLimitePeriodo(PAGINA);
                        }}
                      >
                        {rotulo}
                      </ChipFiltro>
                    ))}
                    <div className="relative min-w-[12rem] flex-1 sm:max-w-xs sm:flex-none sm:basis-64">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                      <input
                        value={buscaPeriodo}
                        onChange={(e) => {
                          setBuscaPeriodo(e.target.value);
                          setLimitePeriodo(PAGINA);
                        }}
                        placeholder="Buscar fornecedor ou descrição"
                        aria-label="Buscar nos lançamentos do período"
                        className="input py-1.5 pl-8 text-sm"
                      />
                    </div>
                  </div>
                  {filtroCategoria && (
                    <button
                      type="button"
                      onClick={() => escolherCategoria(null)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark"
                    >
                      Categoria: {filtroCategoria}
                      <X className="h-3.5 w-3.5" aria-label="Remover filtro de categoria" />
                    </button>
                  )}
                </div>

                {lancamentos.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    {periodoFiltrando ? (
                      <>
                        <p className="text-sm text-muted">Nenhum lançamento com esses filtros.</p>
                        <button type="button" onClick={limparFiltrosPeriodo} className="text-sm font-medium text-primary hover:underline">
                          Limpar filtros
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted">Nenhum lançamento neste período.</p>
                        <button
                          type="button"
                          onClick={() => setModalAberto(true)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Registrar um lançamento
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-border">{lancamentosVisiveis.map((d) => linha(d, "periodo"))}</ul>
                    {lancamentos.length > limitePeriodo && (
                      <div className="border-t border-border px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setLimitePeriodo((n) => n + PAGINA)}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Mostrar mais ({lancamentos.length - limitePeriodo} restantes)
                        </button>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border bg-background px-4 py-3 text-sm">
                      <span className="text-muted">
                        {lancamentos.length} {lancamentos.length === 1 ? "lançamento" : "lançamentos"}
                      </span>
                      {totaisListados.DESPESA > 0 && (
                        <span>
                          Despesas <strong className="tabular-nums">{moeda(totaisListados.DESPESA)}</strong>
                        </span>
                      )}
                      {totaisListados.SANGRIA > 0 && (
                        <span>
                          Sangrias <strong className="tabular-nums text-danger">{moeda(totaisListados.SANGRIA)}</strong>
                        </span>
                      )}
                      {totaisListados.SUPRIMENTO > 0 && (
                        <span>
                          Suprimentos <strong className="tabular-nums text-info">{moeda(totaisListados.SUPRIMENTO)}</strong>
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {(modalAberto || emEdicao) && (
        <ModalLancamento
          despesa={emEdicao}
          onClose={() => {
            setModalAberto(false);
            setEmEdicao(null);
          }}
          onSalvo={() => {
            setModalAberto(false);
            setEmEdicao(null);
            carregar(undefined, true);
          }}
        />
      )}

      {paraExcluir && (
        <ConfirmarExclusao
          despesa={paraExcluir}
          moeda={moeda}
          excluindo={excluindo}
          onCancelar={() => setParaExcluir(null)}
          onConfirmar={confirmarExclusao}
        />
      )}
    </div>
  );
}
