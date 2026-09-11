"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento, Caixa, Troca, Despesa } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
  dataBrasiliaISO,
  limiteDiaBrasiliaParaUtc,
  LABEL_FORMA_PAGAMENTO,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import EditarFormaPagamentoModal from "@/components/EditarFormaPagamentoModal";
import ConfirmarFechamentoCaixaModal from "@/components/ConfirmarFechamentoCaixaModal";
import {
  Loader2,
  TrendingUp,
  Receipt,
  Wallet,
  Clock,
  User,
  Trash2,
  Pencil,
  Download,
  Filter,
  Lock,
  Unlock,
  Vault,
  Repeat,
} from "lucide-react";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

export default function RelatoriosPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [inicio, setInicio] = useState(primeiroDiaMes.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [jaGerou, setJaGerou] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [excluindoTodas, setExcluindoTodas] = useState(false);
  const [vendaEmEdicao, setVendaEmEdicao] = useState<Venda | null>(null);

  // caixa aberto no momento (independe do período filtrado)
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null | undefined>(undefined);
  // histórico de aberturas/fechamentos de caixa dentro do período filtrado
  const [historicoCaixas, setHistoricoCaixas] = useState<Caixa[]>([]);
  // fechamento do caixa atual (somente ADMIN)
  const [valorFinalCaixa, setValorFinalCaixa] = useState<string>("");
  const [fechandoCaixa, setFechandoCaixa] = useState(false);
  const [erroFechamento, setErroFechamento] = useState<string | null>(null);
  // exige confirmação explícita (valor em espécie, não faturamento) antes de fechar
  const [confirmandoFechamento, setConfirmandoFechamento] = useState(false);

  useEffect(() => {
    async function buscarCaixaAtual() {
      try {
        const { data, status } = await api.get<Caixa>("/caixa/atual");
        setCaixaAtual(status === 204 || !data || !("id" in data) ? null : data);
      } catch {
        setCaixaAtual(null);
      }
    }
    buscarCaixaAtual();
  }, []);

  async function fecharCaixa() {
    setFechandoCaixa(true);
    setErroFechamento(null);
    try {
      await api.post("/caixa/fechar", {
        valorFinal: Number(valorFinalCaixa.replace(",", ".")) || 0,
      });
      setCaixaAtual(null);
      setValorFinalCaixa("");
      setConfirmandoFechamento(false);
      // se já havia um relatório gerado, atualiza o histórico de caixas exibido
      if (jaGerou) await gerar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível fechar o caixa.";
      setErroFechamento(msg);
    } finally {
      setFechandoCaixa(false);
    }
  }

  // filtros aplicados sobre o período já carregado
  const [formasSelecionadas, setFormasSelecionadas] = useState<Set<FormaPagamento>>(
    new Set(FORMAS)
  );
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("TODOS");

  async function gerar() {
    setCarregando(true);
    try {
      const params = {
        inicio: limiteDiaBrasiliaParaUtc(inicio, false),
        fim: limiteDiaBrasiliaParaUtc(fim, true),
      };
      const [resVendas, resCaixas, resTrocas, resDespesas] = await Promise.all([
        api.get<Venda[]>("/vendas", { params }),
        api.get<Caixa[]>("/caixa", { params }),
        api.get<Troca[]>("/trocas", { params }),
        api.get<Despesa[]>("/despesas", { params }),
      ]);
      setVendas(resVendas.data);
      setHistoricoCaixas(resCaixas.data);
      setTrocas(resTrocas.data);
      setDespesas(resDespesas.data);
      setJaGerou(true);
      // ao gerar um novo período, reseta os filtros locais
      setFormasSelecionadas(new Set(FORMAS));
      setUsuarioSelecionado("TODOS");
    } finally {
      setCarregando(false);
    }
  }

  async function excluirVenda(id: number) {
    if (!confirm(`Excluir a venda #${id}? O estoque dos produtos será devolvido.`)) return;
    setExcluindoId(id);
    try {
      await api.delete(`/vendas/${id}`);
      await gerar();
    } finally {
      setExcluindoId(null);
    }
  }

  async function excluirTodasAsVendas() {
    if (
      !confirm(
        "Tem certeza que deseja excluir TODAS as vendas do sistema? Essa ação não pode ser desfeita e o estoque de todos os produtos vendidos será devolvido."
      )
    )
      return;
    setExcluindoTodas(true);
    try {
      await api.delete("/vendas");
      await gerar();
    } finally {
      setExcluindoTodas(false);
    }
  }

  const usuariosDoPeriodo = useMemo(() => {
    const nomes = new Set([
      ...vendas.map((v) => v.usuarioNome),
      ...trocas.map((t) => t.usuarioNome),
    ]);
    return Array.from(nomes).sort();
  }, [vendas, trocas]);

  function alternarForma(forma: FormaPagamento) {
    setFormasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(forma)) {
        novo.delete(forma);
      } else {
        novo.add(forma);
      }
      return novo;
    });
  }

  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      const formasDaVenda = v.pagamentos?.length
        ? v.pagamentos.map((p) => p.formaPagamento)
        : [v.formaPagamento];
      if (!formasDaVenda.some((forma) => formasSelecionadas.has(forma))) return false;
      if (usuarioSelecionado !== "TODOS" && v.usuarioNome !== usuarioSelecionado) return false;
      return true;
    });
  }, [vendas, formasSelecionadas, usuarioSelecionado]);

  // trocas sem diferença (formaPagamentoDiferenca nula) sempre entram — não têm
  // forma de pagamento pra filtrar. As com diferença seguem o mesmo filtro das vendas.
  const trocasFiltradas = useMemo(() => {
    return trocas.filter((t) => {
      if (t.formaPagamentoDiferenca && !formasSelecionadas.has(t.formaPagamentoDiferenca)) return false;
      if (usuarioSelecionado !== "TODOS" && t.usuarioNome !== usuarioSelecionado) return false;
      return true;
    });
  }, [trocas, formasSelecionadas, usuarioSelecionado]);

  // métricas calculadas a partir do que está filtrado, garantindo consistência
  // entre os cards, o gráfico e a lista de vendas exibida
  const metricas = useMemo(() => {
    const totalFaturado = vendasFiltradas.reduce((acc, v) => acc + v.total, 0);
    const quantidadeVendas = vendasFiltradas.length;

    // diferença de troca: positiva = cliente pagou a mais (entra dinheiro),
    // negativa = loja devolveu troco (sai dinheiro) — soma líquida das duas.
    const totalTrocas = trocasFiltradas.reduce((acc, t) => acc + t.diferenca, 0);
    const quantidadeTrocas = trocasFiltradas.length;
    const totalLiquido = totalFaturado + totalTrocas;

    const totalPorFormaPagamento: Record<string, number> = {};
    for (const v of vendasFiltradas) {
      if (v.pagamentos?.length) {
        for (const pagamento of v.pagamentos) {
          totalPorFormaPagamento[pagamento.formaPagamento] =
            (totalPorFormaPagamento[pagamento.formaPagamento] ?? 0) + pagamento.valor;
        }
      } else {
        totalPorFormaPagamento[v.formaPagamento] =
          (totalPorFormaPagamento[v.formaPagamento] ?? 0) + v.total;
      }
    }
    for (const t of trocasFiltradas) {
      if (!t.formaPagamentoDiferenca || t.diferenca === 0) continue;
      totalPorFormaPagamento[t.formaPagamentoDiferenca] =
        (totalPorFormaPagamento[t.formaPagamentoDiferenca] ?? 0) + t.diferenca;
    }

    const produtosMap = new Map<string, { quantidadeVendida: number; totalVendido: number }>();
    for (const v of vendasFiltradas) {
      for (const item of v.itens) {
        const atual = produtosMap.get(item.produtoNome) ?? {
          quantidadeVendida: 0,
          totalVendido: 0,
        };
        atual.quantidadeVendida += item.quantidade;
        atual.totalVendido += item.subtotal;
        produtosMap.set(item.produtoNome, atual);
      }
    }
    const produtosMaisVendidos = Array.from(produtosMap.entries())
      .map(([nome, dados]) => ({ nome, ...dados }))
      .sort((a, b) => b.quantidadeVendida - a.quantidadeVendida)
      .slice(0, 10);

    return {
      totalFaturado,
      quantidadeVendas,
      totalTrocas,
      quantidadeTrocas,
      totalLiquido,
      totalPorFormaPagamento,
      produtosMaisVendidos,
    };
  }, [vendasFiltradas, trocasFiltradas]);

  // agrupamento por dia (no fuso de Brasília) para o gráfico
  const vendasPorDia = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const v of vendasFiltradas) {
      const dia = dataBrasiliaISO(v.dataHora);
      mapa.set(dia, (mapa.get(dia) ?? 0) + v.total);
    }
    return Array.from(mapa.entries())
      .map(([dia, total]) => ({ dia, total }))
      .sort((a, b) => a.dia.localeCompare(b.dia));
  }, [vendasFiltradas]);

  const maiorValorDia = useMemo(
    () => Math.max(1, ...vendasPorDia.map((d) => d.total)),
    [vendasPorDia]
  );

  // conferência de cada caixa: quanto em dinheiro entrou (vendas + trocas + suprimento)
  // e saiu (sangria + despesas pagas em dinheiro) durante a janela em que ele ficou
  // aberto, comparado com o valor final informado no fechamento.
  const conferenciaCaixas = useMemo(() => {
    const mapa = new Map<
      number,
      {
        vendasDinheiro: number;
        trocasDinheiro: number;
        suprimentos: number;
        saidasDinheiro: number; // sangria + despesa paga em dinheiro
        saldoEsperado: number;
        diferencaAbertura: number | null;
        diferencaEsperado: number | null;
      }
    >();

    for (const caixa of historicoCaixas) {
      const inicioMs = new Date(caixa.dataAbertura).getTime();
      const fimMs = caixa.dataFechamento ? new Date(caixa.dataFechamento).getTime() : Date.now();
      const dentro = (dataHora: string) => {
        const t = new Date(dataHora).getTime();
        return t >= inicioMs && t <= fimMs;
      };

      const vendasDinheiro = vendas
        .filter((v) => dentro(v.dataHora))
        .reduce((acc, v) => {
          if (v.pagamentos?.length) {
            return acc + v.pagamentos
              .filter((p) => p.formaPagamento === "DINHEIRO")
              .reduce((soma, p) => soma + p.valor, 0);
          }
          return acc + (v.formaPagamento === "DINHEIRO" ? v.total : 0);
        }, 0);

      const trocasDinheiro = trocas
        .filter((t) => t.formaPagamentoDiferenca === "DINHEIRO" && dentro(t.dataHora))
        .reduce((acc, t) => acc + t.diferenca, 0);

      // despesas já vêm vinculadas ao caixa exato (caixaId) quando são em dinheiro,
      // então usamos o vínculo direto em vez da janela de tempo — é mais preciso
      const despesasDoCaixa = despesas.filter((d) => d.caixaId === caixa.id);
      const suprimentos = despesasDoCaixa
        .filter((d) => d.tipo === "SUPRIMENTO")
        .reduce((acc, d) => acc + d.valor, 0);
      const saidasDinheiro = despesasDoCaixa
        .filter((d) => d.tipo === "SANGRIA" || d.tipo === "DESPESA")
        .reduce((acc, d) => acc + d.valor, 0);

      const saldoEsperado =
        caixa.valorInicial + vendasDinheiro + trocasDinheiro + suprimentos - saidasDinheiro;
      const diferencaAbertura = caixa.valorFinal !== null ? caixa.valorFinal - caixa.valorInicial : null;
      const diferencaEsperado = caixa.valorFinal !== null ? caixa.valorFinal - saldoEsperado : null;

      mapa.set(caixa.id, {
        vendasDinheiro,
        trocasDinheiro,
        suprimentos,
        saidasDinheiro,
        saldoEsperado,
        diferencaAbertura,
        diferencaEsperado,
      });
    }
    return mapa;
  }, [historicoCaixas, vendas, trocas, despesas]);

  function exportarExcel() {
    const linhas = vendasFiltradas.map((v) => ({
      Venda: v.id,
      "Data/Hora": formatarDataHora(v.dataHora),
      Vendedor: v.usuarioNome,
      "Forma de pagamento": v.pagamentos?.length
        ? v.pagamentos.map((p) => `${LABEL_FORMA_PAGAMENTO[p.formaPagamento]}: ${formatarMoeda(p.valor)}`).join(" + ")
        : LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
      Subtotal: v.subtotal ?? v.total,
      Desconto: v.valorDesconto ?? 0,
      Total: v.total,
      Itens: v.itens.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
    }));

    const planilha = XLSX.utils.json_to_sheet(linhas);
    planilha["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 50 },
    ];

    const linhasTrocas = trocasFiltradas.map((t) => ({
      Troca: t.id,
      "Data/Hora": formatarDataHora(t.dataHora),
      Vendedor: t.usuarioNome,
      "Venda de origem": t.vendaOrigemId ?? "",
      "Valor devolvido": t.valorDevolvido,
      "Valor novo": t.valorNovo,
      Diferença: t.diferenca,
      "Forma de pagamento da diferença": t.formaPagamentoDiferenca
        ? LABEL_FORMA_PAGAMENTO[t.formaPagamentoDiferenca]
        : "",
      "Itens devolvidos": t.itensDevolvidos.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
      "Itens novos": t.itensNovos.map((i) => `${i.quantidade}x ${i.produtoNome}`).join("; "),
    }));

    const planilhaTrocas = XLSX.utils.json_to_sheet(linhasTrocas);
    planilhaTrocas["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 26 },
      { wch: 40 },
      { wch: 40 },
    ];

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Vendas");
    XLSX.utils.book_append_sheet(livro, planilhaTrocas, "Trocas");
    XLSX.writeFile(livro, `relatorio-vendas_${inicio}_a_${fim}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Faturamento e desempenho de vendas por período" />

      <div className="p-8 space-y-6">
        {/* caixa aberto no momento, em destaque, independente do período filtrado */}
        {caixaAtual !== undefined && (
          <div
            className={`flex flex-wrap items-center gap-4 rounded-xl border p-4 ${
              caixaAtual
                ? "bg-primary-light border-primary/30"
                : "bg-danger-light border-danger/30"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                caixaAtual ? "bg-primary text-white" : "bg-danger text-white"
              }`}
            >
              {caixaAtual ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            {caixaAtual ? (
              <>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <div>
                    <p className="text-[11px] text-primary-dark/70 uppercase tracking-wide font-medium">
                      Caixa aberto — saldo inicial
                    </p>
                    <p className="text-lg font-semibold font-mono text-primary-dark">
                      {formatarMoeda(caixaAtual.valorInicial)}
                    </p>
                  </div>
                  <div className="text-xs text-primary-dark/80 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Aberto por {caixaAtual.usuarioAberturaNome}
                  </div>
                  <div className="text-xs text-primary-dark/80 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {formatarDataHora(caixaAtual.dataAbertura)}
                  </div>
                </div>

                {isAdmin && (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      inputMode="decimal"
                      value={valorFinalCaixa}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorFinalCaixa(v);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && valorFinalCaixa !== "" && setConfirmandoFechamento(true)}
                      placeholder="Dinheiro contado"
                      title="Só o dinheiro em espécie contado na gaveta — não é o faturamento do dia"
                      className="w-36 px-3 py-2 rounded-lg border border-primary/30 bg-white focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                    />
                    <button
                      onClick={() => setConfirmandoFechamento(true)}
                      disabled={fechandoCaixa || valorFinalCaixa === ""}
                      className="flex items-center gap-2 bg-primary-dark hover:bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
                    >
                      {fechandoCaixa && <Loader2 className="w-4 h-4 animate-spin" />}
                      Fechar caixa
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-danger font-medium">Nenhum caixa aberto no momento.</p>
            )}
          </div>
        )}

        {erroFechamento && (
          <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">
            {erroFechamento}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 bg-surface border border-border rounded-xl p-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">De</label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Até</label>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="input"
            />
          </div>
          <button
            onClick={gerar}
            disabled={carregando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Gerar relatório
          </button>

          {jaGerou && vendasFiltradas.length > 0 && (
            <button
              onClick={exportarExcel}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition h-fit"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
          )}

          {isAdmin && vendas.length > 0 && (
            <button
              onClick={excluirTodasAsVendas}
              disabled={excluindoTodas}
              className="ml-auto flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-60 h-fit"
            >
              {excluindoTodas ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Excluir todas as vendas
            </button>
          )}
        </div>

        {jaGerou && (
          <>
            {/* filtros locais sobre o período já carregado */}
            <div className="flex flex-wrap items-center gap-4 bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Filter className="w-3.5 h-3.5" />
                Filtros
              </div>

              <div className="flex flex-wrap gap-2">
                {FORMAS.map((forma) => {
                  const ativo = formasSelecionadas.has(forma);
                  return (
                    <button
                      key={forma}
                      onClick={() => alternarForma(forma)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        ativo
                          ? "border-primary bg-primary-light text-primary-dark font-medium"
                          : "border-border text-muted hover:border-primary/40"
                      }`}
                    >
                      {LABEL_FORMA_PAGAMENTO[forma]}
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="text-xs text-muted">Vendedor</label>
                <select
                  value={usuarioSelecionado}
                  onChange={(e) => setUsuarioSelecionado(e.target.value)}
                  className="input w-auto"
                >
                  <option value="TODOS">Todos</option>
                  {usuariosDoPeriodo.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CardMetrica
                icon={TrendingUp}
                label="Faturamento líquido"
                valor={formatarMoeda(metricas.totalLiquido)}
                subtitulo={
                  metricas.totalTrocas !== 0
                    ? `${formatarMoeda(metricas.totalFaturado)} em vendas ${metricas.totalTrocas > 0 ? "+" : "-"} ${formatarMoeda(Math.abs(metricas.totalTrocas))} em trocas`
                    : undefined
                }
              />
              <CardMetrica
                icon={Receipt}
                label="Vendas realizadas"
                valor={metricas.quantidadeVendas.toString()}
              />
              <CardMetrica
                icon={Repeat}
                label="Trocas no período"
                valor={metricas.quantidadeTrocas.toString()}
                subtitulo={
                  metricas.quantidadeTrocas > 0
                    ? `${metricas.totalTrocas >= 0 ? "+" : "-"}${formatarMoeda(Math.abs(metricas.totalTrocas))} de ajuste`
                    : undefined
                }
              />
              <CardMetrica
                icon={Wallet}
                label="Ticket médio"
                valor={formatarMoeda(
                  metricas.quantidadeVendas > 0
                    ? metricas.totalFaturado / metricas.quantidadeVendas
                    : 0
                )}
              />
            </div>

            {/* gráfico de vendas por dia */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Vendas por dia</h3>
              {vendasPorDia.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma venda no período.</p>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {vendasPorDia.map(({ dia, total }) => {
                    const alturaPct = Math.max(4, (total / maiorValorDia) * 100);
                    const [, mes, diaNum] = dia.split("-");
                    return (
                      <div
                        key={dia}
                        className="flex-1 flex flex-col items-center justify-end h-full group relative"
                      >
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition text-[11px] bg-primary-dark text-white px-2 py-1 rounded whitespace-nowrap pointer-events-none z-10">
                          {formatarMoeda(total)}
                        </div>
                        <div
                          className="w-full bg-primary hover:bg-primary-dark rounded-t transition-all"
                          style={{ height: `${alturaPct}%` }}
                        />
                        <span className="text-[10px] text-muted mt-1.5 font-mono">
                          {diaNum}/{mes}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-1">Por forma de pagamento</h3>
                <p className="text-[11px] text-muted mb-3">Vendas e ajuste de trocas já somados</p>
                <ul className="space-y-3">
                  {Object.entries(metricas.totalPorFormaPagamento).map(([forma, valor]) => (
                    <li key={forma} className="flex items-center justify-between text-sm">
                      <span className="text-muted">{LABEL_FORMA_PAGAMENTO[forma] ?? forma}</span>
                      <span className="font-mono font-medium">{formatarMoeda(valor)}</span>
                    </li>
                  ))}
                  {Object.keys(metricas.totalPorFormaPagamento).length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>

              <div className="bg-surface border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Produtos mais vendidos</h3>
                <ul className="space-y-3">
                  {metricas.produtosMaisVendidos.map((p, idx) => (
                    <li key={p.nome} className="flex items-center justify-between text-sm gap-2">
                      <span className="text-muted truncate">
                        <span className="font-mono text-xs text-primary mr-2">
                          {(idx + 1).toString().padStart(2, "0")}
                        </span>
                        {p.nome}
                      </span>
                      <span className="font-mono font-medium whitespace-nowrap">
                        {p.quantidadeVendida}x
                      </span>
                    </li>
                  ))}
                  {metricas.produtosMaisVendidos.length === 0 && (
                    <p className="text-sm text-muted">Nenhuma venda no período.</p>
                  )}
                </ul>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                <Vault className="w-4 h-4 text-primary" />
                Conciliação de caixa
              </h3>
              <p className="text-[11px] text-muted mb-4">
                Compara o que deveria estar na gaveta com o que foi contado no fechamento
              </p>

              {historicoCaixas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma abertura de caixa no período.</p>
              ) : (
                <div className="space-y-3">
                  {historicoCaixas.map((caixa) => {
                    const conf = conferenciaCaixas.get(caixa.id);
                    const diferenca = conf?.diferencaEsperado ?? null;
                    const confere = diferenca !== null ? Math.abs(diferenca) < 0.01 : null;
                    const sobra = diferenca !== null && diferenca > 0;

                    return (
                      <div key={caixa.id} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-background">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium ${
                                caixa.aberto
                                  ? "bg-primary-light text-primary-dark"
                                  : "bg-border text-foreground"
                              }`}
                            >
                              {caixa.aberto ? "Aberto" : "Fechado"}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Aberto por {caixa.usuarioAberturaNome}, {formatarDataHora(caixa.dataAbertura)}
                            </span>
                            {!caixa.aberto && caixa.dataFechamento && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Fechado por {caixa.usuarioFechamentoNome}, {formatarDataHora(caixa.dataFechamento)}
                              </span>
                            )}
                          </div>
                          {confere !== null && (
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                confere
                                  ? "bg-primary-light text-primary-dark"
                                  : sobra
                                    ? "bg-accent-light text-accent-dark"
                                    : "bg-danger-light text-danger"
                              }`}
                            >
                              {confere ? "Confere" : sobra ? "Sobra em caixa" : "Falta em caixa"}
                            </span>
                          )}
                        </div>

                        {caixa.valorFinal !== null && conf ? (
                          <div className="px-4 py-3">
                            <div className="space-y-1.5">
                              <LinhaConciliacao label="Saldo inicial" valor={caixa.valorInicial} />
                              <LinhaConciliacao
                                label="Vendas em dinheiro"
                                valor={conf.vendasDinheiro}
                                comSinal
                              />
                              {conf.trocasDinheiro !== 0 && (
                                <LinhaConciliacao
                                  label="Ajuste de trocas em dinheiro"
                                  valor={conf.trocasDinheiro}
                                  comSinal
                                />
                              )}
                              {conf.suprimentos !== 0 && (
                                <LinhaConciliacao label="Suprimento (reforço)" valor={conf.suprimentos} comSinal />
                              )}
                              {conf.saidasDinheiro !== 0 && (
                                <LinhaConciliacao
                                  label="Sangria / despesas em dinheiro"
                                  valor={-conf.saidasDinheiro}
                                  comSinal
                                />
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-dashed border-border text-xs">
                              <span className="text-muted">Esperado na gaveta</span>
                              <span className="font-mono">{formatarMoeda(conf.saldoEsperado)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted">Contado no fechamento</span>
                              <span className="font-mono">{formatarMoeda(caixa.valorFinal)}</span>
                            </div>
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                              <span className="text-sm font-medium">Diferença</span>
                              <span
                                className={`font-mono text-base font-semibold ${
                                  confere ? "text-primary-dark" : sobra ? "text-accent-dark" : "text-danger"
                                }`}
                              >
                                {diferenca !== null && diferenca > 0 ? "+" : ""}
                                {formatarMoeda(diferenca ?? 0)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 text-xs text-muted">
                            Caixa ainda aberto — a conferência aparece depois do fechamento.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-primary" />
                Trocas do período
              </h3>

              {trocasFiltradas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma troca no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {trocasFiltradas.map((troca) => (
                    <li key={troca.id} className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="font-mono text-primary">Troca #{troca.id}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatarDataHora(troca.dataHora)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {troca.usuarioNome}
                        </span>
                        {troca.vendaOrigemId && <span>Ref. venda #{troca.vendaOrigemId}</span>}
                      </div>
                      <div className="flex items-center gap-4 font-mono text-sm">
                        <span title="Valor dos produtos devolvidos">
                          <span className="text-muted text-xs">Devolvido: </span>
                          {formatarMoeda(troca.valorDevolvido)}
                        </span>
                        <span title="Valor dos produtos novos levados">
                          <span className="text-muted text-xs">Novo: </span>
                          {formatarMoeda(troca.valorNovo)}
                        </span>
                        {troca.diferenca !== 0 && (
                          <span>
                            <span className="text-muted text-xs">
                              {troca.diferenca > 0 ? "Cliente pagou" : "Loja devolveu"}
                              {troca.formaPagamentoDiferenca
                                ? ` (${LABEL_FORMA_PAGAMENTO[troca.formaPagamentoDiferenca]})`
                                : ""}
                              :{" "}
                            </span>
                            <span className={troca.diferenca > 0 ? "text-primary-dark" : "text-danger"}>
                              {formatarMoeda(Math.abs(troca.diferenca))}
                            </span>
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Vendas do período</h3>

              {vendasFiltradas.length === 0 ? (
                <p className="text-sm text-muted">Nenhuma venda no período.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {vendasFiltradas.map((venda) => (
                    <li key={venda.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono text-primary">
                            Venda #{venda.id}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatarDataHora(venda.dataHora)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {venda.usuarioNome}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-primary-light text-primary-dark font-medium">
                              {LABEL_FORMA_PAGAMENTO[venda.formaPagamento]}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                            {formatarMoeda(venda.total)}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => setVendaEmEdicao(venda)}
                              className="text-muted hover:text-primary"
                              title="Editar forma de pagamento"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => excluirVenda(venda.id)}
                              disabled={excluindoId === venda.id}
                              className="text-danger/60 hover:text-danger disabled:opacity-40"
                              title="Excluir venda"
                            >
                              {excluindoId === venda.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <ul className="font-mono text-xs text-muted space-y-1 pl-1">
                        {venda.itens.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2">
                            <span>
                              {item.quantidade}x {item.produtoNome}
                            </span>
                            <span>{formatarMoeda(item.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {vendaEmEdicao && (
        <EditarFormaPagamentoModal
          venda={vendaEmEdicao}
          onFechar={() => setVendaEmEdicao(null)}
          onSalvo={gerar}
        />
      )}

      {confirmandoFechamento && (
        <ConfirmarFechamentoCaixaModal
          valor={Number(valorFinalCaixa.replace(",", ".")) || 0}
          confirmando={fechandoCaixa}
          erro={erroFechamento}
          onCancelar={() => setConfirmandoFechamento(false)}
          onConfirmar={fecharCaixa}
        />
      )}
    </div>
  );
}

function LinhaConciliacao({
  label,
  valor,
  comSinal,
}: {
  label: string;
  valor: number;
  comSinal?: boolean;
}) {
  const sinal = comSinal && valor > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-mono">
        {sinal}
        {formatarMoeda(valor)}
      </span>
    </div>
  );
}

function CardMetrica({
  icon: Icon,
  label,
  valor,
  subtitulo,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
  subtitulo?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold font-mono mt-1 tracking-tight">{valor}</p>
      {subtitulo && <p className="text-[11px] text-muted mt-1">{subtitulo}</p>}
    </div>
  );
}
