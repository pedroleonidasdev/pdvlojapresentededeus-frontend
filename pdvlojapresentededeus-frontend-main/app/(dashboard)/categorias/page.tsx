"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Categoria } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<Categoria | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErroLista(null);
    try {
      const { data } = await api.get<Categoria[]>("/categorias");
      setCategorias(data);
    } catch {
      setErroLista("Não foi possível carregar as categorias.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function excluir(id: number) {
    if (!confirm("Deseja realmente excluir esta categoria?")) return;
    try {
      await api.delete(`/categorias/${id}`);
      carregar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível excluir esta categoria.";
      alert(msg);
    }
  }

  return (
    <div>
      <PageHeader
        title="Categorias"
        subtitle={`${categorias.length} categorias cadastradas`}
        action={
          <button
            onClick={() => {
              setCategoriaEmEdicao(null);
              setModalAberto(true);
            }}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus className="w-4 h-4" /> Nova categoria
          </button>
        }
      />

      <div className="p-8">
        {carregando ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : erroLista ? (
          <p className="text-center text-sm text-danger py-10">{erroLista}</p>
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-border">
                <tr className="text-left text-muted">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map((categoria) => (
                  <tr key={categoria.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium text-foreground">{categoria.nome}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setCategoriaEmEdicao(categoria);
                            setModalAberto(true);
                          }}
                          className="p-1.5 rounded-md text-muted hover:bg-background hover:text-primary transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => excluir(categoria.id)}
                          className="p-1.5 rounded-md text-muted hover:bg-background hover:text-danger transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categorias.length === 0 && (
              <p className="text-center text-sm text-muted py-10">Nenhuma categoria cadastrada.</p>
            )}
          </div>
        )}
      </div>

      {modalAberto && (
        <ModalCategoria
          categoria={categoriaEmEdicao}
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

function ModalCategoria({
  categoria,
  onClose,
  onSaved,
}: {
  categoria: Categoria | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(categoria?.nome ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      if (categoria) {
        await api.put(`/categorias/${categoria.id}`, { nome: nome.trim() });
      } else {
        await api.post("/categorias", { nome: nome.trim() });
      }
      onSaved();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível salvar a categoria.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">{categoria ? "Editar categoria" : "Nova categoria"}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              className="input"
            />
          </label>

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
            disabled={salvando || !nome.trim()}
            title={!nome.trim() ? "Informe um nome" : undefined}
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
