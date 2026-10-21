"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import LerConferenciaFoto from "@/components/LerConferenciaFoto";
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
  ClipboardCheck,
  Camera,
} from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";

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
  // abre o detalhe já no modo "editar conferência" (atalho do botão no card da lista)
  const [abrirEditandoConf, setAbrirEditandoConf] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
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

  /** Mostra na lista, na hora, a consignação que o servidor acabou de devolver (criada ou alterada). */
  function aplicarNaLista(c: Consignacao) {
    setLista((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev]));
  }

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
            <CarregandoSecao />
          ) : lista.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Handshake className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma consignação registrada ainda.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lista.map((c) => (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setAbrirEditandoConf(false);
                      setSelecionada(c);
                    }}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setAbrirEditandoConf(false);
                        setSelecionada(c);
                      }
                    }}
                    className="w-full text-left bg-surface border border-border rounded-xl p-4 hover:border-primary transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.consignatario}</p>
                        <p className="text-xs text-muted mt-0.5">
                          #{c.id} · {formatarDataHora(c.dataHora)} · {c.usuarioNome}
                          {c.prazoDevolucao ? ` · devolução até ${formatarDataISO(c.prazoDevolucao)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusBadge status={c.status} />
                        {c.status === "FECHADA" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAbrirEditandoConf(true);
                              setSelecionada(c);
                            }}
                            className="flex items-center gap-1 text-xs font-medium text-primary border border-primary/40 hover:bg-primary/10 rounded-full px-2.5 py-1 transition"
                          >
                            <ClipboardCheck className="w-3 h-3" />
                            Editar conferência
                          </button>
                        )}
                      </div>
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
                  </div>
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
            aplicarNaLista(c);
            carregar(true);
            setSelecionada(c);
          }}
        />
      )}

      {selecionada && (
        <ModalDetalhe
          consignacao={selecionada}
          iniciarEditandoConferencia={abrirEditandoConf}
          ehAdmin={ehAdmin}
          onClose={() => setSelecionada(null)}
          onAtualizada={(c) => {
            setSelecionada(c);
            aplicarNaLista(c);
            carregar(true);
          }}
          onExcluida={() => {
            const idExcluido = selecionada?.id;
            setSelecionada(null);
            if (idExcluido !== undefined) setLista((prev) => prev.filter((x) => x.id !== idExcluido));
            carregar(true);
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
 * Controle de quantidade da lista "Adicionar produtos": dá para digitar o número que quiser
 * (ex: 25) ou usar − e +. 0 = o produto não está na consignação. Enquanto o campo está em
 * foco ele mostra o que a pessoa digita (inclusive vazio); ao sair, volta a mostrar o valor
 * real da linha. `max` (estoque) limita o digitado e o botão +.
 */
function QuantidadeStepper({
  valor,
  max,
  desabilitado = false,
  rotulo,
  onChange,
}: {
  valor: number;
  max?: number;
  desabilitado?: boolean;
  rotulo: string;
  onChange: (n: number) => void;
}) {
  const [digitando, setDigitando] = useState<string | null>(null);
  const naLista = valor > 0;
  return (
    <div
      className={`flex items-center h-9 rounded-lg border-2 overflow-hidden transition ${
        naLista ? "border-primary bg-surface shadow-sm" : "border-border bg-surface"
      } ${desabilitado ? "opacity-40 pointer-events-none" : ""}`}
    >
      <button
        type="button"
        onClick={() => onChange(valor - 1)}
        disabled={valor <= 0}
        className="w-8 h-full flex items-center justify-center text-primary hover:bg-primary-light disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={`Diminuir ${rotulo}`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        inputMode="numeric"
        aria-label={`Quantidade de ${rotulo}`}
        className={`w-11 h-full text-center text-sm font-mono font-semibold bg-transparent outline-none focus:bg-primary-soft ${
          naLista ? "text-primary" : "text-muted"
        }`}
        value={digitando ?? String(valor)}
        onFocus={(e) => {
          setDigitando(String(valor));
          e.target.select();
        }}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 5);
          if (v === "") {
            setDigitando("");
            return;
          }
          const n = Number(v);
          setDigitando(String(max !== undefined ? Math.min(n, max) : n));
          onChange(n);
        }}
        onBlur={() => setDigitando(null)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <button
        type="button"
        onClick={() => onChange(valor + 1)}
        disabled={max !== undefined && valor >= max}
        className="w-8 h-full flex items-center justify-center text-primary hover:bg-primary-light disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label={`Aumentar ${rotulo}`}
      >
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
/**
 * Agrupa os itens por categoria do MESMO jeito que o Termo de Responsabilidade impresso:
 * título da categoria em maiúsculas ("Outros" sem categoria), categorias em ordem alfabética
 * e os produtos de cada uma também (pt-BR, sem acento, números pelo valor).
 */
function agruparPorCategoria<T>(
  lista: T[],
  categoria: (item: T) => string | null,
  nome: (item: T) => string
): { categoria: string; itens: T[] }[] {
  const comparar = (x: string, y: string) => x.localeCompare(y, "pt-BR", { sensitivity: "base", numeric: true });
  const porCategoria = new Map<string, T[]>();
  for (const item of lista) {
    const chave = (categoria(item) ?? "Outros").toUpperCase();
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), item]);
  }
  return [...porCategoria.entries()]
    .sort(([x], [y]) => comparar(x, y))
    .map(([cat, itens]) => ({ categoria: cat, itens: [...itens].sort((x, y) => comparar(nome(x), nome(y))) }));
}

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
  const enviandoRef = useRef(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  // edição do preço de uma linha (só vale nesta consignação; o cadastro do produto não muda)
  const [precoEmEdicao, setPrecoEmEdicao] = useState<{ produtoId: number; texto: string } | null>(null);
  // lista da direita: ao entrar um produto NOVO ela rola sozinha até ele e o destaca por uns instantes
  const listaItensRef = useRef<HTMLUListElement>(null);
  const [destaque, setDestaque] = useState<{ id: number; n: number } | null>(null);

  const erroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (erro) erroRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [erro]);

  useEffect(() => {
    if (!destaque) return;
    const linha = listaItensRef.current?.querySelector<HTMLElement>(`[data-item-id="${destaque.id}"]`);
    linha?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const t = setTimeout(() => setDestaque(null), 2200);
    return () => clearTimeout(t);
  }, [destaque]);

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

  // itens mostrados por categoria, como no Termo de Responsabilidade (só muda a exibição, não o que é salvo)
  const gruposItens = useMemo(() => agruparPorCategoria(itens, (i) => i.categoriaNome, (i) => i.nome), [itens]);

  const qtdNaLista = (produtoId: number) => itens.find((i) => i.produtoId === produtoId)?.quantidade ?? 0;

  /** Máximo permitido: o estoque atual, ou o que já estava enviado nesta consignação (se for maior),
   *  para que dê para diminuir/manter um item cujo estoque ficou menor que a quantidade enviada. */
  const limiteQtd = (p: Produto) =>
    Math.max(p.quantidadeEstoque, consignacao?.itens.find((i) => i.produtoId === p.id)?.quantidadeEnviada ?? 0);

  /** Linha nova do formulário (preço e comissão da categoria no momento em que entra). */
  function novoItem(produto: Produto, quantidade: number): ItemForm {
    return {
      produtoId: produto.id,
      nome: produto.nome,
      categoriaNome: produto.categoria?.nome ?? null,
      preco: produto.precoVenda,
      percentual: percentualComissaoConsignacao(produto.categoria?.nome),
      quantidade,
    };
  }

  /**
   * Define a quantidade EXATA de um produto na consignação (digitada ou via +/−):
   * 0 tira o produto da lista, e acima do estoque trava no estoque (o que já está na
   * consignação ainda não saiu do estoque, então o limite é o estoque atual).
   */
  function definirQtd(produto: Produto, desejada: number) {
    let quantidade = Math.max(0, Math.floor(desejada) || 0);
    const limite = limiteQtd(produto);
    if (quantidade > limite) {
      setErro(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.quantidadeEstoque})`);
      quantidade = limite;
    } else {
      setErro(null);
    }
    // a lista da direita rola até o produto e o destaca sempre que a quantidade dele muda
    // (novo OU já existente): com 100+ itens, sem isso a mudança acontece fora da tela
    // e parece que a lista não atualizou
    if (quantidade > 0 && quantidade !== qtdNaLista(produto.id)) {
      setDestaque((d) => ({ id: produto.id, n: (d?.n ?? 0) + 1 }));
    }
    setItens((prev) => {
      if (quantidade <= 0) return prev.filter((i) => i.produtoId !== produto.id);
      if (prev.some((i) => i.produtoId === produto.id)) {
        return prev.map((i) => (i.produtoId === produto.id ? { ...i, quantidade } : i));
      }
      return [...prev, novoItem(produto, quantidade)];
    });
  }

  /** +1 (usado pelo Enter / leitor de código de barras). */
  function adicionar(produto: Produto) {
    definirQtd(produto, qtdNaLista(produto.id) + 1);
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

  function abrirEdicaoPreco(item: ItemForm) {
    setPrecoEmEdicao({ produtoId: item.produtoId, texto: item.preco.toFixed(2).replace(".", ",") });
  }

  function confirmarPreco() {
    if (!precoEmEdicao) return;
    const bruto = precoEmEdicao.texto.trim();
    // "1.234,50" (milhar com ponto + vírgula) ou "12.50" / "12,50": a vírgula, se houver, é o decimal
    const valor = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
    if (!Number.isFinite(valor) || valor < 0 || valor > 99999999) {
      setErro("Informe um preço válido (pode ser 0,00), por exemplo 12,50.");
      return;
    }
    const preco = Math.round(valor * 100) / 100;
    setItens((prev) => prev.map((x) => (x.produtoId === precoEmEdicao.produtoId ? { ...x, preco } : x)));
    setDestaque((d) => ({ id: precoEmEdicao.produtoId, n: (d?.n ?? 0) + 1 }));
    setPrecoEmEdicao(null);
    setErro(null);
  }

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
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.preco })),
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

  /** Clique num item da consignação: busca o produto na lista ao lado, onde se muda a quantidade. */
  function localizar(item: ItemForm) {
    const produto = catalogo.find((p) => p.id === item.produtoId);
    alterarCategoria(null);
    alterarBusca(produto?.codigoBarras ?? semAcento(item.nome).replace(/[^a-z0-9]+/g, " ").trim());
    setAba("produtos");
    setTimeout(() => buscaRef.current?.focus(), 50);
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
      <div className="bg-background rounded-2xl w-full max-w-6xl h-[94dvh] max-h-[900px] flex flex-col overflow-hidden shadow-xl">
        {/* ------------------------------ Cabeçalho ------------------------------ */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0 bg-gradient-to-r from-primary to-primary-dark text-white">
          <div>
            <h2 className="font-semibold text-base">{editando ? `Editar consignação #${consignacao.id}` : "Nova consignação"}</h2>
            <p className="text-xs text-white/70 mt-0.5">
              {editando
                ? "Acrescente produtos, mude quantidades, preços ou remova itens. O preço alterado vale só para esta consignação."
                : "O estoque só dá baixa quando a consignação for fechada."}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/15 text-white/80 hover:text-white" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* abas (só no celular) */}
        <div className="lg:hidden flex border-b border-border shrink-0 bg-surface">
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
          className={`${aba === "dados" ? "block flex-1" : "hidden"} lg:block lg:flex-none px-5 py-4 border-b border-border bg-primary-light shrink-0 overflow-y-auto`}
        >
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_2fr]">
            <label className="text-xs font-semibold text-primary block">
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
            <label className="text-xs font-semibold text-primary block">
              Devolver o que não vender até
              <input type="date" className="input mt-1 text-foreground" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-primary block">
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
            <h3 className="hidden lg:flex items-center gap-2 text-sm font-semibold text-primary">
              <span className="w-1.5 h-4 rounded-full bg-accent" />
              Adicionar produtos
            </h3>

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
            <div className="flex-1 min-h-0 flex flex-col border border-border rounded-xl overflow-hidden bg-surface shadow-sm">
              {carregandoCatalogo ? (
                <CarregandoSecao className="flex-1" mensagem="Carregando produtos…" />
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
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2.5 border-l-4 transition-colors ${
                            naLista > 0 ? "bg-success-light border-l-primary" : "border-l-transparent hover:bg-primary-soft"
                          }`}
                        >
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
                          <div className="shrink-0">
                            <QuantidadeStepper
                              valor={naLista}
                              max={limiteQtd(p)}
                              desabilitado={semEstoque && naLista === 0}
                              rotulo={p.nome}
                              onChange={(n) => definirQtd(p, n)}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="shrink-0 flex items-center justify-between gap-3 text-xs text-primary bg-primary-light px-3 py-2 border-t border-border">
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
          <section className={`${aba === "itens" ? "flex" : "hidden"} lg:flex flex-col min-h-0 bg-surface-alt`}>
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-accent/40 bg-accent-light shrink-0">
              <div>
                <h3 className="text-sm font-semibold">Itens da consignação</h3>
                <p className="text-xs text-muted">
                  {itens.length === 0
                    ? "Nenhum produto adicionado"
                    : `${itens.length} ${plural(itens.length, "produto", "produtos")} · ${totalUnidades} ${plural(totalUnidades, "unidade", "unidades")}`}
                </p>
              </div>
              {itens.length > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={limparTudo} className="text-xs text-danger hover:underline">
                    Limpar tudo
                  </button>
                </div>
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
              <>
                <p className="shrink-0 px-4 sm:px-5 py-1.5 text-[11px] text-muted bg-accent-light/50 border-b border-accent/25">
                  Para mudar a quantidade, clique no item ou use a lista de produtos. Para mudar o preço, use o lápis $ ao lado de cada item.
                </p>
                <ul ref={listaItensRef} className="flex-1 min-h-0 overflow-y-auto divide-y divide-accent/25">
                  {gruposItens.map((g) => (
                    <Fragment key={g.categoria}>
                      <li className="sticky top-0 z-10 px-4 sm:px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-white bg-primary-dark border-y border-primary shadow-sm">
                        {g.categoria}:
                      </li>
                      {g.itens.map((i) => (
                    <li
                      key={i.produtoId}
                      data-item-id={i.produtoId}
                      className={`flex flex-wrap items-center gap-1 pl-3 pr-1.5 py-1.5 font-bold transition-colors duration-700 ${
                        destaque?.id === i.produtoId ? "bg-accent/35" : "bg-surface hover:bg-accent-light/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => localizar(i)}
                        title="Localizar na lista de produtos para mudar a quantidade"
                        className="flex-1 min-w-0 flex items-center gap-2 text-left"
                      >
                        <span className="shrink-0 min-w-[2.75rem] text-center rounded-md bg-primary text-white text-xs font-mono font-semibold px-1.5 py-1">
                          {i.quantidade}×
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] leading-tight font-bold truncate">{i.nome}</span>
                          <span className="block text-[11px] leading-tight text-muted truncate">
                            {formatarMoeda(i.preco)} · {i.categoriaNome ?? "Sem categoria"} · {i.percentual}%
                            {(() => {
                              const cat = catalogo.find((p) => p.id === i.produtoId);
                              return cat && cat.precoVenda !== i.preco ? " · preço alterado" : "";
                            })()}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-mono font-semibold">{formatarMoeda(i.preco * i.quantidade)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirEdicaoPreco(i)}
                        title="Mudar o preço deste item nesta consignação"
                        className="p-1.5 rounded-md hover:bg-accent-light text-primary shrink-0 text-xs font-mono font-bold leading-none"
                        aria-label={`Mudar o preço de ${i.nome}`}
                      >
                        R$
                      </button>
                      <button
                        type="button"
                        onClick={() => setItens((prev) => prev.filter((x) => x.produtoId !== i.produtoId))}
                        className="p-1.5 rounded-md hover:bg-danger-light text-danger shrink-0"
                        aria-label={`Remover ${i.nome}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {precoEmEdicao?.produtoId === i.produtoId && (
                        <div className="basis-full flex flex-wrap items-center gap-2 py-1.5 pr-1.5 font-normal">
                          <label className="text-xs text-muted">Novo preço (R$)</label>
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={precoEmEdicao.texto}
                            onChange={(e) => setPrecoEmEdicao({ produtoId: i.produtoId, texto: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                confirmarPreco();
                              }
                              if (e.key === "Escape") setPrecoEmEdicao(null);
                            }}
                            className="w-28 border border-border rounded-md px-2 py-1 text-sm font-mono bg-surface"
                          />
                          <button
                            type="button"
                            onClick={confirmarPreco}
                            className="bg-primary hover:bg-primary-dark text-white text-xs font-medium px-3 py-1.5 rounded-md"
                          >
                            Aplicar
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrecoEmEdicao(null)}
                            className="text-xs text-muted hover:text-foreground px-2 py-1.5"
                          >
                            Cancelar
                          </button>
                          {(() => {
                            const cat = catalogo.find((p) => p.id === i.produtoId);
                            return cat && cat.precoVenda !== i.preco ? (
                              <span className="text-[11px] text-muted">Preço no cadastro: {formatarMoeda(cat.precoVenda)}</span>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </li>
                      ))}
                    </Fragment>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {/* ------------------------------ Erro + rodapé ------------------------------ */}
        {erro && (
          <div ref={erroRef} className="px-5 pt-3 shrink-0">
            <div
              role="alert"
              className="flex items-start gap-2 text-sm font-semibold text-danger bg-danger-light border-2 border-danger rounded-lg px-3 py-2.5 shadow-sm"
            >
              <p className="flex-1">{erro}</p>
              <button onClick={() => setErro(null)} className="shrink-0 p-0.5" aria-label="Fechar aviso">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="px-5 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-primary to-primary-dark text-white">
          <div>
            <p className="text-xs text-white/70">
              {itens.length} {plural(itens.length, "produto", "produtos")} · {totalUnidades} {plural(totalUnidades, "unidade", "unidades")}
            </p>
            <p className="text-lg font-semibold font-mono leading-tight text-accent-light">
              {formatarMoeda(total)} <span className="text-xs font-sans font-normal text-white/70">total enviado</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!podeSalvar && (
              <span className="hidden md:inline text-xs text-white/70 mr-1">
                {consignatario.trim() === "" ? "Informe o consignatário" : "Adicione ao menos um produto"}
              </span>
            )}
            <button
              onClick={onClose}
              className="border border-white/30 text-white hover:bg-white/10 text-sm font-medium px-4 py-2.5 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={!podeSalvar || salvando}
              className="flex items-center gap-2 bg-accent hover:bg-accent-dark text-primary-dark font-semibold text-sm px-5 py-2.5 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editando ? "Salvar alterações" : "Registrar consignação"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Detalhe ---------------------------------- */

/** Rascunho da conferência (quantidades vendidas digitadas), guardado neste navegador: se a página
 *  recarregar ou o sistema atualizar no meio da conferência, o que foi digitado não se perde. */
const chaveRascunhoConferencia = (id: number) => `pdv_consignacao_rascunho_conferencia_${id}`;

function lerRascunhoConferencia(id: number): Record<number, number> | null {
  try {
    const bruto = localStorage.getItem(chaveRascunhoConferencia(id));
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Record<string, unknown>;
    const resultado: Record<number, number> = {};
    for (const [k, v] of Object.entries(dados)) {
      if (typeof v === "number" && Number.isFinite(v)) resultado[Number(k)] = v;
    }
    return resultado;
  } catch {
    return null;
  }
}

function salvarRascunhoConferencia(id: number, vendidas: Record<number, number>) {
  try {
    localStorage.setItem(chaveRascunhoConferencia(id), JSON.stringify(vendidas));
  } catch {
    // sem localStorage: vale só até fechar a tela
  }
}

function apagarRascunhoConferencia(id: number) {
  try {
    localStorage.removeItem(chaveRascunhoConferencia(id));
  } catch {
    // ignora
  }
}

/** Converte "12,50", "12.50" ou "1.234,50" em número (>= 0). Devolve null se for inválido. */
function parsePreco(texto: string): number | null {
  const bruto = texto.trim();
  if (bruto === "") return null;
  const valor = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
  if (!Number.isFinite(valor) || valor < 0 || valor > 99999999) return null;
  return Math.round(valor * 100) / 100;
}

function ModalDetalhe({
  consignacao,
  iniciarEditandoConferencia = false,
  ehAdmin,
  onClose,
  onAtualizada,
  onExcluida,
  onImprimir,
  onEditar,
}: {
  consignacao: Consignacao;
  iniciarEditandoConferencia?: boolean;
  ehAdmin: boolean;
  onClose: () => void;
  onAtualizada: (c: Consignacao) => void;
  onExcluida: () => void;
  onImprimir: (c: Consignacao) => void;
  onEditar: (c: Consignacao) => void;
}) {
  const aberta = consignacao.status === "ABERTA";
  // valor "de partida" de cada item: em aberto = 0 vendidas; fechada = o que já foi conferido
  const basePorItem = (vendidaAtual: number) => (aberta ? 0 : vendidaAtual);
  const baseInicial = () => Object.fromEntries(consignacao.itens.map((i) => [i.id, basePorItem(i.quantidadeVendida)]));
  const mudouDaBase = (v: Record<number, number>) =>
    consignacao.itens.some((i) => (v[i.id] ?? basePorItem(i.quantidadeVendida)) !== basePorItem(i.quantidadeVendida));
  /** Rascunho salvo automaticamente, só se tiver alguma quantidade diferente do ponto de partida. */
  const lerRascunhoValido = (): Record<number, number> | null => {
    const salvo = lerRascunhoConferencia(consignacao.id);
    return salvo !== null && mudouDaBase(salvo) ? { ...baseInicial(), ...salvo } : null;
  };
  // atalho "Editar conferência" do card da lista: já abre editando (com o rascunho, se houver)
  const comecaEditando = !aberta && iniciarEditandoConferencia;
  const [vendidas, setVendidas] = useState<Record<number, number>>(() =>
    comecaEditando ? lerRascunhoValido() ?? baseInicial() : {}
  );
  const [conferindo, setConferindo] = useState(false);
  // preços corrigidos na conferência (texto digitado por item); só valem para esta consignação
  const [precosTexto, setPrecosTexto] = useState<Record<number, string>>({});
  /** Preço efetivo do item: o corrigido (se válido) ou o gravado na consignação. */
  const precoDe = (i: { id: number; precoUnitario: number }) => {
    const t = precosTexto[i.id];
    if (t === undefined) return i.precoUnitario;
    return parsePreco(t) ?? i.precoUnitario;
  };
  const precoMudou = (i: { id: number; precoUnitario: number }) => precoDe(i) !== i.precoUnitario;
  const algumPrecoInvalido = Object.values(precosTexto).some((t) => parsePreco(t) === null);
  const [lendoFotos, setLendoFotos] = useState(false);
  const [veioDasFotos, setVeioDasFotos] = useState(false);
  // edição da conferência de uma consignação JÁ FECHADA (corrige as quantidades vendidas)
  const [editandoConf, setEditandoConf] = useState(comecaEditando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  // linhas por categoria, como no Termo de Responsabilidade: as quantidades vendidas são guardadas por id do item
  const gruposDetalhe = useMemo(
    () => agruparPorCategoria(consignacao.itens, (i) => i.categoriaNome, (i) => i.produtoNome),
    [consignacao.itens]
  );

  // salva sozinho a cada alteração enquanto a conferência está em andamento
  const emConferencia = aberta ? conferindo : editandoConf;
  useEffect(() => {
    if (!emConferencia) return;
    salvarRascunhoConferencia(consignacao.id, vendidas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emConferencia, vendidas, consignacao.id]);

  const vendidaDe = (id: number, enviada: number, atual: number) =>
    aberta || editandoConf ? Math.min(Math.max(vendidas[id] ?? 0, 0), enviada) : atual;

  /** Preenche a conferência com as quantidades lidas das fotos. Não fecha nem baixa nada. */
  function aplicarLeituraFotos(mapa: Record<number, number>) {
    const base = aberta ? (conferindo ? vendidas : lerRascunhoValido() ?? {}) : vendidas;
    setVendidas({ ...base, ...mapa });
    if (aberta) setConferindo(true);
    setVeioDasFotos(true);
    setLendoFotos(false);
  }

  /**
   * Consignação que vai para o relatório/impressão. Com conferência em andamento (digitada agora ou
   * guardada como rascunho neste navegador), as quantidades vendidas entram no relatório como PRÉVIA;
   * sem isso o relatório sai como sempre (em aberto = colunas em branco; fechada = valores salvos).
   */
  function consignacaoParaImprimir(): Consignacao {
    const origem: Record<number, number> | null = aberta
      ? conferindo
        ? vendidas
        : lerRascunhoValido()
      : editandoConf
      ? vendidas
      : null;
    const algumPreco = consignacao.itens.some(precoMudou);
    if (!origem && !algumPreco) return consignacao;
    if (origem && !mudouDaBase(origem) && !algumPreco) return consignacao;
    let totalEnviadoP = 0;
    let totalVendidoP = 0;
    let totalComissaoP = 0;
    const itens = consignacao.itens.map((i) => {
      const preco = precoDe(i);
      const q = Math.min(Math.max(origem?.[i.id] ?? basePorItem(i.quantidadeVendida), 0), i.quantidadeEnviada);
      const valorEnviado = Math.round(i.quantidadeEnviada * preco * 100) / 100;
      const valorVendido = Math.round(q * preco * 100) / 100;
      const comissao = Math.round(valorVendido * i.percentualComissao) / 100;
      totalEnviadoP += valorEnviado;
      totalVendidoP += valorVendido;
      totalComissaoP += comissao;
      return {
        ...i,
        precoUnitario: preco,
        valorEnviado,
        quantidadeVendida: q,
        quantidadeDevolvida: i.quantidadeEnviada - q,
        valorVendido,
        comissao,
      };
    });
    return {
      ...consignacao,
      itens,
      totalEnviado: totalEnviadoP,
      totalVendido: totalVendidoP,
      totalComissao: totalComissaoP,
      totalLiquidoLoja: totalVendidoP - totalComissaoP,
      conferenciaPrevia: true,
    };
  }

  // prévia do acerto enquanto o operador digita as quantidades vendidas
  let totalEnviadoPrevia = 0;
  let totalVendido = 0;
  let totalComissao = 0;
  let totalUnidadesVendidas = 0;
  for (const i of consignacao.itens) {
    const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
    const valor = q * precoDe(i);
    totalEnviadoPrevia += i.quantidadeEnviada * precoDe(i);
    totalUnidadesVendidas += q;
    totalVendido += valor;
    totalComissao += (valor * i.percentualComissao) / 100;
  }
  totalComissao = Math.round(totalComissao * 100) / 100;

  async function fechar() {
    if (enviandoRef.current) return;
    if (algumPrecoInvalido) {
      setErro("Há um preço inválido na lista. Use um valor como 12,50 (pode ser 0,00).");
      return;
    }
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
          precoUnitario: precoMudou(i) ? precoDe(i) : undefined,
        })),
      });
      apagarRascunhoConferencia(consignacao.id);
      onAtualizada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível fechar a consignação."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  // cancelar só sai do modo conferência: o que foi digitado continua salvo e volta ao reabrir
  function cancelarConferencia() {
    setVendidas({});
    setPrecosTexto({});
    setConferindo(false);
    setErro(null);
  }

  function iniciarEdicaoConferencia() {
    setPrecosTexto({});
    setVendidas(lerRascunhoValido() ?? baseInicial());
    setEditandoConf(true);
    setErro(null);
  }

  function cancelarEdicaoConferencia() {
    setVendidas({});
    setPrecosTexto({});
    setEditandoConf(false);
    setErro(null);
  }

  async function salvarConferencia() {
    if (enviandoRef.current) return;
    if (algumPrecoInvalido) {
      setErro("Há um preço inválido na lista. Use um valor como 12,50 (pode ser 0,00).");
      return;
    }
    if (!confirm("Salvar a conferência corrigida? O estoque será ajustado conforme a diferença nas quantidades vendidas.")) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.put<Consignacao>(`/consignacoes/${consignacao.id}/conferencia`, {
        itens: consignacao.itens.map((i) => ({
          itemId: i.id,
          quantidadeVendida: vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida),
          precoUnitario: precoMudou(i) ? precoDe(i) : undefined,
        })),
      });
      apagarRascunhoConferencia(consignacao.id);
      setVendidas({});
      setPrecosTexto({});
      setEditandoConf(false);
      onAtualizada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível salvar a conferência."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  // o X fecha a janela; a conferência em andamento fica salva e volta ao clicar no botão de conferência
  function fecharSemAlterar() {
    onClose();
  }

  async function excluir() {
    const aviso = aberta
      ? `Tem certeza que deseja EXCLUIR a consignação #${consignacao.id} de ${consignacao.consignatario}? O estoque não foi alterado, então nada volta. Esta ação não pode ser desfeita.`
      : `Tem certeza que deseja EXCLUIR a consignação FECHADA #${consignacao.id} de ${consignacao.consignatario}? As unidades vendidas voltam para o estoque. Esta ação não pode ser desfeita.`;
    if (!confirm(aviso)) return;
    try {
      await api.delete(`/consignacoes/${consignacao.id}`);
      apagarRascunhoConferencia(consignacao.id);
      onExcluida();
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      {lendoFotos && (
        <LerConferenciaFoto
          consignacao={consignacao}
          onAplicar={aplicarLeituraFotos}
          onFechar={() => setLendoFotos(false)}
        />
      )}
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
          <button
            onClick={fecharSemAlterar}
            title="Fechar (a conferência em andamento fica salva)"
            aria-label="Fechar"
            className="p-1 rounded-md hover:bg-background text-muted shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {editandoConf && (
            <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 mb-3">
              Corrija a quantidade <strong>vendida</strong> e, se precisar, o <strong>preço</strong> de cada item e salve.
              O estoque é ajustado pela diferença nas quantidades; mudar o preço só altera os valores desta consignação. Suas alterações são salvas automaticamente neste navegador.
            </p>
          )}
          {aberta && conferindo && (
            <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 mb-3">
              Quando o consignatário prestar contas, informe quantas unidades de cada item foram <strong>vendidas</strong> (e corrija o <strong>preço</strong>, se precisar) e
              feche a consignação. Só a quantidade vendida dá baixa no estoque; o restante volta para a loja. Suas alterações são salvas automaticamente neste navegador.
            </p>
          )}
          <table className="w-full text-xs font-bold bg-surface">
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
              {gruposDetalhe.map((g) => (
                <Fragment key={g.categoria}>
                  <tr className="bg-primary-dark">
                    <td colSpan={7} className="py-2 px-3 text-xs font-extrabold uppercase tracking-wider text-white">
                      {g.categoria}:
                    </td>
                  </tr>
                  {g.itens.map((i) => {
                const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
                return (
                  <tr key={i.id} className="border-b border-border bg-surface hover:bg-primary-light/60">
                    <td className="py-2 pr-2">
                      {i.produtoNome}
                      <span className="block font-semibold text-muted">{i.categoriaNome ?? "Sem categoria"}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada}</td>
                    <td className="py-2 px-2 text-right font-mono">
                      {emConferencia ? (
                        <input
                          inputMode="decimal"
                          title="Corrigir o preço deste item (vale só para esta consignação)"
                          value={precosTexto[i.id] ?? i.precoUnitario.toFixed(2).replace(".", ",")}
                          onChange={(e) => setPrecosTexto((prev) => ({ ...prev, [i.id]: e.target.value }))}
                          className={`input w-20 text-right py-1 font-mono ${
                            precosTexto[i.id] !== undefined && parsePreco(precosTexto[i.id]) === null
                              ? "border-danger"
                              : precoMudou(i)
                              ? "border-accent"
                              : ""
                          }`}
                        />
                      ) : (
                        formatarMoeda(i.precoUnitario)
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.percentualComissao}%</td>
                    <td className="py-2 px-2 text-right">
                      {(aberta && conferindo) || editandoConf ? (
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
                        <span className="font-mono">{aberta ? q : i.quantidadeVendida}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada - q}</td>
                    <td className="py-2 pl-2 text-right font-mono">{formatarMoeda(q * precoDe(i))}</td>
                  </tr>
                );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted">
              <span>Total enviado</span>
              <span className="font-mono">{formatarMoeda(emConferencia ? totalEnviadoPrevia : consignacao.totalEnviado)}</span>
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

          {ehAdmin && (
            <div className="mt-6 pt-4 border-t border-border/60">
              <button
                onClick={excluir}
                className="flex items-center gap-2 text-danger hover:bg-danger/10 text-xs font-medium px-3 py-2 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Excluir consignação
              </button>
            </div>
          )}
        </div>

        {veioDasFotos && emConferencia && (
          <div className="px-4 py-2 bg-accent-light text-accent-dark text-sm shrink-0">
            Quantidades preenchidas a partir das fotos. Confira na lista antes de fechar; nada foi baixado do estoque ainda.
          </div>
        )}

        <div className="p-4 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => onImprimir(consignacaoParaImprimir())}
              className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Printer className="w-4 h-4" />
              Visualizar / imprimir / salvar
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
            {(aberta || editandoConf) && (
              <button
                onClick={() => setLendoFotos(true)}
                className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                <Camera className="w-4 h-4" />
                Ler fotos do relatório
              </button>
            )}
          </div>
          {!aberta && !editandoConf && (
            <button
              onClick={iniciarEdicaoConferencia}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition"
            >
              <ClipboardCheck className="w-4 h-4" />
              Editar conferência
            </button>
          )}
          {!aberta && editandoConf && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarEdicaoConferencia}
                disabled={salvando}
                className="text-sm font-medium text-muted hover:text-foreground px-3 py-2.5 rounded-lg transition disabled:opacity-50"
              >
                Cancelar edição
              </button>
              <button
                onClick={salvarConferencia}
                disabled={salvando}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar conferência corrigida
              </button>
            </div>
          )}
          {aberta && !conferindo && (
            <button
              onClick={() => {
                setVendidas(lerRascunhoValido() ?? {});
                setConferindo(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition"
            >
              <ClipboardCheck className="w-4 h-4" />
              Fazer conferência
            </button>
          )}
          {aberta && conferindo && (
            <div className="flex items-center gap-2">
              <button
                onClick={cancelarConferencia}
                disabled={salvando}
                className="text-sm font-medium text-muted hover:text-foreground px-3 py-2.5 rounded-lg transition disabled:opacity-50"
              >
                Cancelar conferência
              </button>
              <button
                onClick={fechar}
                disabled={salvando}
                className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Fechar e dar baixa no estoque
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
