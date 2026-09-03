"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { Produto, FormaPagamento, Troca } from "@/lib/types";
import { formatarMoeda, formatarDataHora, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Repeat,
  CheckCircle2,
  Loader2,
  ArrowLeftRight,
  Undo2,
  PackagePlus,
  Printer,
} from "lucide-react";

interface ItemLista {
  produto: Produto;
  quantidade: number;
}

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

type Modo = "DEVOLVIDO" | "NOVO";

export default function TrocasPage() {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [modo, setModo] = useState<Modo>("DEVOLVIDO");

  const [itensDevolvidos, setItensDevolvidos] = useState<ItemLista[]>([]);
  const [itensNovos, setItensNovos] = useState<ItemLista[]>([]);

  const [vendaOrigemId, setVendaOrigemId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [formaPagamentoDiferenca, setFormaPagamentoDiferenca] = useState<FormaPagamento>("DINHEIRO");

  const [registrando, setRegistrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trocaConcluida, setTrocaConcluida] = useState<Troca | null>(null);
  const enviandoRef = useRef(false);
  // mesmo motivo do PDV: leitor de código de barras digita no campo com foco no
  // momento, então devolvemos o foco a este campo após cada produto adicionado.
  const buscaInputRef = useRef<HTMLInputElement>(null);

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

  function handleBuscaKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && busca.trim().length >= 4 && /^[0-9]+$/.test(busca.trim())) {
      buscarPorCodigoBarras(busca.trim());
    }
  }

  async function buscarPorCodigoBarras(codigo: string) {
    try {
      const { data } = await api.get<Produto>(`/produtos/codigo-barras/${codigo}`);
      adicionarItem(data);
      setBusca("");
      setResultados([]);
    } catch {
      setErro(`Produto não encontrado para o código ${codigo}`);
    } finally {
      buscaInputRef.current?.focus();
    }
  }

  function adicionarItem(produto: Produto) {
    setErro(null);
    const setLista = modo === "DEVOLVIDO" ? setItensDevolvidos : setItensNovos;

    setLista((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id);

      // Itens "novos" saem do estoque, então respeitam o limite de estoque disponível.
      // Itens "devolvidos" voltam para o estoque, então não têm esse limite.
      if (modo === "NOVO") {
        const qtdAtual = existente?.quantidade ?? 0;
        if (qtdAtual + 1 > produto.quantidadeEstoque) {
          setErro(`Estoque insuficiente para ${produto.nome}`);
          return prev;
        }
      }

      if (existente) {
        return prev.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function alterarQuantidade(lista: Modo, produtoId: number, delta: number) {
    const setLista = lista === "DEVOLVIDO" ? setItensDevolvidos : setItensNovos;
    setLista((prev) =>
      prev
        .map((i) => {
          if (i.produto.id !== produtoId) return i;
          const novaQtd = i.quantidade + delta;
          if (lista === "NOVO" && novaQtd > i.produto.quantidadeEstoque) {
            setErro(`Estoque insuficiente para ${i.produto.nome}`);
            return i;
          }
          return { ...i, quantidade: novaQtd };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  function removerItem(lista: Modo, produtoId: number) {
    const setLista = lista === "DEVOLVIDO" ? setItensDevolvidos : setItensNovos;
    setLista((prev) => prev.filter((i) => i.produto.id !== produtoId));
  }

  const valorDevolvido = itensDevolvidos.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0);
  const valorNovo = itensNovos.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0);
  const diferenca = valorNovo - valorDevolvido;
  const precisaFormaPagamento = Math.abs(diferenca) > 0.001;

  const podeRegistrar = itensDevolvidos.length > 0 && itensNovos.length > 0;

  async function registrarTroca() {
    if (!podeRegistrar) return;
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setRegistrando(true);
    setErro(null);
    try {
      const { data } = await api.post<Troca>("/trocas", {
        vendaOrigemId: vendaOrigemId.trim() !== "" ? Number(vendaOrigemId.trim()) : undefined,
        observacao: observacao.trim() !== "" ? observacao.trim() : undefined,
        formaPagamentoDiferenca: precisaFormaPagamento ? formaPagamentoDiferenca : undefined,
        itensDevolvidos: itensDevolvidos.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
        itensNovos: itensNovos.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      setTrocaConcluida(data);
      limparFormulario();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível registrar a troca.";
      setErro(msg);
    } finally {
      enviandoRef.current = false;
      setRegistrando(false);
    }
  }

  function limparFormulario() {
    setItensDevolvidos([]);
    setItensNovos([]);
    setVendaOrigemId("");
    setObservacao("");
    setFormaPagamentoDiferenca("DINHEIRO");
    setModo("DEVOLVIDO");
  }

  function cancelarTroca() {
    if (itensDevolvidos.length === 0 && itensNovos.length === 0) return;
    if (!confirm("Deseja cancelar esta troca? Os itens selecionados serão descartados.")) return;
    limparFormulario();
    setErro(null);
  }

  if (trocaConcluida) {
    return <ComprovanteTroca troca={trocaConcluida} onNovaTroca={() => setTrocaConcluida(null)} />;
  }

  return (
    <div className="flex flex-col h-screen">
      <PageHeader
        title="Trocas"
        subtitle="Registre a devolução de um produto e a saída de outro em seu lugar"
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">
        {/* Coluna de busca de produtos */}
        <div className="w-full md:flex-1 flex flex-col p-4 md:p-6 md:overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setModo("DEVOLVIDO")}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition ${
                modo === "DEVOLVIDO"
                  ? "border-danger bg-danger-light text-danger font-medium"
                  : "border-border text-muted hover:border-danger/40"
              }`}
            >
              <Undo2 className="w-4 h-4" />
              Adicionar produto devolvido
            </button>
            <button
              onClick={() => setModo("NOVO")}
              className={`flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition ${
                modo === "NOVO"
                  ? "border-primary bg-primary-light text-primary-dark font-medium"
                  : "border-border text-muted hover:border-primary/40"
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              Adicionar produto novo
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              autoFocus
              ref={buscaInputRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={handleBuscaKeyDown}
              placeholder={`Nome do produto ou código de barras + Enter (${
                modo === "DEVOLVIDO" ? "produto que o cliente está devolvendo" : "produto novo que o cliente vai levar"
              })`}
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
                    adicionarItem(produto);
                    buscaInputRef.current?.focus();
                  }}
                  disabled={modo === "NOVO" && produto.quantidadeEstoque < 1}
                  className="text-left p-4 rounded-xl border border-border bg-surface hover:border-primary hover:shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <p className="font-medium text-sm text-foreground leading-tight">{produto.nome}</p>
                  <p className="text-xs text-muted mt-1">{produto.categoria?.nome ?? "Sem categoria"}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-mono font-semibold text-primary">
                      {formatarMoeda(produto.precoVenda)}
                    </span>
                    <span className="text-[11px] text-muted">{produto.quantidadeEstoque} em estoque</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna dos itens da troca — empilha abaixo da busca no celular, fica ao lado em telas md+ */}
        <div className="w-full md:w-[400px] md:shrink-0 bg-surface border-t md:border-t-0 md:border-l border-border flex flex-col md:overflow-y-auto">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Repeat className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Resumo da troca</h2>
          </div>

          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-medium text-danger flex items-center gap-1.5 mb-2">
              <Undo2 className="w-3.5 h-3.5" />
              Devolvido pelo cliente
            </p>
            {itensDevolvidos.length === 0 ? (
              <p className="text-xs text-muted">Nenhum produto adicionado ainda.</p>
            ) : (
              <ul className="space-y-2 font-mono text-sm">
                {itensDevolvidos.map((item) => (
                  <ItemLinha
                    key={item.produto.id}
                    item={item}
                    onMais={() => alterarQuantidade("DEVOLVIDO", item.produto.id, 1)}
                    onMenos={() => alterarQuantidade("DEVOLVIDO", item.produto.id, -1)}
                    onRemover={() => removerItem("DEVOLVIDO", item.produto.id)}
                  />
                ))}
              </ul>
            )}
            <div className="flex justify-between text-xs font-mono mt-3 pt-2 border-t border-border">
              <span className="text-muted">Total devolvido</span>
              <span className="font-semibold">{formatarMoeda(valorDevolvido)}</span>
            </div>
          </div>

          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-2">
              <PackagePlus className="w-3.5 h-3.5" />
              Novo produto levado
            </p>
            {itensNovos.length === 0 ? (
              <p className="text-xs text-muted">Nenhum produto adicionado ainda.</p>
            ) : (
              <ul className="space-y-2 font-mono text-sm">
                {itensNovos.map((item) => (
                  <ItemLinha
                    key={item.produto.id}
                    item={item}
                    onMais={() => alterarQuantidade("NOVO", item.produto.id, 1)}
                    onMenos={() => alterarQuantidade("NOVO", item.produto.id, -1)}
                    onRemover={() => removerItem("NOVO", item.produto.id)}
                  />
                ))}
              </ul>
            )}
            <div className="flex justify-between text-xs font-mono mt-3 pt-2 border-t border-border">
              <span className="text-muted">Total novo</span>
              <span className="font-semibold">{formatarMoeda(valorNovo)}</span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Venda de origem (opcional)</span>
              <input
                inputMode="numeric"
                value={vendaOrigemId}
                onChange={(e) => /^[0-9]*$/.test(e.target.value) && setVendaOrigemId(e.target.value)}
                placeholder="Nº da venda, se souber"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1.5">Observação (opcional)</span>
              <input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: produto com defeito"
                maxLength={255}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition text-sm"
              />
            </label>

            <div className="flex items-center justify-between font-mono pt-1">
              <span className="text-sm text-muted flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Diferença
              </span>
              <span
                className={`text-xl font-semibold ${
                  diferenca > 0 ? "text-danger" : diferenca < 0 ? "text-accent" : "text-foreground"
                }`}
              >
                {formatarMoeda(Math.abs(diferenca))}
              </span>
            </div>
            {diferenca !== 0 && (
              <p className="text-xs text-muted -mt-2">
                {diferenca > 0
                  ? "O cliente precisa pagar essa diferença."
                  : "A loja deve devolver esse valor ao cliente."}
              </p>
            )}

            {precisaFormaPagamento && (
              <div>
                <p className="text-xs text-muted mb-2">
                  {diferenca > 0 ? "Forma de pagamento da diferença" : "Forma de devolução do troco"}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS.map((forma) => (
                    <button
                      key={forma}
                      onClick={() => setFormaPagamentoDiferenca(forma)}
                      className={`text-xs py-2 rounded-lg border transition ${
                        formaPagamentoDiferenca === forma
                          ? "border-primary bg-primary-light text-primary-dark font-medium"
                          : "border-border text-muted hover:border-primary/40"
                      }`}
                    >
                      {LABEL_FORMA_PAGAMENTO[forma]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {erro && <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2">{erro}</div>}

            <button
              onClick={registrarTroca}
              disabled={!podeRegistrar || registrando}
              className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-dark text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
            >
              {registrando && <Loader2 className="w-4 h-4 animate-spin" />}
              Registrar troca
            </button>

            <button
              onClick={cancelarTroca}
              disabled={(itensDevolvidos.length === 0 && itensNovos.length === 0) || registrando}
              className="w-full flex items-center justify-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger font-medium py-2.5 rounded-lg transition disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemLinha({
  item,
  onMais,
  onMenos,
  onRemover,
}: {
  item: ItemLista;
  onMais: () => void;
  onMenos: () => void;
  onRemover: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-foreground">{item.produto.nome}</p>
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={onMenos}
            className="w-5 h-5 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-5 text-center text-xs">{item.quantidade}</span>
          <button
            onClick={onMais}
            className="w-5 h-5 flex items-center justify-center rounded border border-border text-muted hover:bg-background"
          >
            <Plus className="w-3 h-3" />
          </button>
          <button onClick={onRemover} className="ml-1 text-danger/70 hover:text-danger">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <span className="text-foreground whitespace-nowrap text-xs">
        {formatarMoeda(item.produto.precoVenda * item.quantidade)}
      </span>
    </li>
  );
}

function ComprovanteTroca({ troca, onNovaTroca }: { troca: Troca; onNovaTroca: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden receipt-print">
        <div className="bg-primary text-white px-6 py-5 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">Troca registrada</p>
          <p className="text-xs text-white/70 mt-0.5">Troca #{troca.id}</p>
        </div>

        {/* cabeçalho só visível na impressão: a tela já mostra "Troca registrada" acima */}
        <div className="hidden print:block text-center px-6 pt-4">
          <p className="font-semibold">PRESENTE DE DEUS</p>
          <p className="text-xs text-muted">Artigos Religiosos Católicos e Presentes</p>
          <p className="text-xs text-muted">CLN 07 Bloco B, Lote 1, Loja 04 — Riacho Fundo I, Brasília-DF</p>
          <p className="text-xs text-muted">(61) 3264087 · @presentededeusartigosreligiososcatolicos</p>
          <p className="text-xs text-muted mt-2">Comprovante de troca #{troca.id}</p>
          <p className="text-xs text-muted">{formatarDataHora(troca.dataHora)}</p>
        </div>

        <div className="p-6 font-mono text-sm receipt-dashed space-y-4">
          <div>
            <p className="text-xs text-danger font-medium mb-2">Devolvido</p>
            <ul className="space-y-1">
              {troca.itensDevolvidos.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {item.quantidade}x {item.produtoNome}
                  </span>
                  <span>{formatarMoeda(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs text-primary font-medium mb-2">Novo</p>
            <ul className="space-y-1">
              {troca.itensNovos.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <span className="text-muted">
                    {item.quantidade}x {item.produtoNome}
                  </span>
                  <span>{formatarMoeda(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border pt-3 space-y-1">
            <div className="flex justify-between text-xs text-muted">
              <span>Total devolvido</span>
              <span>{formatarMoeda(troca.valorDevolvido)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted">
              <span>Total novo</span>
              <span>{formatarMoeda(troca.valorNovo)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1">
              <span>Diferença</span>
              <span>{formatarMoeda(Math.abs(troca.diferenca))}</span>
            </div>
          </div>

          {troca.formaPagamentoDiferenca && (
            <p className="text-xs text-muted">
              {troca.diferenca > 0 ? "Diferença paga via" : "Troco devolvido via"}:{" "}
              {LABEL_FORMA_PAGAMENTO[troca.formaPagamentoDiferenca]}
            </p>
          )}
          {troca.observacao && <p className="text-xs text-muted">Obs: {troca.observacao}</p>}
        </div>
      </div>

      <div className="w-full max-w-sm flex gap-2 mt-4 no-print">
        <button
          onClick={() => window.print()}
          className="flex-1 flex items-center justify-center gap-2 bg-surface border border-border hover:bg-background text-foreground font-medium py-2.5 rounded-lg transition"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
        <button
          onClick={onNovaTroca}
          className="flex-1 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition"
        >
          Nova troca
        </button>
      </div>
    </div>
  );
}
