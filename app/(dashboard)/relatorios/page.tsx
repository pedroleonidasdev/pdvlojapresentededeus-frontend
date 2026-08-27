"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
  dataBrasiliaISO,
  limiteDiaBrasiliaParaUtc,
  LABEL_FORMA_PAGAMENTO,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import {
  Loader2,
  TrendingUp,
  Receipt,
  Wallet,
  Clock,
  User,
  Trash2,
  Download,
  Filter,
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
  const [carregando, setCarregando] = useState(false);
  const [jaGerou, setJaGerou] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [excluindoTodas, setExcluindoTodas] = useState(false);

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
      const { data } = await api.get<Venda[]>("/vendas", { params });
      setVendas(data);
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
    const nomes = new Set(vendas.map((v) => v.usuarioNome));
    return Array.from(nomes).sort();
  }, [vendas]);

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
      if (!formasSelecionadas.has(v.formaPagamento)) return false;
      if (usuarioSelecionado !== "TODOS" && v.usuarioNome !== usuarioSelecionado) return false;
      return true;
    });
  }, [vendas, formasSelecionadas, usuarioSelecionado]);

  // métricas calculadas a partir do que está filtrado, garantindo consistência
  // entre os cards, o gráfico e a lista de vendas exibida
  const metricas = useMemo(() => {
    const totalFaturado = vendasFiltradas.reduce((acc, v) => acc + v.total, 0);
    const quantidadeVendas = vendasFiltradas.length;

    const totalPorFormaPagamento: Record<string, number> = {};
    for (const v of vendasFiltradas) {
      totalPorFormaPagamento[v.formaPagamento] =
        (totalPorFormaPagamento[v.formaPagamento] ?? 0) + v.total;
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

    return { totalFaturado, quantidadeVendas, totalPorFormaPagamento, produtosMaisVendidos };
  }, [vendasFiltradas]);

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

  function exportarExcel() {
    const linhas = vendasFiltradas.map((v) => ({
      Venda: v.id,
      "Data/Hora": formatarDataHora(v.dataHora),
      Vendedor: v.usuarioNome,
      "Forma de pagamento": LABEL_FORMA_PAGAMENTO[v.formaPagamento] ?? v.formaPagamento,
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

    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Vendas");
    XLSX.writeFile(livro, `relatorio-vendas_${inicio}_a_${fim}.xlsx`);
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Faturamento e desempenho de vendas por período" />

      <div className="p-8 space-y-6">
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

            <div className="grid grid-cols-3 gap-4">
              <CardMetrica
                icon={TrendingUp}
                label="Total faturado"
                valor={formatarMoeda(metricas.totalFaturado)}
              />
              <CardMetrica
                icon={Receipt}
                label="Vendas realizadas"
                valor={metricas.quantidadeVendas.toString()}
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
                <h3 className="text-sm font-semibold mb-4">Por forma de pagamento</h3>
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
    </div>
  );
}

function CardMetrica({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ElementType;
  label: string;
  valor: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="w-9 h-9 rounded-lg bg-primary-light flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold font-mono mt-1 tracking-tight">{valor}</p>
    </div>
  );
}
