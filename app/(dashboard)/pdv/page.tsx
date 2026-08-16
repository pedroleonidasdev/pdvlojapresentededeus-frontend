"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Produto, FormaPagamento, Venda } from "@/lib/types";
import { formatarMoeda, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Search, Trash2, Plus, Minus, ShoppingCart, CheckCircle2, Loader2 } from "lucide-react";

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

export default function PdvPage() {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("PIX");
  const [buscando, setBuscando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vendaConcluida, setVendaConcluida] = useState<Venda | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    const somenteNumeros = /^[0-9]+$/.test(termo);

    const timeout = setTimeout(async () => {
      setBuscando(true);
      try {
        if (somenteNumeros) {
          try {
            const { data } = await api.get<Produto>(`/produtos/codigo-barras/${termo}`);
            setResultados([data]);
          } catch {
            setResultados([]);
          }
        } else {
          const { data } = await api.get<Produto[]>("/produtos", { params: { nome: termo } });
          setResultados(data);
        }
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  async function buscarPorCodigoBarras(codigo: string) {
    try {
      const { data } = await api.get<Produto>(`/produtos/codigo-barras/${codigo}`);
      adicionarAoCarrinho(data);
      setBusca("");
      setResultados([]);
    } catch {
      setErro(`Produto não encontrado para o código ${codigo}`);
    }
  }

  function handleBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && busca.trim().length >= 4 && /^[0-9]+$/.test(busca.trim())) {
      buscarPorCodigoBarras(busca.trim());
    }
  }

  function adicionarAoCarrinho(produto: Produto) {
    setErro(null);
    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id);
      if (existente) {
        if (existente.quantidade + 1 > produto.quantidadeEstoque) {
          setErro(`Estoque insuficiente para ${produto.nome}`);
          return prev;
        }
        return prev.map((i) =>
          i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      if (produto.quantidadeEstoque < 1) {
        setErro(`${produto.nome} está sem estoque`);
        return prev;
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(produtoId: number, delta: number) {
    setCarrinho((prev) =>
      prev
        .map((i) => {
          if (i.produto.id !== produtoId) return i;
          const novaQtd = i.quantidade + delta;
          if (novaQtd > i.produto.quantidadeEstoque) {
            setErro(`Estoque insuficiente para ${i.produto.nome}`);
            return i;
          }
          return { ...i, quantidade: novaQtd };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  function removerItem(produtoId: number) {
    setCarrinho((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  const total = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0),
    [carrinho]
  );

  async function finalizarVenda() {
    if (carrinho.length === 0) return;
    setFinalizando(true);
    setErro(null);
    try {
      const { data } = await api.post<Venda>("/vendas", {
        formaPagamento,
        itens: carrinho.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      setVendaConcluida(data);
      setCarrinho([]);
      setFormaPagamento("PIX");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível concluir a venda.";
      setErro(msg);
    } finally {
      setFinalizando(false);
    }
  }

  if (vendaConcluida) {
    return <ComprovanteVenda venda={vendaConcluida} onNovaVenda={() => setVendaConcluida(null)} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Venda" subtitle="Busque um produto pelo nome ou código de barras" />

      <div className="flex-1 flex overflow-hidden">
        {/* Coluna de busca de produtos */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              placeholder="Nome do produto ou código de barras + Enter"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
            />
            {buscando && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted" />
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {resultados.length === 0 && busca.trim().length >= 2 && !buscando && (
              <p className="text-sm text-muted px-1">Nenhum produto encontrado.</p>
            )}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {resultados.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => adicionarAoCarrinho(produto)}
                  disabled={produto.quantidadeEstoque < 1}
                  className="text-left p-4 rounded-xl border border-border bg-surface hover:border-primary hover:shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm text-foreground leading-tight">{produto.nome}</p>
                  <p className="text-xs text-muted mt-1">
                    {produto.categoria?.nome ?? "Sem categoria"}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono font-semibold text-primary">
                      {formatarMoeda(produto.precoVenda)}
                    </span>
                    <span className="text-[11px] text-muted">
                      {produto.quantidadeEstoque} em estoque
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna do carrinho / recibo */}
        <div className="w-[380px] shrink-0 bg-surface border-l border-border flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Carrinho</h2>
            <span className="ml-auto text-xs text-muted font-mono">
              {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 receipt-dashed">
            {carrinho.length === 0 ? (
              <p className="text-sm text-muted text-center mt-10">
                Nenhum produto adicionado ainda.
              </p>
            ) : (
              <ul className="space-y-3 font-mono text-sm">
                {carrinho.map((item) => (
                  <li key={item.produto.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{item.produto.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, -1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs">{item.quantidade}</span>
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, 1)}
                          className="w-5 h-5 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removerItem(item.produto.id)}
                          className="ml-1 text-danger/70 hover:text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-foreground whitespace-nowrap">
                      {formatarMoeda(item.produto.precoVenda * item.quantidade)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-5 py-4 space-y-4">
            <div>
              <p className="text-xs text-muted mb-2">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {FORMAS.map((forma) => (
                  <button
                    key={forma}
                    onClick={() => setFormaPagamento(forma)}
                    className={`text-xs py-2 rounded-lg border transition ${formaPagamento === forma
                        ? "border-primary bg-primary-light text-primary-dark font-medium"
                        : "border-border text-muted hover:border-primary/40"
                      }`}
                  >
                    {LABEL_FORMA_PAGAMENTO[forma]}
                  </button>
                ))}
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">{erro}</div>
            )}

            <div className="flex items-center justify-between font-mono">
              <span className="text-sm text-muted">Total</span>
              <span className="text-xl font-semibold text-foreground">{formatarMoeda(total)}</span>
            </div>

            <button
              onClick={finalizarVenda}
              disabled={carrinho.length === 0 || finalizando}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
            >
              {finalizando && <Loader2 className="w-4 h-4 animate-spin" />}
              Finalizar venda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComprovanteVenda({ venda, onNovaVenda }: { venda: Venda; onNovaVenda: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="bg-primary text-white px-6 py-5 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">Venda concluída</p>
          <p className="text-xs text-white/70 mt-0.5">Venda #{venda.id}</p>
        </div>

        <div className="p-6 font-mono text-sm receipt-dashed">
          <ul className="space-y-2">
            {venda.itens.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="text-muted">
                  {item.quantidade}x {item.produtoNome}
                </span>
                <span>{formatarMoeda(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border mt-4 pt-4 flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatarMoeda(venda.total)}</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Pagamento: {LABEL_FORMA_PAGAMENTO[venda.formaPagamento]}
          </p>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={onNovaVenda}
            className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition"
          >
            Nova venda
          </button>
        </div>
      </div>
    </div>
  );
}