"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { Produto, FormaPagamento, Venda, Caixa } from "@/lib/types";
import { imprimirCupom } from "@/lib/impressora";
import { formatarMoeda, formatarDataHora, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { Search, Trash2, Plus, Minus, ShoppingCart, CheckCircle2, Loader2, Tag, DollarSign, Lock, Printer } from "lucide-react";

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

const FORMAS: Exclude<FormaPagamento, "MULTIPLO">[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

export default function PdvPage() {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("PIX");
  const [pagamentoMultiplo, setPagamentoMultiplo] = useState(false);
  const [pagamentos, setPagamentos] = useState<{ formaPagamento: Exclude<FormaPagamento, "MULTIPLO">; valor: string }[]>([]);
  const [descontoPercentual, setDescontoPercentual] = useState<string>("");
  const [descontoDinheiro, setDescontoDinheiro] = useState<string>("");
  const [valorRecebido, setValorRecebido] = useState<string>("");
  const [buscando, setBuscando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vendaConcluida, setVendaConcluida] = useState<Venda | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null | undefined>(undefined);
  const [valorInicialCaixa, setValorInicialCaixa] = useState<string>("");
  const [abrindoCaixa, setAbrindoCaixa] = useState(false);
  // referÃªncia do campo de busca: leitores de cÃ³digo de barras baratos funcionam como
  // um teclado (digitam o cÃ³digo + Enter em quem estiver com foco no momento). Se o
  // foco escapar do campo â€” por exemplo depois de clicar num produto com o mouse â€” o
  // prÃ³ximo disparo do leitor se perde. Por isso devolvemos o foco a este campo apÃ³s
  // cada produto adicionado.
  const buscaInputRef = useRef<HTMLInputElement>(null);
  const [erroCaixa, setErroCaixa] = useState<string | null>(null);
  // guarda sÃ­ncrona contra duplo-clique/duplo-toque: o estado `finalizando` jÃ¡ desabilita o
  // botÃ£o, mas a atualizaÃ§Ã£o de estado sÃ³ reflete no DOM apÃ³s o re-render, e dois cliques
  // muito prÃ³ximos podem disparar o handler antes disso. O ref bloqueia imediatamente.
  const enviandoVendaRef = useRef(false);

  useEffect(() => {
    async function verificarCaixa() {
      try {
        const { data, status } = await api.get<Caixa>("/caixa/atual");
        setCaixa(status === 204 || !data || !("id" in data) ? null : data);
      } catch {
        setCaixa(null);
      }
    }
    verificarCaixa();
  }, []);

  async function abrirCaixa() {
    setAbrindoCaixa(true);
    setErroCaixa(null);
    try {
      const { data } = await api.post<Caixa>("/caixa/abrir", {
        valorInicial: Number(valorInicialCaixa.replace(",", ".")) || 0,
      });
      setCaixa(data);
      setValorInicialCaixa("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "NÃ£o foi possÃ­vel abrir o caixa.";
      setErroCaixa(msg);
    } finally {
      setAbrindoCaixa(false);
    }
  }

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
      setErro(`Produto nÃ£o encontrado para o cÃ³digo ${codigo}`);
    } finally {
      buscaInputRef.current?.focus();
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
        setErro(`${produto.nome} estÃ¡ sem estoque`);
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

  const subtotal = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0),
    [carrinho]
  );

  const descontoPercentualValido = useMemo(() => {
    const valor = parseFloat(descontoPercentual.replace(",", "."));
    if (isNaN(valor) || valor < 0) return 0;
    if (valor > 100) return 100;
    return valor;
  }, [descontoPercentual]);

  const descontoDinheiroValido = useMemo(() => {
    const valor = parseFloat(descontoDinheiro.replace(",", "."));
    if (isNaN(valor) || valor < 0) return 0;
    return valor;
  }, [descontoDinheiro]);

  const valorDesconto = useMemo(() => {
    const percentual = (subtotal * descontoPercentualValido) / 100;
    return Math.min(percentual + descontoDinheiroValido, subtotal);
  }, [subtotal, descontoPercentualValido, descontoDinheiroValido]);

  const total = useMemo(() => subtotal - valorDesconto, [subtotal, valorDesconto]);
  const totalPagamentos = useMemo(
    () => pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor.replace(",", ".")) || 0), 0),
    [pagamentos]
  );
  const restantePagamento = Math.max(0, total - totalPagamentos);
  const pagamentosCompletos = !pagamentoMultiplo || Math.abs(totalPagamentos - total) < 0.005;


  const valorRecebidoValido = useMemo(() => {
    const valor = parseFloat(valorRecebido.replace(",", "."));
    return isNaN(valor) ? 0 : valor;
  }, [valorRecebido]);

  const troco = useMemo(() => {
    const diferenca = valorRecebidoValido - total;
    return diferenca > 0 ? diferenca : 0;
  }, [valorRecebidoValido, total]);

  const pagamentoInsuficiente =
    carrinho.length > 0 &&
    !pagamentoMultiplo &&
    formaPagamento === "DINHEIRO" &&
    valorRecebidoValido > 0 &&
    valorRecebidoValido < total;

  function handleValorRecebidoChange(valor: string) {
    if (valor === "" || /^[0-9]*[.,]?[0-9]*$/.test(valor)) {
      setValorRecebido(valor);
    }
  }

  function handleDescontoChange(valor: string) {
    // Aceita apenas nÃºmeros e um separador decimal (. ou ,)
    if (valor === "" || /^[0-9]*[.,]?[0-9]*$/.test(valor)) {
      setDescontoPercentual(valor);
    }
  }

  function handleDescontoDinheiroChange(valor: string) {
    if (valor === "" || /^[0-9]*[.,]?[0-9]*$/.test(valor)) {
      setDescontoDinheiro(valor);
    }
  }

  function ativarPagamentoMultiplo() {
    setPagamentoMultiplo(true);
    setPagamentos([{ formaPagamento: "PIX", valor: total.toFixed(2).replace(".", ",") }]);
    setFormaPagamento("MULTIPLO");
    setErro(null);
  }

  function desativarPagamentoMultiplo() {
    setPagamentoMultiplo(false);
    setPagamentos([]);
    setFormaPagamento("PIX");
    setErro(null);
  }

  function adicionarFormaPagamento() {
    if (pagamentos.length >= 4) return;
    const usadas = new Set(pagamentos.map((p) => p.formaPagamento));
    const proxima = (FORMAS.find((f) => !usadas.has(f)) ?? "PIX") as Exclude<FormaPagamento, "MULTIPLO">;
    setPagamentos((prev) => [...prev, { formaPagamento: proxima, valor: "" }]);
  }

  function atualizarPagamento(index: number, campo: "formaPagamento" | "valor", valor: string) {
    setPagamentos((prev) => prev.map((p, i) => {
      if (i !== index) return p;
      if (campo === "valor" && valor !== "" && !/^[0-9]*[.,]?[0-9]*$/.test(valor)) return p;
      return { ...p, [campo]: valor };
    }));
  }

  function removerPagamento(index: number) {
    setPagamentos((prev) => prev.filter((_, i) => i !== index));
  }

  async function finalizarVenda() {
    if (carrinho.length === 0) return;
    if (enviandoVendaRef.current) return;
    enviandoVendaRef.current = true;
    setFinalizando(true);
    setErro(null);
    try {
      const { data } = await api.post<Venda>("/vendas", {
        formaPagamento: pagamentoMultiplo ? null : formaPagamento,
        pagamentos: pagamentoMultiplo
          ? pagamentos.map((p) => ({
              formaPagamento: p.formaPagamento,
              valor: parseFloat(p.valor.replace(",", ".")) || 0,
            }))
          : [{ formaPagamento, valor: total }],
        percentualDesconto: descontoPercentualValido > 0 ? descontoPercentualValido : undefined,
        valorDescontoInformado: descontoDinheiroValido > 0 ? descontoDinheiroValido : undefined,
        itens: carrinho.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      setVendaConcluida(data);
      setCarrinho([]);
      setFormaPagamento("PIX");
      setPagamentoMultiplo(false);
      setPagamentos([]);
      setDescontoPercentual("");
      setDescontoDinheiro("");
      setValorRecebido("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "NÃ£o foi possÃ­vel concluir a venda.";
      setErro(msg);
    } finally {
      enviandoVendaRef.current = false;
      setFinalizando(false);
    }
  }

  function cancelarVenda() {
    if (carrinho.length === 0) return;
    if (!confirm("Deseja cancelar esta venda? O carrinho serÃ¡ esvaziado.")) return;
    setCarrinho([]);
    setFormaPagamento("PIX");
    setDescontoPercentual("");
    setDescontoDinheiro("");
    setValorRecebido("");
    setErro(null);
  }

  if (vendaConcluida) {
    return <ComprovanteVenda venda={vendaConcluida} onNovaVenda={() => setVendaConcluida(null)} />;
  }

  if (caixa === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (caixa === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="bg-primary text-white px-6 py-5 text-center">
            <Lock className="w-8 h-8 mx-auto mb-2" />
            <p className="font-semibold">Abrir caixa</p>
            <p className="text-xs text-white/70 mt-0.5">
              Informe o valor inicial para comeÃ§ar as vendas
            </p>
          </div>

          <div className="p-6 space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Valor inicial do caixa</span>
              <input
                inputMode="decimal"
                autoFocus
                value={valorInicialCaixa}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorInicialCaixa(v);
                }}
                placeholder="0,00"
                onKeyDown={(e) => e.key === "Enter" && abrirCaixa()}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
              />
            </label>

            {erroCaixa && (
              <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">{erroCaixa}</div>
            )}

            <button
              onClick={abrirCaixa}
              disabled={abrindoCaixa || valorInicialCaixa === ""}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {abrindoCaixa && <Loader2 className="w-4 h-4 animate-spin" />}
              Abrir caixa e iniciar vendas
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader title="Venda" subtitle="Busque um produto pelo nome ou cÃ³digo de barras" />

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Coluna de busca de produtos */}
        <div className="w-full md:flex-1 flex flex-col p-4 md:p-6 md:overflow-hidden">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              autoFocus
              ref={buscaInputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              placeholder="Nome do produto ou cÃ³digo de barras + Enter"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
            />
            {buscando && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted" />
            )}
          </div>

          <div className="md:flex-1 md:overflow-y-auto">
            {resultados.length === 0 && busca.trim().length >= 2 && !buscando && (
              <p className="text-sm text-muted px-1">Nenhum produto encontrado.</p>
            )}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {resultados.map((produto) => (
                <button
                  key={produto.id}
                  onClick={() => {
                    adicionarAoCarrinho(produto);
                    buscaInputRef.current?.focus();
                  }}
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

        {/* Coluna do carrinho / recibo â€” painel fixo Ã  direita em telas md+ */}
        <div className="w-full md:w-[380px] md:shrink-0 bg-surface border-t md:border-t-0 md:border-l border-border flex flex-col min-h-0">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-base">Carrinho</h2>
            <span className="ml-auto rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary-dark">
              {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {/* Lista de produtos: nÃ£o ocupa a altura inteira quando o carrinho estÃ¡ vazio. */}
          <div className="shrink-0 max-h-[180px] overflow-y-auto px-5 py-3 receipt-dashed">
            {carrinho.length === 0 ? (
              <div className="py-5 text-center">
                <ShoppingCart className="w-7 h-7 mx-auto mb-2 text-muted/50" />
                <p className="text-xs text-muted">Nenhum produto adicionado ainda.</p>
              </div>
            ) : (
              <ul className="space-y-3 font-mono text-sm">
                {carrinho.map((item) => (
                  <li key={item.produto.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground" title={item.produto.nome}>{item.produto.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
                          aria-label={`Diminuir quantidade de ${item.produto.nome}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs">{item.quantidade}</span>
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
                          aria-label={`Aumentar quantidade de ${item.produto.nome}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removerItem(item.produto.id)}
                          className="ml-1 p-1 text-danger/70 hover:text-danger"
                          aria-label={`Remover ${item.produto.nome}`}
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-foreground whitespace-nowrap pt-0.5">
                      {formatarMoeda(item.produto.precoVenda * item.quantidade)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fechamento da venda: compacto e com rolagem apenas quando necessÃ¡rio. */}
          <div className="flex-1 min-h-0 overflow-y-auto border-t border-border px-5 py-4 space-y-4">
            {/* Desconto */}
            <div>
              <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" />
                Desconto
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    inputMode="decimal"
                    value={descontoPercentual}
                    onChange={(e) => handleDescontoChange(e.target.value)}
                    placeholder="0"
                    disabled={carrinho.length === 0}
                    className="w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">%</span>
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span>
                  <input
                    inputMode="decimal"
                    value={descontoDinheiro}
                    onChange={(e) => handleDescontoDinheiroChange(e.target.value)}
                    placeholder="0,00"
                    disabled={carrinho.length === 0}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm disabled:opacity-50"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted mt-1">Pode usar os dois juntos, se precisar.</p>
            </div>

            {/* Totais */}
            <div className="border-y border-border py-3 space-y-1.5 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">Subtotal</span>
                <span className="text-sm text-foreground">{formatarMoeda(subtotal)}</span>
              </div>
              {valorDesconto > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">Desconto</span>
                  <span className="text-sm text-danger">- {formatarMoeda(valorDesconto)}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="text-2xl font-bold text-primary">{formatarMoeda(total)}</span>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted">Forma de pagamento</p>
                {!pagamentoMultiplo ? (
                  <button
                    type="button"
                    onClick={ativarPagamentoMultiplo}
                    disabled={carrinho.length === 0}
                    className="text-[11px] font-medium text-primary hover:text-primary-dark disabled:opacity-50"
                  >
                    + Dividir pagamento
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={desativarPagamentoMultiplo}
                    className="text-[11px] font-medium text-danger hover:text-danger/80"
                  >
                    Usar pagamento Ãºnico
                  </button>
                )}
              </div>

              {!pagamentoMultiplo ? (
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map((forma) => (
                    <button
                      key={forma}
                      onClick={() => setFormaPagamento(forma)}
                      className={`text-xs py-2.5 px-2 rounded-lg border transition ${formaPagamento === forma
                          ? "border-primary bg-primary-light text-primary-dark font-medium"
                          : "border-border text-muted hover:border-primary/40 hover:bg-background"
                        }`}
                    >
                      {LABEL_FORMA_PAGAMENTO[forma]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {pagamentos.map((pagamento, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={pagamento.formaPagamento}
                        onChange={(e) => atualizarPagamento(index, "formaPagamento", e.target.value as Exclude<FormaPagamento, "MULTIPLO">)}
                        className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        {FORMAS.map((forma) => (
                          <option key={forma} value={forma}>{LABEL_FORMA_PAGAMENTO[forma]}</option>
                        ))}
                      </select>
                      <div className="relative w-28">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">R$</span>
                        <input
                          inputMode="decimal"
                          value={pagamento.valor}
                          onChange={(e) => atualizarPagamento(index, "valor", e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-7 pr-2 py-2 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removerPagamento(index)}
                        disabled={pagamentos.length <= 1}
                        className="p-1.5 text-danger/70 hover:text-danger disabled:opacity-30"
                        title="Remover"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {pagamentos.length < 4 && (
                    <button
                      type="button"
                      onClick={adicionarFormaPagamento}
                      className="w-full border border-dashed border-border rounded-lg py-2 text-xs text-muted hover:border-primary hover:text-primary"
                    >
                      + Adicionar outra forma
                    </button>
                  )}
                  <div className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2 text-xs">
                    <span className="text-muted">Pago</span>
                    <span className="font-mono font-medium">{formatarMoeda(totalPagamentos)}</span>
                    <span className={restantePagamento > 0.005 ? "text-danger" : "text-primary"}>
                      {restantePagamento > 0.005 ? `Falta ${formatarMoeda(restantePagamento)}` : "Valor completo"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dinheiro */}
            {!pagamentoMultiplo && formaPagamento === "DINHEIRO" && (
              <div>
                <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  Valor recebido
                </p>
                <input
                  inputMode="decimal"
                  value={valorRecebido}
                  onChange={(e) => handleValorRecebidoChange(e.target.value)}
                  placeholder="0,00"
                  disabled={carrinho.length === 0}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm disabled:opacity-50"
                />
                {valorRecebidoValido > 0 && (
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className="text-xs text-muted">Troco</span>
                    <span className={`text-sm font-semibold ${pagamentoInsuficiente ? "text-danger" : "text-primary"}`}>
                      {pagamentoInsuficiente ? "Valor insuficiente" : formatarMoeda(troco)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {erro && (
              <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">{erro}</div>
            )}

            {/* AÃ§Ãµes */}
            <div className="pt-1 space-y-2">
              <button
                onClick={finalizarVenda}
                disabled={carrinho.length === 0 || finalizando || pagamentoInsuficiente || !pagamentosCompletos}
                className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {finalizando && <Loader2 className="w-4 h-4 animate-spin" />}
                Finalizar venda
              </button>

              <button
                onClick={cancelarVenda}
                disabled={carrinho.length === 0 || finalizando}
                className="w-full flex items-center justify-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger font-medium py-2 rounded-lg transition disabled:opacity-50"
              >
                Cancelar venda
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComprovanteVenda({ venda, onNovaVenda }: { venda: Venda; onNovaVenda: () => void }) {
  const [imprimindo, setImprimindo] = useState(false);
  const [erroImpressao, setErroImpressao] = useState<string | null>(null);
  const [impressaoOk, setImpressaoOk] = useState(false);

  async function imprimir() {
    if (imprimindo) return;
    setImprimindo(true);
    setErroImpressao(null);
    setImpressaoOk(false);
    try {
      await imprimirCupom(venda);
      setImpressaoOk(true);
    } catch (error) {
      setErroImpressao(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel imprimir o cupom.");
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden receipt-print">
        <div className="bg-primary text-white px-6 py-5 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">Venda concluÃ­da</p>
          <p className="text-xs text-white/70 mt-0.5">Venda #{venda.id}</p>
        </div>

        {/* cabeÃ§alho sÃ³ visÃ­vel na impressÃ£o: a tela jÃ¡ mostra "Venda concluÃ­da" acima */}
        <div className="hidden print:block text-center px-6 pt-4">
          <p className="font-semibold">PRESENTE DE DEUS</p>
          <p className="text-xs text-muted">Artigos Religiosos CatÃ³licos e Presentes</p>
          <p className="text-xs text-muted">CLN 07 Bloco B, Lote 1, Loja 04 â€” Riacho Fundo I, BrasÃ­lia-DF</p>
          <p className="text-xs text-muted">(61) 3264087 Â· @presentededeusartigosreligiososcatolicos</p>
          <p className="text-xs text-muted mt-2">Comprovante de venda #{venda.id}</p>
          <p className="text-xs text-muted">{formatarDataHora(venda.dataHora)}</p>
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
          <div className="border-t border-border mt-4 pt-4 space-y-1">
            {venda.subtotal !== undefined && venda.valorDesconto !== undefined && venda.valorDesconto > 0 && (
              <>
                <div className="flex justify-between text-muted text-xs">
                  <span>Subtotal</span>
                  <span>{formatarMoeda(venda.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted text-xs">
                  <span>Desconto</span>
                  <span>- {formatarMoeda(venda.valorDesconto)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-semibold pt-1">
              <span>Total</span>
              <span>{formatarMoeda(venda.total)}</span>
            </div>
          </div>
          <div className="text-xs text-muted mt-2 space-y-0.5">
            {venda.pagamentos?.length > 0 ? (
              <>
                <p className="font-semibold">Pagamentos:</p>
                {venda.pagamentos.map((pagamento, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{LABEL_FORMA_PAGAMENTO[pagamento.formaPagamento]}</span>
                    <span>{formatarMoeda(pagamento.valor)}</span>
                  </div>
                ))}
              </>
            ) : (
              <p>Pagamento: {LABEL_FORMA_PAGAMENTO[venda.formaPagamento]}</p>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm mt-4 no-print space-y-2">
        {erroImpressao && (
          <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erroImpressao}</div>
        )}
        {impressaoOk && (
          <div className="rounded-lg bg-primary-light text-primary-dark text-sm px-3 py-2">
            Cupom enviado para a Goldensky.
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={imprimir}
            disabled={imprimindo}
            className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border hover:bg-background text-foreground font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {imprimindo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {imprimindo ? "Imprimindo..." : "Imprimir"}
          </button>

          <button
            onClick={onNovaVenda}
            className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition"
          >
            Nova venda
          </button>
        </div>
      </div>
    </div>
  );
}

