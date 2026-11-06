"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Produto, Categoria } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { produtoCorrespondeBuscaPreco } from "@/lib/busca-produtos";
import { useAuth } from "@/lib/auth-context";
import PageHeader from "@/components/PageHeader";
import FolhaEtiquetas from "@/components/FolhaEtiquetas";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import { BOTAO_SECUNDARIO } from "@/components/ui";
import { Printer, Search, X, Barcode, FilterX, Loader2, Boxes, CheckCircle2 } from "lucide-react";

export default function EtiquetasPage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [gerandoCodigos, setGerandoCodigos] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    try {
      const [resProdutos, resCategorias] = await Promise.all([
        api.get<Produto[]>("/produtos"),
        api.get<Categoria[]>("/categorias"),
      ]);
      setProdutos(resProdutos.data);
      setCategorias(resCategorias.data);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function normalizar(texto: string): string {
    return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  const produtosFiltrados = useMemo(() => {
    const termo = normalizar(busca);
    return produtos
      .filter((p) => {
        if (categoriaFiltro === "sem-categoria" && p.categoria?.nome) return false;
        if (
          categoriaFiltro !== "todas" &&
          categoriaFiltro !== "sem-categoria" &&
          String(p.categoria?.id ?? "") !== categoriaFiltro
        )
          return false;
        if (!termo) return true;
        return (
          normalizar(p.nome ?? "").includes(termo) ||
          (p.codigoBarras ?? "").toLowerCase().includes(termo) ||
          normalizar(p.categoria?.nome ?? "").includes(termo) ||
          produtoCorrespondeBuscaPreco(p.precoVenda, busca)
        );
      })
      .sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { sensitivity: "base" }));
  }, [produtos, busca, categoriaFiltro]);

  const semCodigoCount = useMemo(() => produtos.filter((p) => !p.codigoBarras).length, [produtos]);
  const temFiltro = busca.trim() !== "" || categoriaFiltro !== "todas";

  function alternarSelecao(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
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

  return (
    <div>
      <PageHeader
        title="Imprimir Etiquetas"
        subtitle="Escolha os produtos e imprima as etiquetas com preço e código de barras"
        action={
          <button
            onClick={() => setFolhaAberta(true)}
            disabled={selecionados.size === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary/30 hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Imprimir etiquetas ({selecionados.size})
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
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
                placeholder="Buscar por nome, código, categoria ou preço (ex.: 10,50)..."
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
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nome}
                  </option>
                ))}
            </select>

            {temFiltro && (
              <button
                onClick={() => {
                  setBusca("");
                  setCategoriaFiltro("todas");
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground px-2.5 py-2 rounded-lg hover:bg-background transition"
              >
                <FilterX className="w-4 h-4" />
                Limpar filtros
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
            {isAdmin && semCodigoCount > 0 && (
              <button onClick={gerarCodigosFaltantes} disabled={gerandoCodigos} className={BOTAO_SECUNDARIO}>
                {gerandoCodigos ? <Loader2 className="w-4 h-4 animate-spin" /> : <Barcode className="w-4 h-4" />}
                Gerar códigos faltantes ({semCodigoCount})
              </button>
            )}
            {selecionados.size > 0 && (
              <button onClick={() => setSelecionados(new Set())} className={BOTAO_SECUNDARIO}>
                <X className="w-4 h-4" />
                Limpar seleção ({selecionados.size})
              </button>
            )}
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

        {carregando ? (
          <CarregandoSecao />
        ) : (
          <div className="bg-surface border border-border/70 rounded-2xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(15,51,42,0.35)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-primary-soft border-b border-border/70">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="pl-5 pr-2 py-3 font-semibold w-8">
                      <input
                        type="checkbox"
                        aria-label="Selecionar todos os produtos da lista"
                        checked={produtosFiltrados.length > 0 && produtosFiltrados.every((p) => selecionados.has(p.id))}
                        onChange={(e) =>
                          setSelecionados((atual) => {
                            const novo = new Set(atual);
                            produtosFiltrados.forEach((p) => (e.target.checked ? novo.add(p.id) : novo.delete(p.id)));
                            return novo;
                          })
                        }
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">Produto</th>
                    <th className="px-4 py-3 font-semibold">Categoria</th>
                    <th className="px-4 py-3 font-semibold">Código de barras</th>
                    <th className="px-5 py-3 font-semibold text-right">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map((produto) => {
                    const marcado = selecionados.has(produto.id);
                    return (
                      <tr
                        key={produto.id}
                        onClick={() => alternarSelecao(produto.id)}
                        className={`border-b border-border/50 last:border-0 cursor-pointer transition-colors ${
                          marcado ? "bg-primary-soft" : "hover:bg-primary-soft/50"
                        }`}
                      >
                        <td className="pl-5 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${produto.nome}`}
                            checked={marcado}
                            onChange={() => alternarSelecao(produto.id)}
                            className="w-4 h-4 rounded border-border accent-primary"
                          />
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{produto.nome}</td>
                        <td className="px-4 py-3">
                          {produto.categoria?.nome ? (
                            <span className="inline-flex rounded-full bg-primary-light/70 px-2.5 py-0.5 text-xs font-medium text-primary-dark">
                              {produto.categoria.nome}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {produto.codigoBarras ? (
                            <span className="font-mono text-xs text-muted">{produto.codigoBarras}</span>
                          ) : (
                            <span className="text-xs font-semibold text-accent-dark">sem código</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums">
                          {formatarMoeda(produto.precoVenda)}
                        </td>
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
                <p className="text-sm text-muted">Nenhum produto encontrado.</p>
              </div>
            ) : (
              <p className="px-5 py-2.5 text-xs text-muted border-t border-border/50 bg-primary-soft/40">
                Mostrando {produtosFiltrados.length} {produtosFiltrados.length === 1 ? "produto" : "produtos"}
              </p>
            )}
          </div>
        )}
      </div>

      {folhaAberta && (
        <FolhaEtiquetas
          produtos={produtos.filter((p) => selecionados.has(p.id))}
          onFechar={() => setFolhaAberta(false)}
        />
      )}
    </div>
  );
}
