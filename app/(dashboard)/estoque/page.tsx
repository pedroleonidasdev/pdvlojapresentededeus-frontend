"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Produto, Categoria } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { situacaoEstoque, pesoSituacao } from "@/lib/estoque";
import { useAuth } from "@/lib/auth-context";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, AlertTriangle, X, Loader2, Search, CheckCircle2, ArrowUpDown, Barcode, Printer, ClipboardList, Copy, Tag, PackageX, Package, Layers, Wallet, FilterX, Boxes } from "lucide-react";
import FolhaEtiquetas from "@/components/FolhaEtiquetas";
import FolhaConferenciaEstoque from "@/components/FolhaConferenciaEstoque";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";

export default function EstoquePage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";
  // CAIXA pode cadastrar produto novo, mas não editar nem excluir — só ADMIN.
  const podeIncluirProduto = isAdmin || usuario?.perfil === "CAIXA";

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<"nome-asc" | "nome-desc" | "criticos" | "padrao">("nome-asc");
  const [filtroEspecial, setFiltroEspecial] = useState<"todos" | "em-falta" | "estoque-baixo" | "duplicados">("todos");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [folhaEtiquetasAberta, setFolhaEtiquetasAberta] = useState(false);
  const [folhaEstoqueAberta, setFolhaEstoqueAberta] = useState(false);
  const [gerandoCodigos, setGerandoCodigos] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  // troca de categoria em lote: "" = nada escolhido, "sem-categoria" = remover a categoria
  const [categoriaLote, setCategoriaLote] = useState<string>("");
  const [aplicandoCategoria, setAplicandoCategoria] = useState(false);

  async function carregar() {
    setCarregando(true);
    const [resProdutos, resCategorias] = await Promise.all([
      api.get<Produto[]>("/produtos"),
      api.get<Categoria[]>("/categorias"),
    ]);
    setProdutos(resProdutos.data);
    setCategorias(resCategorias.data);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function excluirProduto(id: number) {
    if (!confirm("Deseja realmente excluir este produto?")) return;
    await api.delete(`/produtos/${id}`);
    carregar();
  }

  async function gerarCodigosFaltantes() {
    setGerandoCodigos(true);
    try {
      const { data } = await api.post<{ produtosAtualizados: number }>("/produtos/gerar-codigos-em-lote");
      await carregar();
      setMensagem(
        data.produtosAtualizados > 0
          ? `${data.produtosAtualizados} produto(s) receberam código de barras novo.`
          : "Todos os produtos já tinham código de barras."
      );
      setTimeout(() => setMensagem(null), 5000);
    } finally {
      setGerandoCodigos(false);
    }
  }

  async function aplicarCategoriaLote() {
    if (!categoriaLote || selecionados.size === 0) return;
    const semCategoria = categoriaLote === "sem-categoria";
    const nomeCategoria = semCategoria
      ? "Sem categoria"
      : categorias.find((c) => String(c.id) === categoriaLote)?.nome ?? "";
    if (!confirm(`Mudar a categoria de ${selecionados.size} produto(s) para "${nomeCategoria}"?`)) return;

    setAplicandoCategoria(true);
    try {
      const { data } = await api.post<{ produtosAtualizados: number }>("/produtos/categoria-em-lote", {
        produtoIds: Array.from(selecionados),
        categoriaId: semCategoria ? null : Number(categoriaLote),
      });
      await carregar();
      setSelecionados(new Set());
      setCategoriaLote("");
      setMensagem(`${data.produtosAtualizados} produto(s) agora estão na categoria "${nomeCategoria}".`);
      setTimeout(() => setMensagem(null), 5000);
    } catch {
      alert("Não foi possível alterar a categoria. Tente novamente.");
    } finally {
      setAplicandoCategoria(false);
    }
  }

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  // remove acento e normaliza espaços, pra pegar "Vela Aromática" e "vela  aromatica"
  // como o mesmo produto cadastrado duas vezes
  function nomeNormalizado(nome: string): string {
    return nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // detecta produtos duplicados olhando pra TODOS os produtos (não só os
  // filtrados na tela), pra não deixar passar um duplicado que caiu fora do
  // filtro atual de busca/categoria. Dois motivos contam como duplicado:
  // nome igual (ignorando acento/maiúscula) ou mesmo código de barras.
  const duplicados = useMemo(() => {
    const porNome = new Map<string, Produto[]>();
    const porCodigo = new Map<string, Produto[]>();

    for (const produto of produtos) {
      const chaveNome = nomeNormalizado(produto.nome ?? "");
      if (chaveNome) {
        if (!porNome.has(chaveNome)) porNome.set(chaveNome, []);
        porNome.get(chaveNome)!.push(produto);
      }
      if (produto.codigoBarras) {
        if (!porCodigo.has(produto.codigoBarras)) porCodigo.set(produto.codigoBarras, []);
        porCodigo.get(produto.codigoBarras)!.push(produto);
      }
    }

    const motivos = new Map<number, string[]>();
    function marcar(grupo: Produto[], motivo: string) {
      if (grupo.length < 2) return;
      for (const produto of grupo) {
        const atuais = motivos.get(produto.id) ?? [];
        motivos.set(produto.id, [...atuais, motivo]);
      }
    }
    for (const grupo of porNome.values()) marcar(grupo, "mesmo nome");
    for (const grupo of porCodigo.values()) marcar(grupo, "mesmo código de barras");

    return motivos;
  }, [produtos]);

  // alertas de estoque olham pra TODOS os produtos (não só os filtrados na tela),
  // pra o aviso não sumir quando alguém filtra por categoria ou busca algo
  const { emFalta, estoqueBaixo } = useMemo(() => {
    const faltando: Produto[] = [];
    const baixos: Produto[] = [];
    for (const produto of produtos) {
      const situacao = situacaoEstoque(produto);
      if (situacao === "em-falta") faltando.push(produto);
      else if (situacao === "baixo") baixos.push(produto);
    }
    return { emFalta: faltando, estoqueBaixo: baixos };
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let lista = !termo
      ? produtos
      : produtos.filter((produto) => {
          const nome = produto.nome?.toLowerCase() ?? "";
          const codigo = produto.codigoBarras?.toLowerCase() ?? "";
          const categoria = produto.categoria?.nome?.toLowerCase() ?? "";
          return nome.includes(termo) || codigo.includes(termo) || categoria.includes(termo);
        });

    if (categoriaFiltro === "sem-categoria") {
      lista = lista.filter((produto) => !produto.categoria);
    } else if (categoriaFiltro !== "todas") {
      lista = lista.filter((produto) => String(produto.categoria?.id) === categoriaFiltro);
    }

    if (filtroEspecial === "em-falta") {
      lista = lista.filter((produto) => situacaoEstoque(produto) === "em-falta");
    } else if (filtroEspecial === "estoque-baixo") {
      lista = lista.filter((produto) => situacaoEstoque(produto) === "baixo");
    } else if (filtroEspecial === "duplicados") {
      lista = lista.filter((produto) => duplicados.has(produto.id));
    }

    if (ordenacao === "padrao") return lista;

    if (ordenacao === "criticos") {
      // em falta primeiro, depois estoque baixo (os com menos unidades antes), depois o resto
      return [...lista].sort((a, b) => {
        const porSituacao = pesoSituacao(situacaoEstoque(a)) - pesoSituacao(situacaoEstoque(b));
        if (porSituacao !== 0) return porSituacao;
        const porQuantidade = a.quantidadeEstoque - b.quantidadeEstoque;
        if (porQuantidade !== 0) return porQuantidade;
        return (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { sensitivity: "base" });
      });
    }

    const ordenada = [...lista].sort((a, b) =>
      (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { sensitivity: "base" })
    );
    return ordenacao === "nome-desc" ? ordenada.reverse() : ordenada;
  }, [produtos, busca, categoriaFiltro, ordenacao, filtroEspecial, duplicados]);

  // produtos marcados que não aparecem na lista com o filtro atual (a seleção é mantida ao trocar de filtro)
  const selecionadosForaDoFiltro = useMemo(() => {
    const visiveis = new Set(produtosFiltrados.map((p) => p.id));
    return Array.from(selecionados).filter((id) => !visiveis.has(id)).length;
  }, [selecionados, produtosFiltrados]);

  const semCodigoCount = useMemo(
    () => produtos.filter((p) => !p.codigoBarras).length,
    [produtos]
  );

  // números do topo: consideram todos os produtos ativos (não só os filtrados na tela)
  const resumo = useMemo(() => {
    let unidades = 0;
    let valorVenda = 0;
    let valorCusto = 0;
    for (const produto of produtos) {
      if (produto.ativo === false) continue;
      const quantidade = Math.max(0, produto.quantidadeEstoque);
      unidades += quantidade;
      valorVenda += quantidade * produto.precoVenda;
      if (produto.precoCusto != null) valorCusto += quantidade * produto.precoCusto;
    }
    return { unidades, valorVenda, valorCusto };
  }, [produtos]);

  const temFiltro = busca.trim() !== "" || categoriaFiltro !== "todas" || filtroEspecial !== "todos";

  function limparFiltros() {
    setBusca("");
    setCategoriaFiltro("todas");
    setFiltroEspecial("todos");
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle={
          produtosFiltrados.length !== produtos.length
            ? `${produtosFiltrados.length} de ${produtos.length} produtos`
            : `${produtos.length} produtos cadastrados`
        }
        action={
          podeIncluirProduto && (
            <button
              onClick={() => {
                setProdutoEmEdicao(null);
                setModalAberto(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary/30 ring-1 ring-white/10 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition"
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} /> Novo produto
            </button>
          )
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {/* ---------- Indicadores ---------- */}
        {!carregando && (
          <section aria-label="Resumo do estoque" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CartaoIndicador
              icone={<Package className="w-5 h-5" strokeWidth={1.75} />}
              titulo="Produtos"
              valor={String(produtos.length)}
              detalhe={`${categorias.length} ${categorias.length === 1 ? "categoria" : "categorias"}`}
            />
            <CartaoIndicador
              icone={<Layers className="w-5 h-5" strokeWidth={1.75} />}
              titulo="Unidades em estoque"
              valor={resumo.unidades.toLocaleString("pt-BR")}
              detalhe="Soma de todos os produtos ativos"
              tom="info"
            />
            <CartaoIndicador
              icone={<Wallet className="w-5 h-5" strokeWidth={1.75} />}
              titulo="Valor em estoque"
              valor={formatarMoeda(resumo.valorVenda)}
              detalhe={
                isAdmin && resumo.valorCusto > 0
                  ? `A preço de venda · custo ${formatarMoeda(resumo.valorCusto)}`
                  : "A preço de venda"
              }
              tom="alerta"
            />
          </section>
        )}

        {/* ---------- Busca, filtros e ferramentas ---------- */}
        <section
          aria-label="Filtros"
          className="rounded-2xl bg-surface/95 border border-border/70 ring-1 ring-white/60 shadow-[0_10px_30px_-18px_rgba(15,51,42,0.35)] p-3 sm:p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-sm sm:flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, código ou categoria..."
                className="input pl-10! pr-9! py-2.5! w-full"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted hover:text-foreground hover:bg-background transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              aria-label="Filtrar por categoria"
              className="input py-2.5! w-auto!"
            >
              <option value="todas">Todas as categorias</option>
              <option value="sem-categoria">Sem categoria</option>
              {[...categorias]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
                .map((categoria) => (
                  <option key={categoria.id} value={String(categoria.id)}>
                    {categoria.nome}
                  </option>
                ))}
            </select>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted shrink-0" />
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as typeof ordenacao)}
                aria-label="Ordenar por"
                className="input py-2.5! w-auto!"
              >
                <option value="nome-asc">Nome (A-Z)</option>
                <option value="nome-desc">Nome (Z-A)</option>
                <option value="criticos">Mais críticos primeiro</option>
                <option value="padrao">Ordem de cadastro</option>
              </select>
            </div>

            {temFiltro && (
              <button
                onClick={limparFiltros}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-background transition"
              >
                <FilterX className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>

          {/* atalhos de filtro, com a contagem de cada um */}
          {!carregando && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Situação do estoque">
              <ChipFiltro ativo={filtroEspecial === "todos"} onClick={() => setFiltroEspecial("todos")} contagem={produtos.length}>
                Todos
              </ChipFiltro>
              {emFalta.length > 0 && (
                <ChipFiltro
                  tom="perigo"
                  ativo={filtroEspecial === "em-falta"}
                  onClick={() => setFiltroEspecial((atual) => (atual === "em-falta" ? "todos" : "em-falta"))}
                  contagem={emFalta.length}
                  icone={<PackageX className="w-3.5 h-3.5" />}
                >
                  Em falta
                </ChipFiltro>
              )}
              {estoqueBaixo.length > 0 && (
                <ChipFiltro
                  tom="alerta"
                  ativo={filtroEspecial === "estoque-baixo"}
                  onClick={() => setFiltroEspecial((atual) => (atual === "estoque-baixo" ? "todos" : "estoque-baixo"))}
                  contagem={estoqueBaixo.length}
                  icone={<AlertTriangle className="w-3.5 h-3.5" />}
                >
                  Estoque baixo
                </ChipFiltro>
              )}
              {duplicados.size > 0 && (
                <ChipFiltro
                  tom="alerta"
                  ativo={filtroEspecial === "duplicados"}
                  onClick={() => setFiltroEspecial((atual) => (atual === "duplicados" ? "todos" : "duplicados"))}
                  contagem={duplicados.size}
                  icone={<Copy className="w-3.5 h-3.5" />}
                  dica="Produtos com o mesmo nome (ignorando acento/maiúscula) ou o mesmo código de barras cadastrados mais de uma vez"
                >
                  Possíveis duplicados
                </ChipFiltro>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            {isAdmin && semCodigoCount > 0 && (
              <button onClick={gerarCodigosFaltantes} disabled={gerandoCodigos} className={BOTAO_FERRAMENTA}>
                {gerandoCodigos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                Gerar códigos faltantes ({semCodigoCount})
              </button>
            )}
            {selecionados.size > 0 && (
              <button onClick={() => setFolhaEtiquetasAberta(true)} className={BOTAO_FERRAMENTA}>
                <Printer className="w-4 h-4" />
                Imprimir etiquetas ({selecionados.size})
              </button>
            )}
            <button
              onClick={() => setFolhaEstoqueAberta(true)}
              disabled={produtosFiltrados.length === 0}
              title="Gera uma folha para imprimir e conferir o estoque físico contra o sistema"
              className={BOTAO_FERRAMENTA}
            >
              <ClipboardList className="w-4 h-4" />
              Imprimir estoque para conferência
              {produtosFiltrados.length !== produtos.length && ` (${produtosFiltrados.length})`}
            </button>
          </div>
        </section>

        {mensagem && (
          <div
            role="status"
            className="rounded-xl border border-success/25 bg-success-light text-success text-sm font-medium px-4 py-3 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {mensagem}
          </div>
        )}

        {isAdmin && selecionados.size > 0 && (
          <div className="rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
            <span className="text-sm font-semibold text-primary-dark">
              {selecionados.size} produto(s) selecionado(s)
              {selecionadosForaDoFiltro > 0 && (
                <span className="text-muted font-normal"> ({selecionadosForaDoFiltro} fora do filtro atual)</span>
              )}
            </span>
            <select
              value={categoriaLote}
              onChange={(e) => setCategoriaLote(e.target.value)}
              className="input py-2! w-auto!"
            >
              <option value="">Escolher a nova categoria...</option>
              <option value="sem-categoria">Sem categoria</option>
              {[...categorias]
                .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
                .map((categoria) => (
                  <option key={categoria.id} value={String(categoria.id)}>
                    {categoria.nome}
                  </option>
                ))}
            </select>
            <button
              onClick={aplicarCategoriaLote}
              disabled={!categoriaLote || aplicandoCategoria}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-md shadow-primary/25 hover:brightness-110 transition disabled:opacity-50"
            >
              {aplicandoCategoria ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              Aplicar categoria aos selecionados
            </button>
            <button
              onClick={() => setSelecionados(new Set())}
              className="text-sm text-muted hover:text-foreground px-2 py-2 transition"
            >
              Limpar seleção
            </button>
          </div>
        )}

        {carregando ? (
          <CarregandoSecao />
        ) : (
          <div className="bg-surface border border-border/70 rounded-2xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(15,51,42,0.35)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-primary-soft border-b border-border/70">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="pl-5 pr-2 py-3 font-semibold w-8">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os produtos da lista"
                        checked={
                          produtosFiltrados.length > 0 &&
                          produtosFiltrados.every((p) => selecionados.has(p.id))
                        }
                        onChange={(e) => {
                          setSelecionados((atual) => {
                            const novo = new Set(atual);
                            if (e.target.checked) {
                              produtosFiltrados.forEach((p) => novo.add(p.id));
                            } else {
                              produtosFiltrados.forEach((p) => novo.delete(p.id));
                            }
                            return novo;
                          });
                        }}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold text-right">Preço</th>
                    <th className="px-4 py-3 font-semibold">Estoque</th>
                    {isAdmin && <th className="px-5 py-3 font-semibold text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map((produto) => {
                    const situacao = situacaoEstoque(produto);
                    const marcado = selecionados.has(produto.id);
                    return (
                      <tr
                        key={produto.id}
                        className={`border-b border-border/50 last:border-0 transition-colors ${
                          marcado
                            ? "bg-primary-soft"
                            : situacao === "em-falta"
                              ? "bg-danger-light/50 hover:bg-danger-light"
                              : situacao === "baixo"
                                ? "bg-accent-light/40 hover:bg-accent-light/70"
                                : "hover:bg-primary-soft/50"
                        }`}
                      >
                        <td className="pl-5 pr-2 py-3">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${produto.nome}`}
                            checked={marcado}
                            onChange={() => alternarSelecao(produto.id)}
                            className="w-4 h-4 rounded border-border accent-primary"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              aria-hidden
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset ${
                                situacao === "em-falta"
                                  ? "bg-danger-light text-danger ring-danger/20"
                                  : situacao === "baixo"
                                    ? "bg-accent-light text-accent-dark ring-accent/30"
                                    : "bg-primary-light text-primary ring-primary/15"
                              }`}
                            >
                              {(produto.nome ?? "?").trim().charAt(0).toUpperCase() || "?"}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="font-semibold text-foreground leading-tight">{produto.nome}</p>
                                {duplicados.has(produto.id) && (
                                  <span
                                    title={`Possível duplicado: ${[...new Set(duplicados.get(produto.id))].join(" e ")}`}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent-light text-accent-dark shrink-0"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                    Duplicado
                                  </span>
                                )}
                              </div>
                              {produto.codigoBarras && (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted font-mono">
                                  <Barcode className="w-3 h-3 shrink-0" />
                                  {produto.codigoBarras}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {produto.categoria?.nome ? (
                            <span className="inline-flex rounded-full bg-primary-light/70 px-2.5 py-0.5 text-xs font-medium text-primary-dark">
                              {produto.categoria.nome}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-mono font-semibold tabular-nums">{formatarMoeda(produto.precoVenda)}</p>
                          {isAdmin && produto.precoCusto != null && (
                            <p className="text-[11px] text-muted font-mono tabular-nums">custo {formatarMoeda(produto.precoCusto)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex min-w-10 justify-center rounded-lg px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
                                situacao === "em-falta"
                                  ? "bg-danger-light text-danger"
                                  : situacao === "baixo"
                                    ? "bg-accent-light text-accent-dark"
                                    : "bg-success-light text-success"
                              }`}
                            >
                              {produto.quantidadeEstoque}
                            </span>
                            {situacao === "em-falta" && (
                              <span
                                title="Produto sem estoque — precisa ser reposto"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger text-white"
                              >
                                <PackageX className="w-3 h-3" />
                                Em falta
                              </span>
                            )}
                            {situacao === "baixo" && (
                              <span
                                title={`Abaixo do mínimo (${produto.estoqueMinimo})`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent text-white"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Estoque baixo
                              </span>
                            )}
                          </div>
                          {produto.estoqueMinimo != null && (
                            <p className="text-[11px] text-muted mt-1">mínimo: {produto.estoqueMinimo}</p>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => {
                                  setProdutoEmEdicao(produto);
                                  setModalAberto(true);
                                }}
                                aria-label={`Editar ${produto.nome}`}
                                title="Editar"
                                className="p-2 rounded-lg text-muted hover:bg-primary-light hover:text-primary transition"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => excluirProduto(produto.id)}
                                aria-label={`Excluir ${produto.nome}`}
                                title="Excluir"
                                className="p-2 rounded-lg text-muted hover:bg-danger-light hover:text-danger transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                  <Boxes className="w-7 h-7" strokeWidth={1.6} />
                </span>
                <p className="text-sm text-muted">
                  {busca
                    ? "Nenhum produto encontrado para essa busca."
                    : temFiltro
                      ? "Nenhum produto neste filtro."
                      : "Nenhum produto cadastrado."}
                </p>
                {temFiltro && (
                  <button
                    onClick={limparFiltros}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:bg-background transition"
                  >
                    <FilterX className="w-4 h-4" />
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <p className="px-5 py-2.5 text-xs text-muted border-t border-border/50 bg-primary-soft/40">
                Mostrando {produtosFiltrados.length} {produtosFiltrados.length === 1 ? "produto" : "produtos"}
              </p>
            )}
          </div>
        )}
      </div>

      {modalAberto && (
        <ModalProduto
          produto={produtoEmEdicao}
          categorias={categorias}
          onClose={() => setModalAberto(false)}
          onSaved={(manterAberto) => {
            if (!manterAberto) setModalAberto(false);
            carregar();
          }}
        />
      )}

      {folhaEtiquetasAberta && (
        <FolhaEtiquetas
          produtos={produtos.filter((p) => selecionados.has(p.id))}
          onFechar={() => setFolhaEtiquetasAberta(false)}
        />
      )}

      {folhaEstoqueAberta && (
        <FolhaConferenciaEstoque
          produtos={produtosFiltrados}
          onFechar={() => setFolhaEstoqueAberta(false)}
        />
      )}
    </div>
  );
}

function ModalProduto({
  produto,
  categorias,
  onClose,
  onSaved,
}: {
  produto: Produto | null;
  categorias: Categoria[];
  onClose: () => void;
  onSaved: (manterAberto?: boolean) => void;
}) {
  const vazio = {
    nome: "",
    codigoBarras: "",
    categoriaId: "",
    precoVenda: "",
    precoCusto: "",
    quantidadeEstoque: "0",
    estoqueMinimo: "",
  };

  const [nome, setNome] = useState(produto?.nome ?? "");
  const [codigoBarras, setCodigoBarras] = useState(produto?.codigoBarras ?? "");
  const [categoriaId, setCategoriaId] = useState<string>(
    produto?.categoria?.id.toString() ?? ""
  );
  const [precoVenda, setPrecoVenda] = useState(produto?.precoVenda?.toString() ?? "");
  const [precoCusto, setPrecoCusto] = useState(produto?.precoCusto?.toString() ?? "");
  const [quantidadeEstoque, setQuantidadeEstoque] = useState(
    produto?.quantidadeEstoque?.toString() ?? "0"
  );
  const [estoqueMinimo, setEstoqueMinimo] = useState(produto?.estoqueMinimo?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [produtoSalvoComSucesso, setProdutoSalvoComSucesso] = useState(false);

  function limparFormulario() {
    setNome(vazio.nome);
    setCodigoBarras(vazio.codigoBarras);
    setCategoriaId(vazio.categoriaId);
    setPrecoVenda(vazio.precoVenda);
    setPrecoCusto(vazio.precoCusto);
    setQuantidadeEstoque(vazio.quantidadeEstoque);
    setEstoqueMinimo(vazio.estoqueMinimo);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const payload = {
      nome,
      codigoBarras: codigoBarras || null,
      categoriaId: categoriaId ? Number(categoriaId) : null,
      precoVenda: Number(precoVenda),
      precoCusto: precoCusto ? Number(precoCusto) : null,
      quantidadeEstoque: Number(quantidadeEstoque),
      estoqueMinimo: estoqueMinimo ? Number(estoqueMinimo) : null,
    };
    try {
      if (produto) {
        await api.put(`/produtos/${produto.id}`, payload);
        onSaved();
      } else {
        await api.post("/produtos", payload);
        setProdutoSalvoComSucesso(true);
      }
    } catch {
      setErro("Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
  }

  function adicionarOutro() {
    limparFormulario();
    setProdutoSalvoComSucesso(false);
    onSaved(true);
  }

  function concluir() {
    onSaved(false);
  }

  if (produtoSalvoComSucesso) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden">
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Produto adicionado ao estoque!</p>
              <p className="text-sm text-muted mt-1">Deseja adicionar outro produto?</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={concluir}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm text-muted border border-border hover:bg-background transition"
              >
                Não, concluir
              </button>
              <button
                onClick={adicionarOutro}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition"
              >
                Sim, adicionar outro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">{produto ? "Editar produto" : "Novo produto"}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="input"
            />
          </Campo>

          <Campo label="Código de barras (opcional)">
            <input
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              placeholder="Deixe em branco para gerar automaticamente"
              className="input"
            />
          </Campo>

          <Campo label="Categoria">
            <select
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="input"
            >
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Preço de venda">
              <input
                type="number"
                step="0.01"
                value={precoVenda}
                onChange={(e) => setPrecoVenda(e.target.value)}
                className="input"
              />
            </Campo>
            <Campo label="Preço de custo">
              <input
                type="number"
                step="0.01"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value)}
                className="input"
              />
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Quantidade em estoque">
              <input
                type="number"
                value={quantidadeEstoque}
                onChange={(e) => setQuantidadeEstoque(e.target.value)}
                className="input"
              />
            </Campo>
            <Campo label="Estoque mínimo (opcional)">
              <input
                type="number"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                className="input"
              />
            </Campo>
          </div>

          {(() => {
            const qtd = Number(quantidadeEstoque);
            const min = estoqueMinimo !== "" ? Number(estoqueMinimo) : null;
            if (quantidadeEstoque !== "" && qtd <= 0) {
              return (
                <div className="rounded-lg bg-danger-light text-danger text-xs px-3 py-2 flex items-center gap-2">
                  <PackageX className="w-4 h-4 shrink-0" />
                  Com quantidade zerada, o produto aparece como &quot;Em falta&quot;.
                </div>
              );
            }
            if (min != null && quantidadeEstoque !== "" && qtd <= min) {
              return (
                <div className="rounded-lg bg-accent-light text-accent-dark text-xs px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  A quantidade está no mínimo ou abaixo: o produto aparece como &quot;Estoque baixo&quot;.
                </div>
              );
            }
            if (min == null) {
              return (
                <p className="text-xs text-muted">
                  Dica: defina o estoque mínimo para ser avisado quando o produto estiver acabando.
                </p>
              );
            }
            return null;
          })()}

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-background transition"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || !nome || !precoVenda}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Botão discreto da faixa de ferramentas (etiquetas, conferência, códigos). */
const BOTAO_FERRAMENTA =
  "flex items-center gap-2 bg-surface border border-border hover:bg-primary-soft text-foreground text-sm font-medium px-3.5 py-2 rounded-xl transition disabled:opacity-50";

/** Cartão de indicador do topo da tela (mesmo estilo dos cartões da tela Início). */
function CartaoIndicador({
  icone,
  titulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  tom?: "neutro" | "info" | "alerta";
}) {
  const estilo = {
    neutro: { barra: "from-primary to-primary/30", icone: "from-primary to-primary-dark", brilho: "shadow-primary/40" },
    info: { barra: "from-info to-info/30", icone: "from-info to-info-dark", brilho: "shadow-info/40" },
    alerta: { barra: "from-accent to-accent/30", icone: "from-accent to-accent-dark", brilho: "shadow-accent/40" },
  }[tom];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface/95 border border-white/70 ring-1 ring-border/40 shadow-[0_10px_30px_-14px_rgba(15,51,42,0.45)] p-4 pt-5 flex items-center gap-3.5 min-w-0">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${estilo.barra}`} />
      <span
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${estilo.icone} text-white flex items-center justify-center shrink-0 shadow-lg ${estilo.brilho} ring-1 ring-white/30`}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{titulo}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground leading-tight truncate">{valor}</p>
        <p className="text-xs text-muted truncate">{detalhe}</p>
      </div>
    </div>
  );
}

/** Botão-chip de filtro rápido, com a contagem do grupo. */
function ChipFiltro({
  ativo,
  onClick,
  contagem,
  tom = "neutro",
  icone,
  dica,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  contagem: number;
  tom?: "neutro" | "perigo" | "alerta";
  icone?: React.ReactNode;
  dica?: string;
  children: React.ReactNode;
}) {
  const cores = {
    neutro: {
      ativo: "bg-primary text-white border-primary shadow-md shadow-primary/25",
      inativo: "bg-surface text-foreground border-border hover:bg-primary-soft",
      numero: "bg-primary-light text-primary-dark",
    },
    perigo: {
      ativo: "bg-danger text-white border-danger shadow-md shadow-danger/25",
      inativo: "bg-danger-light text-danger border-danger/30 hover:bg-danger/10",
      numero: "bg-danger/15 text-danger",
    },
    alerta: {
      ativo: "bg-accent text-white border-accent shadow-md shadow-accent/25",
      inativo: "bg-accent-light text-accent-dark border-accent/40 hover:bg-accent/15",
      numero: "bg-accent/20 text-accent-dark",
    },
  }[tom];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={dica}
      className={`inline-flex items-center gap-1.5 rounded-full border pl-3 pr-1.5 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        ativo ? cores.ativo : cores.inativo
      }`}
    >
      {icone}
      {children}
      <span
        className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
          ativo ? "bg-white/25 text-white" : cores.numero
        }`}
      >
        {contagem}
      </span>
    </button>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}