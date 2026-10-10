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

      {novaAberta && (
        <ModalNovaConsignacao
          onClose={() => setNovaAberta(false)}
          onCriada={(c) => {
            setNovaAberta(false);
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

interface ItemNovo {
  produto: Produto;
  quantidade: number;
}

/** minúsculas e sem acento: "Bíblia" e "biblia" são a mesma busca */
function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const SEM_CATEGORIA = "sem-categoria";
const LIMITE_RESULTADOS = 40;

function ModalNovaConsignacao({
  onClose,
  onCriada,
}: {
  onClose: () => void;
  onCriada: (c: Consignacao) => void;
}) {
  const [consignatario, setConsignatario] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemNovo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  // catálogo carregado uma vez ao abrir: a busca e o filtro por categoria passam a ser
  // instantâneos (sem esperar o servidor a cada letra digitada)
  const [catalogo, setCatalogo] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaSel, setCategoriaSel] = useState<string | null>(null); // id da categoria, SEM_CATEGORIA ou null (todas)

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

  const qtdNaLista = (produtoId: number) => itens.find((i) => i.produto.id === produtoId)?.quantidade ?? 0;

  function adicionar(produto: Produto) {
    setErro(null);
    const atual = qtdNaLista(produto.id);
    if (atual + 1 > produto.quantidadeEstoque) {
      setErro(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.quantidadeEstoque})`);
      return;
    }
    setItens((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id);
      if (existente) return prev.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [...prev, { produto, quantidade: 1 }];
    });
  }

  function alterar(produtoId: number, delta: number) {
    setItens((prev) =>
      prev
        .map((i) => {
          if (i.produto.id !== produtoId) return i;
          const nova = i.quantidade + delta;
          if (nova > i.produto.quantidadeEstoque) {
            setErro(`Estoque insuficiente para ${i.produto.nome} (disponível: ${i.produto.quantidadeEstoque})`);
            return i;
          }
          return { ...i, quantidade: nova };
        })
        .filter((i) => i.quantidade > 0)
    );
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

  const total = itens.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0);
  const totalUnidades = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const podeSalvar = consignatario.trim() !== "" && itens.length > 0;

  async function salvar() {
    if (!podeSalvar || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.post<Consignacao>("/consignacoes", {
        consignatario: consignatario.trim(),
        prazoDevolucao: prazo || undefined,
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      onCriada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível registrar a consignação."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
      ativo ? "bg-primary text-white border-primary" : "bg-surface border-border text-foreground hover:border-primary"
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Nova consignação</h2>
            <p className="text-xs text-muted mt-0.5">O estoque só dá baixa quando a consignação for fechada.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-background text-muted" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-muted block sm:col-span-2">
              Consignatário (quem recebe a mercadoria)
              <input
                className="input mt-1"
                placeholder="Ex: Cursilho Feminino - 2026"
                value={consignatario}
                onChange={(e) => setConsignatario(e.target.value)}
                maxLength={150}
              />
            </label>
            <label className="text-xs text-muted block">
              Devolver o que não vender até
              <input type="date" className="input mt-1" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <label className="text-xs text-muted block">
              Observação (opcional)
              <input
                className="input mt-1"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={255}
              />
            </label>
          </div>

          {/* ------------------------------ Adicionar produtos ------------------------------ */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Adicionar produtos</h3>

            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={buscaRef}
                className="input"
                style={{ paddingLeft: "2.5rem", paddingRight: busca ? "2.5rem" : undefined }}
                placeholder="Buscar por nome, categoria ou código de barras"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && aoApertarEnter()}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    buscaRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:bg-background"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* categorias: toque para listar só os produtos daquela categoria */}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(categoriaSel === null)} onClick={() => setCategoriaSel(null)}>
                Todas
                <span className={categoriaSel === null ? "text-white/80" : "text-muted"}>{catalogo.length}</span>
              </button>
              {categorias
                .filter((c) => (contagemPorCategoria.get(String(c.id)) ?? 0) > 0)
                .map((c) => {
                  const ativo = categoriaSel === String(c.id);
                  const pct = percentualComissaoConsignacao(c.nome);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={chip(ativo)}
                      onClick={() => setCategoriaSel(ativo ? null : String(c.id))}
                      title={`Comissão do consignatário: ${pct}%`}
                    >
                      {c.nome}
                      <span className={ativo ? "text-white/80" : "text-muted"}>{contagemPorCategoria.get(String(c.id))}</span>
                      <span
                        className={`rounded px-1 text-[10px] ${
                          ativo ? "bg-white/20 text-white" : pct === 15 ? "bg-amber-100 text-amber-700" : "bg-background text-muted"
                        }`}
                      >
                        {pct}%
                      </span>
                    </button>
                  );
                })}
              {(contagemPorCategoria.get(SEM_CATEGORIA) ?? 0) > 0 && (
                <button
                  type="button"
                  className={chip(categoriaSel === SEM_CATEGORIA)}
                  onClick={() => setCategoriaSel(categoriaSel === SEM_CATEGORIA ? null : SEM_CATEGORIA)}
                >
                  Sem categoria
                  <span className={categoriaSel === SEM_CATEGORIA ? "text-white/80" : "text-muted"}>
                    {contagemPorCategoria.get(SEM_CATEGORIA)}
                  </span>
                </button>
              )}
            </div>

            {/* resultados */}
            <div className="border border-border rounded-xl overflow-hidden">
              {carregandoCatalogo ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando produtos...
                </div>
              ) : !buscando ? (
                <p className="text-sm text-muted text-center py-8 px-4">
                  Escolha uma categoria acima ou digite o nome do produto. Com leitor, é só passar o código de barras.
                </p>
              ) : filtrados.length === 0 ? (
                <p className="text-sm text-muted text-center py-8 px-4">Nenhum produto encontrado.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                    {filtrados.slice(0, LIMITE_RESULTADOS).map((p) => {
                      const naLista = qtdNaLista(p.id);
                      const semEstoque = p.quantidadeEstoque <= 0;
                      const esgotou = naLista >= p.quantidadeEstoque;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => adicionar(p)}
                            disabled={semEstoque || esgotou}
                            className="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-background disabled:opacity-50 disabled:hover:bg-transparent"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{p.nome}</p>
                              <p className="text-xs text-muted truncate">
                                {p.categoria?.nome ?? "Sem categoria"} · comissão{" "}
                                {percentualComissaoConsignacao(p.categoria?.nome)}%
                                {p.codigoBarras ? ` · ${p.codigoBarras}` : ""}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-mono">{formatarMoeda(p.precoVenda)}</p>
                              <p className={`text-xs ${semEstoque ? "text-danger" : "text-muted"}`}>
                                {semEstoque ? "Sem estoque" : `estoque ${p.quantidadeEstoque}`}
                              </p>
                            </div>
                            {naLista > 0 && (
                              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5">
                                {naLista} na lista
                              </span>
                            )}
                            <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white">
                              <Plus className="w-4 h-4" />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs text-muted bg-background px-3 py-1.5">
                    {filtrados.length > LIMITE_RESULTADOS
                      ? `Mostrando ${LIMITE_RESULTADOS} de ${filtrados.length} produtos — digite mais letras para refinar.`
                      : `${filtrados.length} produto${filtrados.length === 1 ? "" : "s"}`}
                  </p>
                </>
              )}
            </div>
          </section>

          {/* ------------------------------ Itens da consignação ------------------------------ */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Itens da consignação{itens.length > 0 ? ` (${totalUnidades} unidade${totalUnidades === 1 ? "" : "s"})` : ""}
            </h3>
            {itens.length === 0 ? (
              <p className="text-sm text-muted border border-dashed border-border rounded-xl text-center py-5">
                Nenhum produto adicionado ainda.
              </p>
            ) : (
              <ul className="border border-border rounded-xl divide-y divide-border">
                {itens.map((i) => (
                  <li key={i.produto.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{i.produto.nome}</p>
                      <p className="text-xs text-muted">
                        {i.produto.categoria?.nome ?? "Sem categoria"} · comissão{" "}
                        {percentualComissaoConsignacao(i.produto.categoria?.nome)}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => alterar(i.produto.id, -1)} className="p-1 rounded hover:bg-background" aria-label="Diminuir">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center font-mono">{i.quantidade}</span>
                      <button onClick={() => alterar(i.produto.id, 1)} className="p-1 rounded hover:bg-background" aria-label="Aumentar">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="w-24 text-right font-mono">{formatarMoeda(i.produto.precoVenda * i.quantidade)}</span>
                    <button
                      onClick={() => setItens((prev) => prev.filter((x) => x.produto.id !== i.produto.id))}
                      className="p-1 rounded hover:bg-background text-danger"
                      aria-label="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm">
            Total enviado: <strong>{formatarMoeda(total)}</strong>
          </p>
          <button
            onClick={salvar}
            disabled={!podeSalvar || salvando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Registrar consignação
          </button>
        </div>
      </div>
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
}: {
  consignacao: Consignacao;
  ehAdmin: boolean;
  onClose: () => void;
  onAtualizada: (c: Consignacao) => void;
  onExcluida: () => void;
  onImprimir: (c: Consignacao) => void;
}) {
  const aberta = consignacao.status === "ABERTA";
  const [vendidas, setVendidas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    </div>
  );
}
