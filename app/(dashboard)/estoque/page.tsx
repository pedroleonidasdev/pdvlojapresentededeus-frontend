"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Produto, Categoria } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, AlertTriangle, X, Loader2, Search } from "lucide-react";

export default function EstoquePage() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === "ADMIN";

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Produto | null>(null);
  const [busca, setBusca] = useState("");

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

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((produto) => {
      const nome = produto.nome?.toLowerCase() ?? "";
      const codigo = produto.codigoBarras?.toLowerCase() ?? "";
      const categoria = produto.categoria?.nome?.toLowerCase() ?? "";
      return nome.includes(termo) || codigo.includes(termo) || categoria.includes(termo);
    });
  }, [produtos, busca]);

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle={`${produtos.length} produtos cadastrados`}
        action={
          isAdmin && (
            <button
              onClick={() => {
                setProdutoEmEdicao(null);
                setModalAberto(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Novo produto
            </button>
          )
        }
      />

      <div className="p-8">
        <div className="mb-4 relative max-w-sm">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou categoria..."
            className="input pl-3 pr-9 w-full"
          />
          {busca ? (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <Search className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>

        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr className="text-left text-muted">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 font-medium">Preço</th>
                  <th className="px-5 py-3 font-medium">Estoque</th>
                  {isAdmin && <th className="px-5 py-3 font-medium text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((produto) => {
                  const estoqueBaixo =
                    produto.estoqueMinimo != null && produto.quantidadeEstoque <= produto.estoqueMinimo;
                  return (
                    <tr key={produto.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground">{produto.nome}</p>
                        {produto.codigoBarras && (
                          <p className="text-xs text-muted font-mono">{produto.codigoBarras}</p>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted">{produto.categoria?.nome ?? "—"}</td>
                      <td className="px-5 py-3 font-mono">{formatarMoeda(produto.precoVenda)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 font-mono ${estoqueBaixo ? "text-danger" : "text-foreground"
                            }`}
                        >
                          {estoqueBaixo && <AlertTriangle className="w-3.5 h-3.5" />}
                          {produto.quantidadeEstoque}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setProdutoEmEdicao(produto);
                                setModalAberto(true);
                              }}
                              className="p-1.5 rounded-md text-muted hover:bg-background hover:text-primary transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => excluirProduto(produto.id)}
                              className="p-1.5 rounded-md text-muted hover:bg-background hover:text-danger transition"
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
            {produtosFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted py-10">
                {busca ? "Nenhum produto encontrado para essa busca." : "Nenhum produto cadastrado."}
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
          onSaved={() => {
            setModalAberto(false);
            carregar();
          }}
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
  onSaved: () => void;
}) {
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
      } else {
        await api.post("/produtos", payload);
      }
      onSaved();
    } catch {
      setErro("Não foi possível salvar o produto.");
    } finally {
      setSalvando(false);
    }
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}