"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Produto, FormaPagamento } from "@/lib/types";
import {
  formatarMoeda,
  paraInputDataHoraLocal,
  deInputDataHoraLocalParaUtc,
  dataBrasiliaISO,
  LABEL_FORMA_PAGAMENTO,
} from "@/lib/format";
import { X, Loader2, CalendarClock, Search, Plus, Minus, Trash2, User, CreditCard, History } from "lucide-react";

type FormaSimples = Exclude<FormaPagamento, "MULTIPLO">;
const FORMAS: FormaSimples[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

interface UsuarioListado {
  id: number;
  nome: string;
  login: string;
  ativo: boolean;
}

interface ItemSelecionado {
  produto: Produto;
  quantidade: number;
}

interface LinhaPagamento {
  forma: FormaSimples;
  valor: string; // só é usado quando há mais de uma forma de pagamento
}

function paraNumero(texto: string): number {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/**
 * Registra uma venda que aconteceu antes e não foi lançada (ex.: o funcionário
 * fechou o caixa e continuou vendendo). Só ADMIN: o botão que abre este modal só
 * aparece para ADMIN (ver vendas/page.tsx) e o backend valida de novo.
 * A venda baixa o estoque e usa o preço atual dos produtos, igual a uma venda normal.
 */
export default function AdicionarVendaModal({
  onFechar,
  onSalvo,
}: {
  onFechar: () => void;
  /** recebe o dia da venda ("YYYY-MM-DD", fuso de Brasília) para a lista mostrar essa data */
  onSalvo: (dia: string) => void;
}) {
  const { usuario } = useAuth();

  // horário atual de Brasília no formato do input — serve de padrão e de limite máximo
  const [agoraLocal] = useState(() => paraInputDataHoraLocal(new Date().toISOString()));
  const [dataHoraLocal, setDataHoraLocal] = useState(agoraLocal);

  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [vendedorId, setVendedorId] = useState("");

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<ItemSelecionado[]>([]);

  const [percentual, setPercentual] = useState("");
  const [descontoValor, setDescontoValor] = useState("");
  const [pagamentos, setPagamentos] = useState<LinhaPagamento[]>([{ forma: "DINHEIRO", valor: "" }]);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.get<Produto[]>("/produtos"), api.get<UsuarioListado[]>("/usuarios")])
      .then(([resProdutos, resUsuarios]) => {
        setProdutos(resProdutos.data.filter((p) => p.ativo !== false));
        setUsuarios(resUsuarios.data.filter((u) => u.ativo));
      })
      .catch(() => setErro("Não foi possível carregar produtos e usuários. Feche e tente de novo."))
      .finally(() => setCarregandoDados(false));
  }, []);

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return produtos
      .filter((p) => p.nome.toLowerCase().includes(termo) || (p.codigoBarras ?? "").includes(termo))
      .slice(0, 8);
  }, [busca, produtos]);

  function adicionarProduto(produto: Produto) {
    setItens((atual) => {
      const existente = atual.find((i) => i.produto.id === produto.id);
      if (existente) {
        return atual.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...atual, { produto, quantidade: 1 }];
    });
    setBusca("");
  }

  function alterarQuantidade(produtoId: number, quantidade: number) {
    setItens((atual) =>
      atual.map((i) => (i.produto.id === produtoId ? { ...i, quantidade: Math.max(1, Math.min(9999, quantidade || 1)) } : i))
    );
  }

  // mesma conta do backend (VendaService): percentual + valor em R$ se somam e nunca passam do subtotal
  const subtotal = arredondar(itens.reduce((soma, i) => soma + i.produto.precoVenda * i.quantidade, 0));
  const descontoPercentual = arredondar((subtotal * paraNumero(percentual)) / 100);
  const desconto = Math.min(arredondar(descontoPercentual + paraNumero(descontoValor)), subtotal);
  const total = arredondar(subtotal - desconto);

  const dividido = pagamentos.length > 1;
  const somaPagamentos = arredondar(pagamentos.reduce((s, p) => s + paraNumero(p.valor), 0));
  const diferenca = arredondar(total - somaPagamentos);

  function alterarPagamento(indice: number, mudanca: Partial<LinhaPagamento>) {
    setPagamentos((atual) => atual.map((p, i) => (i === indice ? { ...p, ...mudanca } : p)));
  }

  function adicionarFormaPagamento() {
    const usadas = new Set(pagamentos.map((p) => p.forma));
    const proxima = FORMAS.find((f) => !usadas.has(f)) ?? FORMAS[0];
    // ao dividir, a forma atual passa a ter o valor total preenchido para o usuário ajustar
    setPagamentos((atual) => [
      ...atual.map((p, i) => (i === 0 && !p.valor ? { ...p, valor: total.toFixed(2) } : p)),
      { forma: proxima, valor: "" },
    ]);
  }

  const dataFutura = !!dataHoraLocal && dataHoraLocal > agoraLocal;

  let motivoBloqueio: string | null = null;
  if (!dataHoraLocal) motivoBloqueio = "Informe a data e hora da venda.";
  else if (dataFutura) motivoBloqueio = "A data e hora da venda não pode estar no futuro.";
  else if (itens.length === 0) motivoBloqueio = "Adicione pelo menos um produto.";
  else if (total <= 0) motivoBloqueio = "O total da venda precisa ser maior que zero.";
  else if (dividido && pagamentos.some((p) => paraNumero(p.valor) <= 0)) motivoBloqueio = "Informe o valor de cada forma de pagamento.";
  else if (dividido && diferenca !== 0) motivoBloqueio = `A soma dos pagamentos deve ser ${formatarMoeda(total)}.`;

  async function salvar() {
    if (motivoBloqueio) return;
    setSalvando(true);
    setErro(null);
    const dataHoraUtc = deInputDataHoraLocalParaUtc(dataHoraLocal);
    try {
      await api.post("/vendas/retroativa", {
        dataHora: dataHoraUtc,
        usuarioId: vendedorId ? Number(vendedorId) : undefined,
        ...(dividido
          ? { pagamentos: pagamentos.map((p) => ({ formaPagamento: p.forma, valor: paraNumero(p.valor) })) }
          : { formaPagamento: pagamentos[0].forma }),
        percentualDesconto: paraNumero(percentual) || undefined,
        valorDescontoInformado: paraNumero(descontoValor) || undefined,
        itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      onSalvo(dataBrasiliaISO(dataHoraUtc));
      onFechar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível registrar a venda.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl ring-1 ring-white/40">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Adicionar venda anterior
          </h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <p className="text-xs text-muted">
            Use para lançar uma venda que já aconteceu e não foi registrada (por exemplo, feita depois do fechamento do
            caixa). O estoque dos produtos será baixado e o preço usado é o atual de cada produto.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Data e hora da venda (horário de Brasília)
              </label>
              <input
                type="datetime-local"
                value={dataHoraLocal}
                max={agoraLocal}
                onChange={(e) => setDataHoraLocal(e.target.value)}
                className="input w-full"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1.5">
                <User className="w-3.5 h-3.5" />
                Vendedor
              </label>
              <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="input w-full">
                <option value="">Eu mesmo ({usuario?.nome})</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ---------- Produtos ---------- */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Produtos vendidos</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={carregandoDados ? "Carregando produtos..." : "Buscar produto por nome ou código..."}
                disabled={carregandoDados}
                className="input w-full pl-10!"
              />
              {sugestoes.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
                  {sugestoes.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => adicionarProduto(p)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-primary-soft transition"
                      >
                        <span className="min-w-0 truncate">{p.nome}</span>
                        <span className="shrink-0 font-mono text-xs text-muted">{formatarMoeda(p.precoVenda)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {busca.trim() && sugestoes.length === 0 && !carregandoDados && (
                <p className="mt-1 text-xs text-muted">Nenhum produto encontrado.</p>
              )}
            </div>

            {itens.length > 0 && (
              <ul className="mt-3 divide-y divide-border/60 rounded-xl border border-border">
                {itens.map((i) => (
                  <li key={i.produto.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{i.produto.nome}</p>
                      <p className="text-[11px] text-muted font-mono">{formatarMoeda(i.produto.precoVenda)} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(i.produto.id, i.quantidade - 1)}
                        disabled={i.quantidade <= 1}
                        aria-label="Diminuir quantidade"
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted hover:bg-background disabled:opacity-40"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        inputMode="numeric"
                        value={i.quantidade}
                        onChange={(e) => alterarQuantidade(i.produto.id, Number(e.target.value.replace(/\D/g, "")))}
                        aria-label={`Quantidade de ${i.produto.nome}`}
                        className="w-12 text-center text-sm py-1 rounded-md border border-border bg-background"
                      />
                      <button
                        type="button"
                        onClick={() => alterarQuantidade(i.produto.id, i.quantidade + 1)}
                        aria-label="Aumentar quantidade"
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted hover:bg-background"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="w-24 text-right font-mono text-sm font-semibold tabular-nums">
                      {formatarMoeda(i.produto.precoVenda * i.quantidade)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setItens((atual) => atual.filter((x) => x.produto.id !== i.produto.id))}
                      aria-label={`Remover ${i.produto.nome}`}
                      className="p-1.5 rounded-md text-muted hover:bg-danger-light hover:text-danger transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---------- Desconto ---------- */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Desconto (%) — opcional</label>
              <input
                inputMode="decimal"
                value={percentual}
                onChange={(e) => setPercentual(e.target.value)}
                placeholder="0"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Desconto (R$) — opcional</label>
              <input
                inputMode="decimal"
                value={descontoValor}
                onChange={(e) => setDescontoValor(e.target.value)}
                placeholder="0,00"
                className="input w-full"
              />
            </div>
          </div>

          {/* ---------- Pagamento ---------- */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Forma de pagamento
            </label>
            <div className="space-y-2">
              {pagamentos.map((p, indice) => (
                <div key={indice} className="flex items-center gap-2">
                  <select
                    value={p.forma}
                    onChange={(e) => alterarPagamento(indice, { forma: e.target.value as FormaSimples })}
                    className="input flex-1"
                  >
                    {FORMAS.map((f) => (
                      <option key={f} value={f}>
                        {LABEL_FORMA_PAGAMENTO[f]}
                      </option>
                    ))}
                  </select>
                  {dividido && (
                    <input
                      inputMode="decimal"
                      value={p.valor}
                      onChange={(e) => alterarPagamento(indice, { valor: e.target.value })}
                      placeholder="Valor R$"
                      aria-label={`Valor em ${LABEL_FORMA_PAGAMENTO[p.forma]}`}
                      className="input w-32"
                    />
                  )}
                  {dividido && (
                    <button
                      type="button"
                      onClick={() => setPagamentos((atual) => atual.filter((_, i) => i !== indice))}
                      aria-label="Remover forma de pagamento"
                      className="p-1.5 rounded-md text-muted hover:bg-danger-light hover:text-danger transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pagamentos.length < FORMAS.length && (
              <button
                type="button"
                onClick={adicionarFormaPagamento}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="w-3 h-3" />
                Dividir em mais de uma forma de pagamento
              </button>
            )}
            {dividido && diferenca !== 0 && (
              <p className="mt-1 text-xs text-accent-dark">
                {diferenca > 0 ? `Faltam ${formatarMoeda(diferenca)}` : `Passou ${formatarMoeda(-diferenca)}`} para fechar o total.
              </p>
            )}
          </div>

          {/* ---------- Resumo ---------- */}
          <div className="rounded-xl bg-primary-soft border border-primary/20 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="font-mono">{formatarMoeda(subtotal)}</span>
            </div>
            {desconto > 0 && (
              <div className="flex justify-between text-muted">
                <span>Desconto</span>
                <span className="font-mono">− {formatarMoeda(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-primary-dark text-base">
              <span>Total</span>
              <span className="font-mono">{formatarMoeda(total)}</span>
            </div>
          </div>

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
          {!erro && motivoBloqueio && itens.length > 0 && (
            <p className="text-xs text-muted">{motivoBloqueio}</p>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2 shrink-0">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-background transition"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !!motivoBloqueio}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar venda
          </button>
        </div>
      </div>
    </div>
  );
}
