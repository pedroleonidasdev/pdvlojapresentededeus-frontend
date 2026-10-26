"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { avisarCaixaMudou } from "@/lib/caixa-eventos";
import { Produto, FormaPagamento, Venda, Caixa } from "@/lib/types";
import { imprimirCupom } from "@/lib/impressora";
import { formatarMoeda, formatarDataHora, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import { situacaoEstoque } from "@/lib/estoque";
import PageHeader from "@/components/PageHeader";
import { Search, Trash2, Plus, Minus, ShoppingCart, CheckCircle2, Loader2, Tag, DollarSign, Lock, Printer, X, Barcode, QrCode, Banknote, CreditCard, Check, Keyboard, UserRound } from "lucide-react";
import { BarraCarregamento, CarregandoSecao } from "@/components/CarregamentoCatolico";

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

// o PDV só vende nessas 4 formas — cheque, boleto e múltiplos pagamentos não entram aqui
// (múltiplo é tratado à parte via pagamentoMultiplo/pagamentos; cheque e boleto são só para despesas)
type FormaPdv = Exclude<FormaPagamento, "MULTIPLO" | "CHEQUE" | "BOLETO">;

const FORMAS: FormaPdv[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

// cada forma de pagamento recebe uma cor própria, pra ficar fácil bater o olho
// no carrinho e reconhecer de longe qual está selecionada.
const COR_FORMA_PAGAMENTO: Record<FormaPdv, { ativo: string; ponto: string }> = {
  PIX: { ativo: "border-info bg-info-light text-info-dark font-semibold shadow-sm", ponto: "bg-info" },
  DINHEIRO: { ativo: "border-success bg-success-light text-success font-semibold shadow-sm", ponto: "bg-success" },
  CARTAO_CREDITO: { ativo: "border-secondary bg-secondary-light text-secondary-dark font-semibold shadow-sm", ponto: "bg-secondary" },
  CARTAO_DEBITO: { ativo: "border-accent bg-accent-light text-accent-dark font-semibold shadow-sm", ponto: "bg-accent" },
};

// ícone de cada forma de pagamento (só visual)
const ICONE_FORMA: Record<FormaPdv, typeof QrCode> = {
  PIX: QrCode,
  DINHEIRO: Banknote,
  CARTAO_CREDITO: CreditCard,
  CARTAO_DEBITO: CreditCard,
};

// as 3 etapas fixas do fluxo de finalizar venda — sempre passam por todas,
// nessa ordem, independente de quão rápido o servidor responde.
const ETAPA_FINALIZACAO: Record<"processando" | "finalizando" | "sucesso", { texto: string; progresso: number }> = {
  processando: { texto: "Processando venda...", progresso: 35 },
  finalizando: { texto: "Finalizando venda...", progresso: 75 },
  sucesso: { texto: "VENDA FINALIZADA COM SUCESSO!", progresso: 100 },
};

export default function PdvPage() {
  const { usuario, revalidar } = useAuth();
  const loginLogado = usuario?.login;
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("PIX");
  const [pagamentoMultiplo, setPagamentoMultiplo] = useState(false);
  const [pagamentos, setPagamentos] = useState<{ formaPagamento: FormaPdv; valor: string }[]>([]);
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
  // referência do campo de busca: leitores de código de barras baratos funcionam como
  // um teclado (digitam o código + Enter em quem estiver com foco no momento). Se o
  // foco escapar do campo — por exemplo depois de clicar num produto com o mouse — o
  // próximo disparo do leitor se perde. Por isso devolvemos o foco a este campo após
  // cada produto adicionado.
  const buscaInputRef = useRef<HTMLInputElement>(null);
  const [erroCaixa, setErroCaixa] = useState<string | null>(null);
  // guarda síncrona contra duplo-clique/duplo-toque: o estado `finalizando` já desabilita o
  // botão, mas a atualização de estado só reflete no DOM após o re-render, e dois cliques
  // muito próximos podem disparar o handler antes disso. O ref bloqueia imediatamente.
  const enviandoVendaRef = useRef(false);
  const [etapaFinalizacao, setEtapaFinalizacao] = useState<"processando" | "finalizando" | "sucesso" | null>(null);

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
  }, [loginLogado]);

  // quando o caixa passa a estar aberto (acabou de abrir, ou já estava aberto ao
  // carregar a tela), devolve o foco ao campo de busca — o leitor de código de
  // barras digita em quem estiver com foco
  useEffect(() => {
    if (caixa) buscaInputRef.current?.focus();
  }, [caixa]);

  async function abrirCaixa() {
    setAbrindoCaixa(true);
    setErroCaixa(null);
    try {
      // Quem abre o caixa tem que ser quem está logado. Antes de abrir, confere com o
      // servidor quem é o dono do token desta aba: se for outra pessoa da que a tela
      // mostra, a tela é corrigida e a abertura NÃO acontece (para não gravar o nome errado).
      const exibido = usuario?.login;
      const confirmado = await revalidar();
      if (!confirmado) {
        setErroCaixa("Não foi possível confirmar o usuário logado. Verifique a conexão e tente novamente.");
        return;
      }
      if (exibido && exibido.toLowerCase() !== confirmado.login.toLowerCase()) {
        setErroCaixa(
          `A sessão desta tela estava desatualizada: quem está logado agora é ${confirmado.nome} (${confirmado.login}). ` +
            "Confira o usuário no menu lateral e clique em abrir de novo."
        );
        return;
      }

      const { data } = await api.post<Caixa>("/caixa/abrir", {
        valorInicial: Number(valorInicialCaixa.replace(",", ".")) || 0,
        loginLogado: confirmado.login,
      });
      setCaixa(data);
      avisarCaixaMudou();
      setValorInicialCaixa("");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível abrir o caixa.";
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
      setErro(`Produto não encontrado para o código ${codigo}`);
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
    // Aceita apenas números e um separador decimal (. ou ,)
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
    const proxima = (FORMAS.find((f) => !usadas.has(f)) ?? "PIX") as FormaPdv;
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
    setEtapaFinalizacao("processando");

    const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    try {
      // dispara a requisição real e, em paralelo, garante que a etapa
      // "processando" fique visível por pelo menos 900ms antes de avançar —
      // mesmo que o servidor responda mais rápido que isso.
      const [, resposta] = await Promise.all([
        esperar(900).then(() => setEtapaFinalizacao("finalizando")),
        api.post<Venda>("/vendas", {
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
        }),
      ]);

      // mantém "Finalizando venda..." visível um instante mesmo se a resposta
      // já tiver chegado durante os 900ms acima
      await esperar(600);
      setEtapaFinalizacao("sucesso");
      await esperar(2000);

      setVendaConcluida(resposta.data);
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
        "Não foi possível concluir a venda.";
      setErro(msg);
    } finally {
      enviandoVendaRef.current = false;
      setFinalizando(false);
      setEtapaFinalizacao(null);
    }
  }

  function cancelarVenda() {
    if (carrinho.length === 0) return;
    if (!confirm("Deseja cancelar esta venda? O carrinho será esvaziado.")) return;
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
      <CarregandoSecao className="h-full" />
    );
  }

  const unidadesNoCarrinho = carrinho.reduce((acc, i) => acc + i.quantidade, 0);

  // caixa fechado: a tela de venda aparece normalmente, só que bloqueada, com a
  // janela "Abrir caixa" flutuando no meio (ver o final do return)
  const caixaFechado = caixa === null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#CFE1F4] via-[#D6E6F4] to-[#DAECF0]">
      <PageHeader title="Venda" subtitle="Busque um produto pelo nome ou código de barras" compact />

      <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        inert={caixaFechado}
        aria-hidden={caixaFechado}
        className={`flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden ${
          caixaFechado ? "select-none" : ""
        }`}
      >
        {/* Coluna de busca de produtos */}
        <div className="w-full md:flex-1 flex flex-col p-4 md:p-6 md:overflow-hidden">
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/70" />
            <input
              autoFocus
              ref={buscaInputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              placeholder="Nome do produto ou código de barras + Enter"
              className="w-full pl-12 pr-12 py-3.5 rounded-2xl border-2 border-border bg-surface shadow-[0_8px_24px_-14px_rgba(15,51,42,0.5)] placeholder:text-muted/70 focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition text-base"
            />
            {buscando ? (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-muted" />
            ) : (
              busca.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setResultados([]);
                    buscaInputRef.current?.focus();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition"
                  title="Limpar busca"
                >
                  <X className="w-5 h-5" />
                </button>
              )
            )}
          </div>

          <div className="md:flex-1 md:overflow-y-auto">
            {resultados.length === 0 && busca.trim().length >= 2 && !buscando && (
              <p className="text-base text-muted px-1 py-6 text-center">Nenhum produto encontrado.</p>
            )}
            {resultados.length === 0 && busca.trim().length < 2 && (
              <div className="mt-1 flex flex-col items-center justify-center text-center rounded-3xl border-2 border-dashed border-primary/25 bg-surface/60 px-6 py-10 md:py-14">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center mb-4 shadow-lg shadow-primary/30 ring-1 ring-white/30">
                  <Barcode className="w-8 h-8" />
                </div>
                <p className="text-lg font-bold text-foreground">Pronto para vender</p>
                <p className="text-sm text-muted mt-1 max-w-xs">Escolha como adicionar o primeiro produto ao carrinho.</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary-dark">
                    <Barcode className="w-3.5 h-3.5" /> Passe o leitor no código de barras
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info-light px-3 py-1.5 text-xs font-medium text-info-dark">
                    <Keyboard className="w-3.5 h-3.5" /> Digite o nome (2+ letras)
                  </span>
                </div>
              </div>
            )}
            {resultados.length > 0 && (
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                {resultados.length} {resultados.length === 1 ? "produto" : "produtos"} · clique para adicionar
              </p>
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
                  title={produto.nome}
                  className="group relative overflow-hidden text-left p-3.5 pl-4 rounded-2xl border border-border bg-surface shadow-sm hover:border-primary hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition flex flex-col disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:hover:border-border"
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-primary-dark opacity-60 group-hover:opacity-100 group-disabled:hidden transition" />
                  <span aria-hidden className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow-md opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 group-disabled:hidden transition">
                    <Plus className="w-4 h-4" />
                  </span>
                  <p className="pr-8 font-semibold text-[15px] text-foreground leading-snug line-clamp-2 break-words">{produto.nome}</p>
                  <p className="self-start text-[11px] mt-2 px-2 py-0.5 rounded-full bg-secondary-light text-secondary-dark">
                    {produto.categoria?.nome ?? "Sem categoria"}
                  </p>
                  <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1 mt-auto pt-3">
                    <span className="font-mono text-xl font-bold text-primary tabular-nums">
                      {formatarMoeda(produto.precoVenda)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        produto.quantidadeEstoque < 1
                          ? "bg-danger-light text-danger"
                          : situacaoEstoque(produto) === "baixo"
                            ? "bg-accent-light text-accent-dark"
                            : "bg-primary-soft text-primary-dark"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`h-1.5 w-1.5 rounded-full ${
                          produto.quantidadeEstoque < 1
                            ? "bg-danger"
                            : situacaoEstoque(produto) === "baixo"
                              ? "bg-accent"
                              : "bg-success"
                        }`}
                      />
                      {produto.quantidadeEstoque < 1 ? "Sem estoque" : `${produto.quantidadeEstoque} em estoque`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna do carrinho / recibo — painel fixo à direita em telas md+ */}
        <div className="w-full md:w-[380px] md:min-w-[380px] md:max-w-[380px] xl:w-[420px] xl:min-w-[420px] xl:max-w-[420px] md:shrink-0 bg-surface border-t md:border-t-0 md:border-l border-border md:shadow-[-6px_0_14px_-8px_rgba(15,51,42,0.25)] flex flex-col min-h-0">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0 bg-gradient-to-r from-primary-soft to-surface">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30 ring-1 ring-white/30">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight">Carrinho</h2>
              {carrinho.length > 0 && (
                <p className="text-xs text-muted leading-tight">
                  {carrinho.length} {carrinho.length === 1 ? "produto" : "produtos"} · {unidadesNoCarrinho}{" "}
                  {unidadesNoCarrinho === 1 ? "unidade" : "unidades"}
                </p>
              )}
            </div>
            <span className="ml-auto rounded-full bg-primary text-white px-3 py-1 text-sm font-semibold shadow-sm">
              {carrinho.length} {carrinho.length === 1 ? "item" : "itens"}
            </span>
          </div>

          {/* Lista de produtos: ocupa todo o espaço livre entre o cabeçalho e o bloco de desconto/pagamento. */}
          <div className="flex flex-col flex-1 min-h-[96px] max-h-[240px] md:max-h-none overflow-y-auto px-5 py-2 bg-surface-alt/50 receipt-dashed">
            {carrinho.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-3 text-center">
                <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-primary/30 bg-surface text-primary/50">
                  <ShoppingCart className="w-6 h-6" />
                </span>
                <p className="text-sm font-semibold text-foreground">Carrinho vazio</p>
                <p className="text-xs text-muted mt-0.5">Os produtos adicionados aparecem aqui.</p>
              </div>
            ) : (
              <ul className="divide-y divide-accent/25 text-sm">
                {carrinho.map((item) => (
                  <li key={item.produto.id} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <p
                        className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground line-clamp-2 break-words"
                        title={item.produto.nome}
                      >
                        {item.produto.nome}
                      </p>
                      <button
                        onClick={() => removerItem(item.produto.id)}
                        className="shrink-0 -mr-1 -mt-0.5 p-1.5 rounded-lg text-danger/60 hover:text-danger hover:bg-danger-light transition"
                        aria-label={`Remover ${item.produto.nome}`}
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, -1)}
                          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-primary-light active:bg-primary/20 transition"
                          aria-label={`Diminuir quantidade de ${item.produto.nome}`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="min-w-[2.25rem] px-1 text-center font-mono text-sm font-bold tabular-nums text-primary-dark border-x border-border bg-primary-soft leading-8">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => alterarQuantidade(item.produto.id, 1)}
                          className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-primary-light active:bg-primary/20 transition"
                          aria-label={`Aumentar quantidade de ${item.produto.nome}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted">
                        × {formatarMoeda(item.produto.precoVenda)}
                      </span>
                      <span className="font-mono text-base font-bold text-foreground whitespace-nowrap tabular-nums">
                        {formatarMoeda(item.produto.precoVenda * item.quantidade)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fechamento da venda: desconto e pagamento rolam; total e ações ficam sempre visíveis no rodapé. */}
          <div className="min-h-0 flex flex-col border-t border-border">
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3 space-y-3">
            {/* Desconto */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" />
                Desconto
                <span className="normal-case font-normal tracking-normal text-[11px]">· pode usar os dois juntos</span>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    inputMode="decimal"
                    value={descontoPercentual}
                    onChange={(e) => handleDescontoChange(e.target.value)}
                    placeholder="0"
                    disabled={carrinho.length === 0}
                    className="w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-base font-mono disabled:opacity-50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">R$</span>
                  <input
                    inputMode="decimal"
                    value={descontoDinheiro}
                    onChange={(e) => handleDescontoDinheiroChange(e.target.value)}
                    placeholder="0,00"
                    disabled={carrinho.length === 0}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-base font-mono disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Forma de pagamento */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Forma de pagamento</p>
                {!pagamentoMultiplo ? (
                  <button
                    type="button"
                    onClick={ativarPagamentoMultiplo}
                    disabled={carrinho.length === 0}
                    className="text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-50"
                  >
                    + Dividir pagamento
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={desativarPagamentoMultiplo}
                    className="text-xs font-semibold text-danger hover:text-danger/80"
                  >
                    Usar pagamento único
                  </button>
                )}
              </div>

              {!pagamentoMultiplo ? (
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map((forma) => (
                    <button
                      key={forma}
                      onClick={() => setFormaPagamento(forma)}
                      aria-pressed={formaPagamento === forma}
                      className={`relative flex items-center gap-2 text-sm py-2.5 px-3 rounded-xl border-2 transition ${formaPagamento === forma
                          ? COR_FORMA_PAGAMENTO[forma].ativo
                          : "border-border bg-surface text-muted hover:border-primary/40 hover:bg-background"
                        }`}
                    >
                      {(() => {
                        const Icone = ICONE_FORMA[forma];
                        return <Icone className="w-4 h-4 shrink-0" />;
                      })()}
                      <span className="truncate">{LABEL_FORMA_PAGAMENTO[forma]}</span>
                      {formaPagamento === forma && (
                        <span className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white ${COR_FORMA_PAGAMENTO[forma].ponto}`}>
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pagamentos.map((pagamento, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <select
                        value={pagamento.formaPagamento}
                        onChange={(e) => atualizarPagamento(index, "formaPagamento", e.target.value as FormaPdv)}
                        className="flex-1 min-w-0 px-2 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        {FORMAS.map((forma) => (
                          <option key={forma} value={forma}>{LABEL_FORMA_PAGAMENTO[forma]}</option>
                        ))}
                      </select>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">R$</span>
                        <input
                          inputMode="decimal"
                          value={pagamento.valor}
                          onChange={(e) => atualizarPagamento(index, "valor", e.target.value)}
                          placeholder="0,00"
                          className="w-full pl-8 pr-2 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                      className="w-full border border-dashed border-border rounded-lg py-2 text-sm text-muted hover:border-primary hover:text-primary"
                    >
                      + Adicionar outra forma
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-3 py-2 text-sm">
                    <span className="text-muted">Pago</span>
                    <span className="font-mono font-semibold tabular-nums">{formatarMoeda(totalPagamentos)}</span>
                    <span className={`font-semibold ${restantePagamento > 0.005 ? "text-danger" : "text-primary"}`}>
                      {restantePagamento > 0.005 ? `Falta ${formatarMoeda(restantePagamento)}` : "Valor completo"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Dinheiro */}
            {!pagamentoMultiplo && formaPagamento === "DINHEIRO" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  Valor recebido e troco
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    inputMode="decimal"
                    value={valorRecebido}
                    onChange={(e) => handleValorRecebidoChange(e.target.value)}
                    placeholder="0,00"
                    disabled={carrinho.length === 0}
                    className="w-full min-w-0 px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-lg font-mono font-semibold disabled:opacity-50"
                  />
                  <div
                    className={`min-w-0 flex flex-col justify-center rounded-lg px-3 py-1 ${
                      valorRecebidoValido === 0
                        ? "bg-background border border-border"
                        : pagamentoInsuficiente
                          ? "bg-danger-light"
                          : "bg-success-light"
                    }`}
                  >
                    <span className="text-[11px] font-medium text-muted leading-tight">Troco</span>
                    <span
                      className={`text-lg font-bold font-mono tabular-nums leading-tight truncate ${
                        valorRecebidoValido === 0
                          ? "text-muted"
                          : pagamentoInsuficiente
                            ? "text-danger"
                            : "text-primary"
                      }`}
                    >
                      {valorRecebidoValido === 0
                        ? "—"
                        : pagamentoInsuficiente
                          ? "Insuficiente"
                          : formatarMoeda(troco)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 sticky bottom-0 md:static bg-surface border-t border-border px-5 py-3 space-y-2 shadow-[0_-8px_14px_-10px_rgba(15,51,42,0.3)]">
            {/* Totais */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark px-4 py-2.5 font-mono text-white shadow-md shadow-primary/30">
              <div aria-hidden className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-accent/25 blur-2xl" />
              {valorDesconto > 0 && (
                <div className="relative space-y-0.5 pb-1.5 mb-1.5 border-b border-white/15">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Subtotal</span>
                    <span className="text-base tabular-nums">{formatarMoeda(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">Desconto</span>
                    <span className="text-base text-amber-200 tabular-nums">- {formatarMoeda(valorDesconto)}</span>
                  </div>
                </div>
              )}
              <div className="relative flex items-end justify-between gap-3">
                <span className="text-sm font-bold uppercase tracking-[0.18em] text-white/80 pb-1.5">Total</span>
                <span className="text-3xl xl:text-4xl font-extrabold tabular-nums tracking-tight leading-tight">
                  {formatarMoeda(total)}
                </span>
              </div>
            </div>

            {erro && (
              <div className="rounded-lg bg-danger-light text-danger text-sm font-medium px-3 py-2">{erro}</div>
            )}

            {/* Ações */}
            <div className="space-y-1.5">
              <button
                onClick={finalizarVenda}
                disabled={carrinho.length === 0 || finalizando || pagamentoInsuficiente || !pagamentosCompletos}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-accent to-accent-dark hover:brightness-105 active:scale-[0.99] text-white text-base font-bold py-3 rounded-xl shadow-lg shadow-accent/30 ring-1 ring-white/20 transition disabled:bg-none disabled:bg-surface-alt disabled:text-muted disabled:shadow-none disabled:ring-0 disabled:border disabled:border-border disabled:cursor-not-allowed"
              >
                {finalizando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Finalizar venda
              </button>

              <button
                onClick={cancelarVenda}
                disabled={carrinho.length === 0 || finalizando}
                className="w-full flex items-center justify-center gap-2 border border-danger/25 bg-transparent hover:bg-danger-light text-danger text-sm font-medium py-2 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancelar venda
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>

      {caixaFechado && (
        // véu desfocado: a tela de venda fica ao fundo, sem competir com a janela
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-primary-dark/25 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-abrir-caixa"
            className="login-entra relative w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-[0_30px_80px_-20px_rgba(15,51,42,0.55)] ring-1 ring-black/5"
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

            <div className="px-8 pt-9 pb-2 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30 ring-1 ring-white/30">
                <Lock className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h2 id="titulo-abrir-caixa" className="text-xl font-semibold tracking-tight text-foreground">
                Abrir caixa
              </h2>
              <p className="mt-1 text-sm text-muted">Informe o valor inicial para liberar as vendas</p>
            </div>

            <div className="space-y-5 px-8 pb-7 pt-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-foreground">Valor inicial do caixa</span>
                <span className="relative block">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg font-semibold text-muted"
                  >
                    R$
                  </span>
                  <input
                    inputMode="decimal"
                    autoFocus
                    value={valorInicialCaixa}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValorInicialCaixa(v);
                    }}
                    placeholder="0,00"
                    onKeyDown={(e) => e.key === "Enter" && valorInicialCaixa !== "" && !abrindoCaixa && abrirCaixa()}
                    className="w-full rounded-xl border border-border bg-white/70 py-3.5 pl-12 pr-4 font-mono text-2xl font-semibold tabular-nums text-foreground shadow-inner shadow-primary/5 transition placeholder:text-muted/40 focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </span>
                <span className="mt-1.5 block text-xs text-muted">Dinheiro em espécie que já está na gaveta.</span>
              </label>

              {erroCaixa && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-danger-light px-3.5 py-3 text-xs font-medium text-danger"
                >
                  {erroCaixa}
                </div>
              )}

              <button
                onClick={abrirCaixa}
                disabled={abrindoCaixa || valorInicialCaixa === ""}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark py-3.5 text-sm font-semibold text-white shadow-md shadow-primary/30 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100"
              >
                {abrindoCaixa && <Loader2 className="h-4 w-4 animate-spin" />}
                Abrir caixa e iniciar vendas
              </button>
            </div>

            {usuario?.nome && (
              <div className="flex items-center justify-center gap-1.5 border-t border-border/60 bg-primary-soft/50 px-8 py-3 text-xs text-muted">
                <UserRound className="h-3.5 w-3.5" />
                O caixa será aberto em nome de <strong className="font-semibold text-foreground">{usuario.nome}</strong>
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {finalizando && etapaFinalizacao && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xs bg-surface border border-border rounded-2xl shadow-lg p-6 text-center">
            {etapaFinalizacao === "sucesso" ? (
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-primary" />
            ) : null}
            <p
              className={
                etapaFinalizacao === "sucesso"
                  ? "font-bold text-primary text-base"
                  : "font-semibold text-foreground"
              }
            >
              {ETAPA_FINALIZACAO[etapaFinalizacao].texto}
            </p>
            <BarraCarregamento className="mt-4" progresso={ETAPA_FINALIZACAO[etapaFinalizacao].progresso} />
          </div>
        </div>
      )}
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
      setErroImpressao(error instanceof Error ? error.message : "Não foi possível imprimir o cupom.");
    } finally {
      setImprimindo(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden receipt-print">
        <div className="bg-primary text-white px-6 py-5 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">Venda concluída</p>
          <p className="text-xs text-white/70 mt-0.5">Venda #{venda.id}</p>
        </div>

        {/* cabeçalho só visível na impressão: a tela já mostra "Venda concluída" acima */}
        <div className="hidden print:block text-center px-6 pt-4">
          <p className="font-semibold">PRESENTE DE DEUS</p>
          <p className="text-xs text-muted">Artigos Religiosos Católicos e Presentes</p>
          <p className="text-xs text-muted">CLN 07 Bloco B, Lote 1, Loja 04 — Riacho Fundo I, Brasília-DF</p>
          <p className="text-xs text-muted">(61) 3264-0087 · @presentededeusartigosreligiososcatolicos</p>
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
