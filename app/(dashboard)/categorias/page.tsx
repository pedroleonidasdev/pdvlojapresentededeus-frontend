"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { Categoria } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, Tags, Tag, Search, X, Boxes } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import {
  BOTAO_PRIMARIO,
  BOTAO_ICONE,
  BOTAO_ICONE_PERIGO,
  CARTAO,
  THEAD,
  TH,
  TR,
  CartaoIndicador,
  EstadoVazio,
  Inicial,
  ModalBase,
  BotaoSalvar,
  BotaoCancelar,
  Aviso,
} from "@/components/ui";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEmEdicao, setCategoriaEmEdicao] = useState<Categoria | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

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

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo ? categorias.filter((c) => c.nome.toLowerCase().includes(termo)) : categorias;
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [categorias, busca]);

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
            className={BOTAO_PRIMARIO}
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} /> Nova categoria
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {!carregando && !erroLista && (
          <section aria-label="Resumo das categorias" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CartaoIndicador
              icone={<Tags className="w-5 h-5" strokeWidth={1.75} />}
              titulo="Categorias"
              valor={String(categorias.length)}
              detalhe="Usadas para organizar o estoque"
            />
            <CartaoIndicador
              icone={<Boxes className="w-5 h-5" strokeWidth={1.75} />}
              titulo="Na lista agora"
              valor={String(visiveis.length)}
              detalhe={busca.trim() ? "Resultado da busca" : "Todas as categorias"}
              tom="info"
            />
          </section>
        )}

        {carregando ? (
          <CarregandoSecao />
        ) : erroLista ? (
          <Aviso tipo="erro">{erroLista}</Aviso>
        ) : (
          <>
            <div className="relative w-full sm:max-w-sm">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar categoria..."
                aria-label="Buscar categoria"
                className="input pl-10! pr-9! py-2.5!"
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

            <div className={CARTAO}>
              {visiveis.length === 0 ? (
                <EstadoVazio
                  icone={<Tags className="w-7 h-7" strokeWidth={1.6} />}
                  mensagem={busca.trim() ? "Nenhuma categoria encontrada para essa busca." : "Nenhuma categoria cadastrada."}
                />
              ) : (
                <table className="w-full text-sm">
                  <thead className={THEAD}>
                    <tr className="text-left">
                      <th className={`${TH} pl-5`}>Nome</th>
                      <th className={`${TH} pr-5 text-right`}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((categoria) => (
                      <tr key={categoria.id} className={TR}>
                        <td className="pl-5 pr-4 py-3">
                          <div className="flex items-center gap-3">
                            <Inicial nome={categoria.nome} />
                            <span className="font-semibold text-foreground">{categoria.nome}</span>
                          </div>
                        </td>
                        <td className="pl-4 pr-5 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setCategoriaEmEdicao(categoria);
                                setModalAberto(true);
                              }}
                              aria-label={`Editar ${categoria.nome}`}
                              title="Editar"
                              className={BOTAO_ICONE}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => excluir(categoria.id)}
                              aria-label={`Excluir ${categoria.nome}`}
                              title="Excluir"
                              className={BOTAO_ICONE_PERIGO}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {visiveis.length > 0 && (
                <p className="px-5 py-2.5 text-xs text-muted border-t border-border/50 bg-primary-soft/40">
                  Mostrando {visiveis.length} {visiveis.length === 1 ? "categoria" : "categorias"}
                </p>
              )}
            </div>
          </>
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
    <ModalBase
      titulo={categoria ? "Editar categoria" : "Nova categoria"}
      icone={<Tag className="w-5 h-5" />}
      onClose={onClose}
      rodape={
        <>
          <BotaoCancelar onClick={onClose} />
          <BotaoSalvar
            salvando={salvando}
            onClick={salvar}
            disabled={!nome.trim()}
            title={!nome.trim() ? "Informe um nome" : undefined}
          />
        </>
      }
    >
      <label className="block">
        <span className="block text-xs font-medium text-muted mb-1.5">Nome</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus className="input" />
      </label>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </ModalBase>
  );
}
