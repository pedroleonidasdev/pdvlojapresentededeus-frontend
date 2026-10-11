"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Categoria, Consignacao, Produto } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
  formatarDataISO,
  percentualComissaoConsignacao,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import VisualizarConsignacao from "@/components/VisualizarConsignacao";
import ReciboConsignacao from "@/components/ReciboConsignacao";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Handshake,
  Loader2,
  Printer,
  X,
  CheckCircle2,
  Clock,
  Lock,
  Pencil,
  Package,
  Receipt,
} from "lucide-react";

function mensagemErro(e: unknown, padrao: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? padrao;
}

export default function ConsignadosPage() {
  const { usuario } = useAuth();
  const ehAdmin = usuario?.perfil === "ADMIN";

  const [lista, setLista] = useState<Consignacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Consignacao | null>(null);
  const [selecionada, setSelecionada] = useState<Consignacao | null>(null);
  const [visualizando, setVisualizando] = useState<Consignacao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<Consignacao[]>("/consignacoes");
      setLista(data);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível carregar as consignações."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="min-h-full bg-background">
      <div className="no-print">
        <PageHeader
          title="Consignados"
          subtitle="Mercadorias entregues em consignação, comissão do consignatário e baixa no estoque"
          action={
            <button
              onClick={() => setNovaAberta(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Nova consignação
            </button>
          }
        />

        <div className="p-4 sm:p-8 max-w-5xl">
          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{erro}</p>}

          {carregando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : lista.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Handshake className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma consignação registrada ainda.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lista.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelecionada(c)}
                    className="w-full text-left bg-surface border border-border rounded-xl p-4 hover:border-primary transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.consignatario}</p>
                        <p className="text-xs text-muted mt-0.5">
                          #{c.id} · {formatarDataHora(c.dataHora)} · {c.usuarioNome}
                          {c.prazoDevolucao ? ` · devolução até ${formatarDataISO(c.prazoDevolucao)}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      <Resumo rotulo="Enviado" valor={formatarMoeda(c.totalEnviado)} />
                      <Resumo
                        rotulo="Vendido"
                        valor={c.status === "FECHADA" ? formatarMoeda(c.totalVendido) : "—"}
                      />
                      <Resumo
                        rotulo="Comissão"
                        valor={c.status === "FECHADA" ? formatarMoeda(c.totalComissao) : "—"}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {(novaAberta || emEdicao) && (
        <ModalConsignacaoForm
          consignacao={emEdicao}
          onClose={() => {
            setNovaAberta(false);
            setEmEdicao(null);
          }}
          onSalva={(c) => {
            setNovaAberta(false);
            setEmEdicao(null);
            carregar();
            setSelecionada(c);
          }}
        />
      )}

      {selecionada && (
        <ModalDetalhe
          consignacao={selecionada}
          ehAdmin={ehAdmin}
          onClose={() => setSelecionada(null)}
          onAtualizada={(c) => {
            setSelecionada(c);
            carregar();
          }}
          onExcluida={() => {
            setSelecionada(null);
            carregar();
          }}
          onImprimir={(c) => setVisualizando(c)}
          onEditar={(c) => {
            setSelecionada(null);
            setEmEdicao(c);
          }}
        />
      )}

      {visualizando && <VisualizarConsignacao consignacao={visualizando} onFechar={() => setVisualizando(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: Consignacao["status"] }) {
  return status === "FECHADA" ? (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
      <Lock className="w-3 h-3" /> Fechada
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
      <Clock className="w-3 h-3" /> Em aberto
    </span>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-muted">{rotulo}</p>
      <p className="font-medium text-sm">{valor}</p>
    </div>
  );
}

/* ------------------------------ Nova consignação ------------------------------ */

/** Linha do formulário (nova ou em edição). Guarda o preço da linha: em edição, os itens
 *  que já existiam mantêm o preço e a comissão gravados na criação da consignação. */
interface ItemForm {
  produtoId: number;
  nome: string;
  categoriaNome: string | null;
  preco: number;
  percentual: number;
  quantidade: number;
}

/**
 * Quantidade editável: dá para digitar o número (ex: 25) ou usar − e +. Enquanto o campo
 * está em foco ele mostra o que a pessoa digita (inclusive vazio); ao sair, volta a mostrar
 * o valor real da linha. Valores inválidos (0, vazio) são ignorados.
 */
function QuantidadeInput({
  valor,
  onChange,
  onMais,
  onMenos,
}: {
  valor: number;
  onChange: (n: number) => void;
  onMais: () => void;
  onMenos: () => void;
}) {
  const [digitando, setDigitando] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onMenos} className="p-1 rounded hover:bg-background" aria-label="Diminuir">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        inputMode="numeric"
        aria-label="Quantidade"
        className="input text-center font-mono py-1"
        style={{ width: "4.5rem" }}
        value={digitando ?? String(valor)}
        onFocus={(e) => {
          setDigitando(String(valor));
          e.target.select();
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 5);
          setDigitando(v);
          if (v !== "" && Number(v) >= 1) onChange(Number(v));
        }}
        onBlur={() => setDigitando(null)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" onClick={onMais} className="p-1 rounded hover:bg-background" aria-label="Aumentar">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/** minúsculas e sem acento: "Bíblia" e "biblia" são a mesma busca */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const SEM_CATEGORIA = "sem-categoria";
const LIMITE_RESULTADOS = 40;

/** Formulário de consignação: cria uma nova ou, quando recebe `consignacao`, edita uma em aberto. */
function ModalConsignacaoForm({
  consignacao,
  onClose,
  onSalva,
}: {
  consignacao: Consignacao | null;
  onClose: () => void;
  onSalva: (c: Consignacao) => void;
}) {
  const editando = consignacao !== null;
  const [consignatario, setConsignatario] = useState(consignacao?.consignatario ?? "");
  const [prazo, setPrazo] = useState(consignacao?.prazoDevolucao ?? "");
  const [observacao, setObservacao] = useState(consignacao?.observacao ?? "");
  const [itens, setItens] = useState<ItemForm[]>(
    () =>
      consignacao?.itens.map((i) => ({
        produtoId: i.produtoId,
        nome: i.produtoNome,
        categoriaNome: i.categoriaNome,
        preco: i.precoUnitario,
        percentual: i.percentualComissao,
        quantidade: i.quantidadeEnviada,
      })) ?? []
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reciboAberto, setReciboAberto] = useState(false);
  const enviandoRef = useRef(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  // catálogo carregado uma vez ao abrir: a busca e o filtro por categoria passam a ser
  // instantâneos (sem esperar o servidor a cada letra digitada)
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null); // id da categoria, SEM_CATEGORIA ou null (todas)
  const [limite, setLimite] = useState(LIMITE_RESULTADOS); // quantos resultados mostrar (cresce com "Mostrar mais")
  // no celular o modal vira 3 abas (Dados / Produtos / Itens); no computador tudo aparece junto
  const [aba, setAba] = useState<"dados" | "produtos" | "itens">(editando ? "itens" : "dados");

  function alterarBusca(valor: string) {
    setBusca(valor);
    setLimite(LIMITE_RESULTADOS);
  }
  function alterarCategoria(valor: string | null) {
    setCategoriaSel(valor);
    setLimite(LIMITE_RESULTADOS);
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([api.get<Produto[]>("/produtos"), api.get<Categoria[]>("/categorias")])
      .then(([prods, cats]) => {
        if (!ativo) return;
        setCatalogo(prods.data);
        setCategorias([...cats.data].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })));
      })
      .catch(() => ativo && setErro("Não foi possível carregar os produtos."))
      .finally(() => ativo && setCarregandoCatalogo(false));
    return () => {
      ativo = false;
    };
  }, []);

  const chaveCategoria = (p: Produto) => (p.categoria ? String(p.categoria.id) : SEM_CATEGORIA);

  const contagemPorCategoria = new Map<string, number>();
  for (const p of catalogo) contagemPorCategoria.set(chaveCategoria(p), (contagemPorCategoria.get(chaveCategoria(p)) ?? 0) + 1);

  const termo = semAcento(busca.trim());
  const palavras = termo.split(/\s+/).filter(Boolean);
  const buscando = palavras.length > 0 || categoriaSel !== null;

  const filtrados = !buscando
    ? []
    : catalogo
        .filter((p) => categoriaSel === null || chaveCategoria(p) === categoriaSel)
        .filter((p) => {
          if (palavras.length === 0) return true;
          const texto = semAcento(`${p.nome} ${p.codigoBarras ?? ""} ${p.categoria?.nome ?? ""}`);
          // palavras de 3+ letras casam em qualquer parte do texto ("roma" acha "aromática");
          // 1-2 letras só casam no INÍCIO de uma palavra, senão o "g" de "camiseta agape g"
          // acharia qualquer coisa que tenha a letra g no meio
          const inicios = texto.split(/[^a-z0-9]+/);
          return palavras.every((w) => (w.length >= 3 ? texto.includes(w) : inicios.some((x) => x.startsWith(w))));
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

  const qtdNaLista = (produtoId: number) => itens.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;

  // limite = estoque atual do produto (o que já está na consignação ainda não saiu do estoque).
  // Se o produto não estiver no catálogo (ex: foi inativado), não limita aqui — o servidor valida.
  const estoqueDe = (produtoId: number) => catalogo.find((p) => p.id === produtoId)?.quantidadeEstoque ?? Infinity;

  function adicionar(produto: Produto) {
    setErro(null);
    if (qtdNaLista(produto.id) + 1 > produto.quantidadeEstoque) {
      setErro(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.quantidadeEstoque})`);
      return;
    }
    setItens((prev) => {
      if (prev.some((i) => i.produtoId === produto.id)) {
        return prev.map((i) => (i.produtoId === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...prev,
        {
          produtoId: produto.id,
          nome: produto.nome,
          categoriaNome: produto.categoria?.nome ?? null,
          preco: produto.precoVenda,
          percentual: percentualComissaoConsignacao(produto.categoria?.nome),
          quantidade: 1,
        },
      ];
    });
  }

  /** Define a quantidade exata de uma linha (digitada ou via +/−), respeitando o estoque. */
  function definirQuantidade(produtoId: number, quantidade: number) {
    if (quantidade < 1) return;
    const item = itens.find((i) => i.produtoId === produtoId);
    if (!item) return;
    const limite = estoqueDe(produtoId);
    if (quantidade > limite) {
      setErro(`Estoque insuficiente para ${item.nome} (disponível: ${limite})`);
      quantidade = limite;
    } else {
      setErro(null);
    }
    setItens((prev) => prev.map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i)));
  }

  // Enter: leitor de código de barras digita o código e dá Enter — adiciona direto o produto
  // com aquele código; senão, se a busca achou um único produto, adiciona esse.
  function aoApertarEnter() {
    const texto = busca.trim();
    if (texto === "") return;
    const porCodigo = catalogo.find((p) => p.codigoBarras === texto);
    const alvo = porCodigo ?? (filtrados.length === 1 ? filtrados[0] : null);
    if (alvo && alvo.quantidadeEstoque > 0) {
      adicionar(alvo);
      setBusca("");
      buscaRef.current?.focus();
    } else if (!alvo && /^[0-9]{4,}$/.test(texto)) {
      setErro(`Nenhum produto com o código ${texto}`);
    }
  }

  const total = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const totalUnidades = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const podeSalvar = consignatario.trim() !== "" && itens.length > 0;

  async function salvar() {
    if (!podeSalvar || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const corpo = {
        consignatario: consignatario.trim(),
        prazoDevolucao: prazo || undefined,
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      };
      const { data } = editando
        ? await api.put<Consignacao>(`/consignacoes/${consignacao.id}`, corpo)
        : await api.post<Consignacao>("/consignacoes", corpo);
      onSalva(data);
    } catch (e) {
      setErro(mensagemErro(e, editando ? "Não foi possível salvar as alterações." : "Não foi possível registrar a consignação."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  /** Tira 1 unidade; se era a última, remove o item da consignação. */
  function diminuir(produtoId: number) {
    const atual = qtdNaLista(produtoId);
    if (atual <= 1) setItens((prev) => prev.filter((x) => x.produtoId !== produtoId));
    else definirQuantidade(produtoId, atual - 1);
  }

  function limparTudo() {
    if (itens.length === 0) return;
    if (confirm(`Remover os ${itens.length} produto(s) da lista?`)) setItens([]);
  }

  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
  const botaoAba = (id: typeof aba) =>
    `flex-1 px-3 py-2.5 text-sm font-medium border-b-2 transition ${
      aba === id ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 sm:p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-6xl h-[94dvh] max-h-[900px] flex flex-col overflow-hidden shadow-xl">
        {/* ------------------------------ Cabeçalho ------------------------------ */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-base">{editando ? `Editar consignação #${consignacao.id}` : "Nova consignação"}</h2>
            <p className="text-xs text-muted mt-0.5">
              {editando
                ? "Acrescente produtos, mude quantidades ou remova itens. Itens que já estavam mantêm o preço original."
                : "O estoque só dá baixa quando a consignação for fechada."}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-background text-muted" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* abas (só no celular) */}
        <div className="lg:hidden flex border-b border-border shrink-0">
          <button type="button" className={botaoAba("dados")} onClick={() => setAba("dados")}>
            1 · Dados{consignatario.trim() === "" && <span className="ml-1 text-danger">•</span>}
          </button>
          <button type="button" className={botaoAba("produtos")} onClick={() => setAba("produtos")}>
            2 · Produtos
          </button>
          <button type="button" className={botaoAba("itens")} onClick={() => setAba("itens")}>
            3 · Itens{itens.length > 0 && <span className="ml-1.5 rounded-full bg-primary text-white text-xs px-1.5 py-0.5">{itens.length}</span>}
          </button>
        </div>

        {/* ------------------------------ Dados da consignação ------------------------------ */}
        <div
          className={`${aba === "dados" ? "block flex-1" : "hidden"} lg:block lg:flex-none px-5 py-4 border-b border-border bg-background/40 shrink-0 overflow-y-auto`}
        >
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_2fr]">
            <label className="text-xs font-medium text-muted block">
              Consignatário * <span className="font-normal">(quem recebe a mercadoria)</span>
              <input
                className="input mt-1 text-foreground"
                placeholder="Ex: Cursilho Feminino - 2026"
                value={consignatario}
                onChange={(e) => setConsignatario(e.target.value)}
                maxLength={150}
                autoFocus={!editando}
              />
            </label>
            <label className="text-xs font-medium text-muted block">
              Devolver o que não vender até
              <input type="date" className="input mt-1 text-foreground" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted block">
              Observação <span className="font-normal">(opcional)</span>
              <input
                className="input mt-1 text-foreground"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={255}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setAba("produtos")}
            className="lg:hidden mt-4 w-full bg-primary text-white text-sm font-medium py-2.5 rounded-lg"
          >
            Continuar para os produtos
          </button>
        </div>

        {/* ------------------------------ Produtos | Itens ------------------------------ */}
        <div className={`${aba === "dados" ? "hidden" : "grid"} lg:grid flex-1 min-h-0 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]`}>
          {/* ---------- esquerda: buscar e adicionar produtos ---------- */}
          <section className={`${aba === "produtos" ? "flex" : "hidden"} lg:flex flex-col min-h-0 gap-3 p-4 sm:p-5 lg:border-r border-border`}>
            <h3 className="hidden lg:block text-sm font-semibold">Adicionar produtos</h3>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={buscaRef}
                  className="input"
                  style={{ paddingLeft: "2.5rem", paddingRight: busca ? "2.5rem" : undefined }}
                  placeholder="Nome, categoria ou código de barras"
                  value={busca}
                  onChange={(e) => alterarBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && aoApertarEnter()}
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => {
                      alterarBusca("");
                      buscaRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:bg-background"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="sm:w-64 sm:shrink-0">
                <select
                  value={categoriaSel ?? ""}
                  onChange={(e) => alterarCategoria(e.target.value || null)}
                  className="input"
                  aria-label="Filtrar por categoria"
                >
                  <option value="">Todas as categorias ({catalogo.length})</option>
                  {categorias
                    .filter((c) => (contagemPorCategoria.get(String(c.id)) ?? 0) > 0)
                    .map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.nome} ({contagemPorCategoria.get(String(c.id))}) · comissão {percentualComissaoConsignacao(c.nome)}%
                      </option>
                    ))}
                  {(contagemPorCategoria.get(SEM_CATEGORIA) ?? 0) > 0 && (
                    <option value={SEM_CATEGORIA}>Sem categoria ({contagemPorCategoria.get(SEM_CATEGORIA)})</option>
                  )}
                </select>
              </div>
            </div>

            {/* resultados: a única rolagem desta coluna */}
            <div className="flex-1 min-h-0 flex flex-col border border-border rounded-xl overflow-hidden bg-surface">
              {carregandoCatalogo ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos...
                </div>
              ) : !buscando ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-muted">
                  <Search className="w-8 h-8 opacity-40" />
                  <p className="text-sm">Digite o nome do produto ou escolha uma categoria.</p>
                  <p className="text-xs">Com leitor, é só passar o código de barras e apertar Enter.</p>
                </div>
              ) : filtrados.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted px-4 text-center">
                  Nenhum produto encontrado.
                </div>
              ) : (
                <>
                  <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                    {filtrados.slice(0, limite).map((p) => {
                      const naLista = qtdNaLista(p.id);
                      const semEstoque = p.quantidadeEstoque <= 0;
                      const esgotou = naLista >= p.quantidadeEstoque;
                      return (
                        <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${naLista > 0 ? "bg-primary-soft" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug line-clamp-2">{p.nome}</p>
                            <p className="text-xs text-muted truncate">
                              {p.categoria?.nome ?? "Sem categoria"}
                              {p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-mono font-medium">{formatarMoeda(p.precoVenda)}</p>
                            <p className={`text-xs ${semEstoque ? "text-danger" : "text-muted"}`}>
                              {semEstoque ? "Sem estoque" : `${p.quantidadeEstoque} em estoque`}
                            </p>
                          </div>
                          <div className="shrink-0 w-[6.75rem] flex justify-end">
                            {naLista === 0 ? (
                              <button
                                type="button"
                                onClick={() => adicionar(p)}
                                disabled={semEstoque}
                                className="flex items-center gap-1 h-9 px-3 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition disabled:opacity-40"
                                aria-label={`Adicionar ${p.nome}`}
                              >
                                <Plus className="w-4 h-4" /> Add
                              </button>
                            ) : (
                              <div className="flex items-center rounded-lg border border-primary bg-surface overflow-hidden h-9">
                                <button
                                  type="button"
                                  onClick={() => diminuir(p.id)}
                                  className="w-8 h-full flex items-center justify-center hover:bg-primary-light"
                                  aria-label="Diminuir"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-mono font-semibold">{naLista}</span>
                                <button
                                  type="button"
                                  onClick={() => adicionar(p)}
                                  disabled={esgotou}
                                  className="w-8 h-full flex items-center justify-center hover:bg-primary-light disabled:opacity-30 disabled:hover:bg-transparent"
                                  aria-label="Aumentar"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="shrink-0 flex items-center justify-between gap-3 text-xs text-muted bg-background px-3 py-2 border-t border-border">
                    <span>
                      {filtrados.length > limite
                        ? `Mostrando ${limite} de ${filtrados.length} produtos`
                        : `${filtrados.length} ${plural(filtrados.length, "produto", "produtos")}`}
                    </span>
                    {filtrados.length > limite && (
                      <button
                        type="button"
                        onClick={() => setLimite((l) => l + LIMITE_RESULTADOS)}
                        className="font-medium text-primary hover:underline"
                      >
                        Mostrar mais
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ---------- direita: itens da consignação ---------- */}
          <section className={`${aba === "itens" ? "flex" : "hidden"} lg:flex flex-col min-h-0 bg-background/30`}>
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border shrink-0">
              <div>
                <h3 className="text-sm font-semibold">Itens da consignação</h3>
                <p className="text-xs text-muted">
                  {itens.length === 0
                    ? "Nenhum produto adicionado"
                    : `${itens.length} ${plural(itens.length, "produto", "produtos")} · ${totalUnidades} ${plural(totalUnidades, "unidade", "unidades")}`}
                </p>
              </div>
              {itens.length > 0 && (
                <button type="button" onClick={limparTudo} className="text-xs text-danger hover:underline">
                  Limpar tudo
                </button>
              )}
            </div>

            {itens.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2 text-muted">
                <Package className="w-9 h-9 opacity-40" />
                <p className="text-sm">Os produtos que você adicionar aparecem aqui.</p>
                <button type="button" onClick={() => setAba("produtos")} className="lg:hidden text-sm font-medium text-primary hover:underline">
                  Ir para os produtos
                </button>
              </div>
            ) : (
              <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
                {itens.map((i) => (
                  <li key={i.produtoId} className="px-4 sm:px-5 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{i.nome}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {i.categoriaNome ?? "Sem categoria"} · comissão {i.percentual}%
                        </p>
                      </div>
                      <button
                        onClick={() => setItens((prev) => prev.filter((x) => x.produtoId !== i.produtoId))}
                        className="p-1.5 rounded-md hover:bg-danger-light text-danger shrink-0"
                        aria-label={`Remover ${i.nome}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <QuantidadeInput
                        valor={i.quantidade}
                        onChange={(n) => definirQuantidade(i.produtoId, n)}
                        onMais={() => definirQuantidade(i.produtoId, i.quantidade + 1)}
                        onMenos={() => {
                          if (i.quantidade > 1) definirQuantidade(i.produtoId, i.quantidade - 1);
                        }}
                      />
                      <div className="text-right">
                        <p className="text-xs text-muted">{formatarMoeda(i.preco)} cada</p>
                        <p className="text-sm font-mono font-semibold">{formatarMoeda(i.preco * i.quantidade)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------ Erro + rodapé ------------------------------ */}
        {erro && (
          <div className="px-5 pt-3 shrink-0">
            <div className="flex items-start gap-2 text-sm text-danger bg-danger-light rounded-lg px-3 py-2">
              <p className="flex-1">{erro}</p>
              <button onClick={() => setErro(null)} className="shrink-0 p-0.5" aria-label="Fechar aviso">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-3 bg-surface">
          <div>
            <p className="text-xs text-muted">
              {itens.length} {plural(itens.length, "produto", "produtos")} · {totalUnidades} {plural(totalUnidades, "unidade", "unidades")}
            </p>
            <p className="text-lg font-semibold font-mono leading-tight">
              {formatarMoeda(total)} <span className="text-xs font-sans font-normal text-muted">total enviado</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!podeSalvar && (
              <span className="hidden md:inline text-xs text-muted mr-1">
                {consignatario.trim() === "" ? "Informe o consignatário" : "Adicione ao menos um produto"}
              </span>
            )}
            <button
              type="button"
              onClick={() => setReciboAberto(true)}
              disabled={consignatario.trim() === ""}
              title={consignatario.trim() === "" ? "Informe o consignatário para gerar o recibo" : "Gerar recibo em nome do consignatário"}
              className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              <Receipt className="w-4 h-4" />
              Gerar recibo
            </button>
            <button
              onClick={onClose}
              className="border border-border hover:bg-background text-sm font-medium px-4 py-2.5 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!podeSalvar || salvando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editando ? "Salvar alterações" : "Registrar consignação"}
            </button>
          </div>
        </div>
      </div>

      {reciboAberto && (
        <ReciboConsignacao consignatario={consignatario.trim()} onFechar={() => setReciboAberto(false)} />
      )}
    </div>
  );
}

/* ---------------------------------- Detalhe ---------------------------------- */

function ModalDetalhe({
  consignacao,
  ehAdmin,
  onClose,
  onAtualizada,
  onExcluida,
  onImprimir,
  onEditar,
}: {
  consignacao: Consignacao;
  ehAdmin: boolean;
  onClose: () => void;
  onAtualizada: (c: Consignacao) => void;
  onExcluida: () => void;
  onImprimir: (c: Consignacao) => void;
  onEditar: (c: Consignacao) => void;
}) {
  const aberta = consignacao.status === "ABERTA";
  const [vendidas, setVendidas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reciboAberto, setReciboAberto] = useState(false);
  const enviandoRef = useRef(false);

  const vendidaDe = (id: number, enviada: number, atual: number) =>
    aberta ? Math.min(Math.max(vendidas[id] ?? 0, 0), enviada) : atual;

  // prévia do acerto enquanto o operador digita as quantidades vendidas
  let totalVendido = 0;
  let totalComissao = 0;
  let totalUnidadesVendidas = 0;
  for (const i of consignacao.itens) {
    const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
    const valor = q * i.precoUnitario;
    totalUnidadesVendidas += q;
    totalVendido += valor;
    totalComissao += (valor * i.percentualComissao) / 100;
  }
  totalComissao = Math.round(totalComissao * 100) / 100;

  async function fechar() {
    if (enviandoRef.current) return;
    const msg =
      totalUnidadesVendidas > 0
        ? `Fechar a consignação e dar baixa de ${totalUnidadesVendidas} unidade(s) vendida(s) no estoque? Essa ação só pode ser desfeita por um administrador, excluindo a consignação.`
        : "Nenhuma unidade foi marcada como vendida. Fechar mesmo assim (sem baixa no estoque)?";
    if (!confirm(msg)) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.post<Consignacao>(`/consignacoes/${consignacao.id}/fechar`, {
        itens: consignacao.itens.map((i) => ({
          itemId: i.id,
          quantidadeVendida: vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida),
        })),
      });
      onAtualizada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível fechar a consignação."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  async function excluir() {
    const aviso = aberta
      ? "Excluir esta consignação? O estoque não foi alterado, então nada volta."
      : "Excluir esta consignação FECHADA? As unidades vendidas voltam para o estoque.";
    if (!confirm(aviso)) return;
    try {
      await api.delete(`/consignacoes/${consignacao.id}`);
      onExcluida();
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-sm truncate">{consignacao.consignatario}</h2>
              <StatusBadge status={consignacao.status} />
            </div>
            <p className="text-xs text-muted mt-0.5">
              #{consignacao.id} · {formatarDataHora(consignacao.dataHora)} · {consignacao.usuarioNome}
              {consignacao.prazoDevolucao ? ` · devolução até ${formatarDataISO(consignacao.prazoDevolucao)}` : ""}
              {consignacao.dataFechamento ? ` · fechada em ${formatarDataHora(consignacao.dataFechamento)}` : ""}
            </p>
            {consignacao.observacao && <p className="text-xs text-muted mt-0.5">Obs: {consignacao.observacao}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-background text-muted shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {aberta && (
            <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 mb-3">
              Quando o consignatário prestar contas, informe quantas unidades de cada item foram <strong>vendidas</strong> e
              feche a consignação. Só a quantidade vendida dá baixa no estoque; o restante volta para a loja.
            </p>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-2 font-medium">Produto</th>
                <th className="py-2 px-2 font-medium text-right">Enviada</th>
                <th className="py-2 px-2 font-medium text-right">Preço</th>
                <th className="py-2 px-2 font-medium text-right">Com.</th>
                <th className="py-2 px-2 font-medium text-right">Vendida</th>
                <th className="py-2 px-2 font-medium text-right">Devolvida</th>
                <th className="py-2 pl-2 font-medium text-right">Valor vendido</th>
              </tr>
            </thead>
            <tbody>
              {consignacao.itens.map((i) => {
                const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
                return (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      {i.produtoNome}
                      <span className="block text-muted">{i.categoriaNome ?? "Sem categoria"}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatarMoeda(i.precoUnitario)}</td>
                    <td className="py-2 px-2 text-right font-mono">{i.percentualComissao}%</td>
                    <td className="py-2 px-2 text-right">
                      {aberta ? (
                        <input
                          type="number"
                          min={0}
                          max={i.quantidadeEnviada}
                          value={vendidas[i.id] ?? 0}
                          onChange={(e) =>
                            setVendidas((prev) => ({ ...prev, [i.id]: Math.floor(Number(e.target.value) || 0) }))
                          }
                          className="input w-16 text-right py-1"
                        />
                      ) : (
                        <span className="font-mono">{i.quantidadeVendida}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada - q}</td>
                    <td className="py-2 pl-2 text-right font-mono">{formatarMoeda(q * i.precoUnitario)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted">
              <span>Total enviado</span>
              <span className="font-mono">{formatarMoeda(consignacao.totalEnviado)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total vendido</span>
              <span className="font-mono">{formatarMoeda(totalVendido)}</span>
            </div>
            <div className="flex justify-between">
              <span>Comissão do consignatário</span>
              <span className="font-mono">{formatarMoeda(totalComissao)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1">
              <span>Líquido para a loja</span>
              <span className="font-mono">{formatarMoeda(totalVendido - totalComissao)}</span>
            </div>
          </div>

          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mt-4">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => onImprimir(consignacao)}
              className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Printer className="w-4 h-4" />
              Visualizar / imprimir / salvar
            </button>
            <button
              onClick={() => setReciboAberto(true)}
              className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Receipt className="w-4 h-4" />
              Gerar recibo
            </button>
            {aberta && (
              <button
                onClick={() => onEditar(consignacao)}
                className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <Pencil className="w-4 h-4" />
                Editar / acrescentar produtos
              </button>
            )}
            {ehAdmin && (
              <button
                onClick={excluir}
                className="flex items-center gap-2 text-danger hover:bg-danger/10 text-sm font-medium px-3 py-2 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>
          {aberta && (
            <button
              onClick={fechar}
              disabled={salvando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Fechar e dar baixa no estoque
            </button>
          )}
        </div>
      </div>

      {reciboAberto && (
        <ReciboConsignacao
          consignatario={consignacao.consignatario}
          valorLiquidoLoja={aberta ? null : consignacao.totalLiquidoLoja}
          onFechar={() => setReciboAberto(false)}
        />
      )}
    </div>
  );
}
