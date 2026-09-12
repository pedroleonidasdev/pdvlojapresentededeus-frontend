"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Despesa, TipoDespesa, FormaPagamento, Venda } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
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
} from "lucide-react";

const TIPOS: TipoDespesa[] = ["DESPESA", "SANGRIA", "SUPRIMENTO"];

const COR_TIPO: Record<TipoDespesa, string> = {
  DESPESA: "bg-danger-light text-danger",
  SANGRIA: "bg-accent-light text-accent-dark",
  SUPRIMENTO: "bg-primary-light text-primary-dark",
};

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
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const [inicio, setInicio] = useState(primeiroDiaMes.toISOString().slice(0, 10));
  const [fim, setFim] = useState(hoje.toISOString().slice(0, 10));
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [totalFaturado, setTotalFaturado] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [despesaEmEdicao, setDespesaEmEdicao] = useState<Despesa | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<TipoDespesa | "TODOS">("TODOS");
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const params = {
        inicio: limiteDiaBrasiliaParaUtc(inicio, false),
        fim: limiteDiaBrasiliaParaUtc(fim, true),
      };
      const [resDespesas, resVendas] = await Promise.all([
        api.get<Despesa[]>("/despesas", { params }),
        api.get<Venda[]>("/vendas", { params }),
      ]);
      setDespesas(resDespesas.data);
      setTotalFaturado(resVendas.data.reduce((acc, v) => acc + v.total, 0));
    } catch {
      setErro("Não foi possível carregar os dados financeiros do período.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function excluir(id: number) {
    if (!confirm("Excluir este lançamento?")) return;
    setExcluindoId(id);
    try {
      await api.delete(`/despesas/${id}`);
      await carregar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível excluir este lançamento.";
      alert(msg);
    } finally {
      setExcluindoId(null);
    }
  }

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
    };
  }, [despesas, totalFaturado]);

  const despesasFiltradas = useMemo(
    () => (filtroTipo === "TODOS" ? despesas : despesas.filter((d) => d.tipo === filtroTipo)),
    [despesas, filtroTipo]
  );

  return (
    <div>
      <PageHeader
        title="Controle Finanças"
        subtitle="Custos, despesas, sangria e suprimento de caixa"
        action={
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Novo lançamento
          </button>
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
            onClick={carregar}
            disabled={carregando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            Filtrar
          </button>
          <button
            onClick={() => {
              setInicio(dataBrasiliaISO(new Date().toISOString()));
              setFim(dataBrasiliaISO(new Date().toISOString()));
            }}
            className="text-sm text-muted hover:text-primary transition px-2"
          >
            Hoje
          </button>
        </div>

        {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}

        {/* cards de resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <CardResumo
            icone={<TrendingUp className="w-4 h-4" />}
            label="Faturamento bruto"
            valor={totalFaturado}
            cor="text-foreground"
          />
          <CardResumo
            icone={<TrendingDown className="w-4 h-4" />}
            label="Despesas"
            valor={resumo.totalDespesas}
            cor="text-danger"
          />
          <CardResumo
            icone={<ArrowDownCircle className="w-4 h-4" />}
            label="Sangrias"
            valor={resumo.totalSangrias}
            cor="text-accent-dark"
          />
          <CardResumo
            icone={<ArrowUpCircle className="w-4 h-4" />}
            label="Suprimentos"
            valor={resumo.totalSuprimentos}
            cor="text-primary-dark"
          />
          <CardResumo
            icone={<Wallet className="w-4 h-4" />}
            label="Lucro líquido estimado"
            valor={resumo.lucroLiquido}
            cor={resumo.lucroLiquido >= 0 ? "text-primary-dark" : "text-danger"}
            destaque
          />
        </div>
        <p className="text-xs text-muted -mt-3">
          Lucro líquido estimado = faturamento bruto do período − despesas. Sangria e suprimento não entram
          nessa conta: são só dinheiro mudando de lugar, não um custo novo.
        </p>

        {/* despesas por categoria */}
        {resumo.categoriasOrdenadas.length > 0 && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted mb-3 uppercase tracking-wide">
              Despesas por categoria
            </p>
            <div className="space-y-2">
              {resumo.categoriasOrdenadas.map(([categoria, valor]) => {
                const percentual = resumo.totalDespesas > 0 ? (valor / resumo.totalDespesas) * 100 : 0;
                return (
                  <div key={categoria} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 truncate text-foreground">{categoria}</span>
                    <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-danger/70 rounded-full"
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono text-muted">
                      {formatarMoeda(valor)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* lista de lançamentos */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
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
          </div>

          {carregando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : despesasFiltradas.length === 0 ? (
            <p className="text-center text-sm text-muted py-10">Nenhum lançamento no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr className="text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Categoria</th>
                  <th className="px-4 py-2.5 font-medium">Fornecedor</th>
                  <th className="px-4 py-2.5 font-medium">Descrição</th>
                  <th className="px-4 py-2.5 font-medium">Forma</th>
                  <th className="px-4 py-2.5 font-medium">Data</th>
                  <th className="px-4 py-2.5 font-medium">Usuário</th>
                  <th className="px-4 py-2.5 font-medium text-right">Valor</th>
                  <th className="px-4 py-2.5 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {despesasFiltradas.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COR_TIPO[d.tipo]}`}>
                        {LABEL_TIPO_DESPESA[d.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{d.categoria || "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{d.fornecedor || "—"}</td>
                    <td className="px-4 py-2.5 text-foreground">
                      <p>{d.descricao}</p>
                      {d.parcelas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {d.parcelas.map((p) => (
                            <span
                              key={p.numero}
                              className="text-[11px] px-1.5 py-0.5 rounded bg-background text-muted whitespace-nowrap"
                            >
                              {p.numero}ª {formatarMoeda(p.valor)}
                              {p.dataVencimento ? ` — ${formatarDataCurta(p.dataVencimento)}` : " — sem data"}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {LABEL_FORMA_PAGAMENTO[d.formaPagamento]}
                      {d.numeroParcelas && d.numeroParcelas > 1 ? ` (${d.numeroParcelas}x)` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-muted whitespace-nowrap">{formatarDataHora(d.dataHora)}</td>
                    <td className="px-4 py-2.5 text-muted">{d.usuarioNome}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatarMoeda(d.valor)}</td>
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
                ))}
              </tbody>
            </table>
          )}
        </div>
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
            carregar();
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
}: {
  icone: React.ReactNode;
  label: string;
  valor: number;
  cor: string;
  destaque?: boolean;
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
      <p className={`text-lg font-semibold font-mono mt-1 ${cor}`}>{formatarMoeda(valor)}</p>
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
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
