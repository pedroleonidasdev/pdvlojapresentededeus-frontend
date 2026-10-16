"use client";

import { useEffect, useState } from "react";
import api, { iniciarTrocaDeToken } from "@/lib/api";
import { UsuarioAdmin, Perfil } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, X, Loader2, LogOut } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioAdmin | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  async function carregar(silencioso = false) {
    if (!silencioso) setCarregando(true);
    try {
      const { data } = await api.get<UsuarioAdmin[]>("/usuarios");
      setUsuarios(data);
    } catch {
      // atualização automática: mantém a lista atual se falhar
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // atualiza o status online/offline sem piscar a tela
    const intervalo = setInterval(() => carregar(true), 15_000);
    return () => clearInterval(intervalo);
  }, []);

  const totalOnline = usuarios.filter((u) => u.online).length;

  async function excluir(u: UsuarioAdmin) {
    if (
      !confirm(
        `Excluir definitivamente o usuário ${u.nome} (${u.login})?\n\nEssa ação não pode ser desfeita. ` +
          `Usuários que já têm vendas, caixas ou outros registros não podem ser excluídos; nesse caso, desative-os em Editar.`
      )
    )
      return;

    setMensagem(null);
    try {
      await api.delete(`/usuarios/${u.id}`);
      setMensagem({ tipo: "ok", texto: `Usuário ${u.nome} excluído.` });
      carregar(true);
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto:
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Não foi possível excluir o usuário.",
      });
    }
  }

  // Se a conta derrubada for a de quem clicou, o backend devolve um token novo
  // e a sessão atual continua valendo; as demais (outros PCs) caem.
  async function encerrarSessoes(u: UsuarioAdmin | null) {
    const pergunta = u
      ? `Encerrar todas as sessões de ${u.nome} (${u.login})? Quem estiver logado com essa conta voltará para a tela de login em até ~15 segundos.`
      : "Encerrar as sessões de TODOS os usuários? Todos voltarão para a tela de login (menos você, neste aparelho).";
    if (!confirm(pergunta)) return;

    setMensagem(null);
    const concluirTroca = iniciarTrocaDeToken();
    try {
      const { data } = await api.post<{ novoToken: string | null }>(
        u ? `/usuarios/${u.id}/encerrar-sessoes` : "/usuarios/encerrar-sessoes"
      );
      if (data.novoToken) localStorage.setItem("pdv_token", data.novoToken);
      carregar(true);
      setMensagem({
        tipo: "ok",
        texto: u ? `Sessões de ${u.nome} encerradas.` : "Sessões de todos os usuários encerradas.",
      });
    } catch {
      setMensagem({ tipo: "erro", texto: "Não foi possível encerrar as sessões." });
    } finally {
      concluirTroca();
    }
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle={`Gerencie quem tem acesso ao sistema · ${totalOnline} online agora`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => encerrarSessoes(null)}
              className="flex items-center gap-2 border border-border hover:bg-background text-foreground text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" /> Encerrar todas as sessões
            </button>
            <button
              onClick={() => {
                setUsuarioEmEdicao(null);
                setModalAberto(true);
              }}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" /> Novo usuário
            </button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        {mensagem && (
          <div
            className={`mb-4 rounded-lg text-sm px-3 py-2 ${
              mensagem.tipo === "ok" ? "bg-primary-light text-primary-dark" : "bg-danger-light text-danger"
            }`}
          >
            {mensagem.texto}
          </div>
        )}
        {carregando ? (
          <CarregandoSecao />
        ) : (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-background border-b border-border">
                <tr className="text-left text-muted">
                  <th className="px-5 py-3 font-medium">Nome</th>
                  <th className="px-5 py-3 font-medium">Login</th>
                  <th className="px-5 py-3 font-medium">Perfil</th>
                  <th className="px-5 py-3 font-medium">Conexão</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-medium text-foreground">{u.nome}</td>
                    <td className="px-5 py-3 font-mono text-muted">{u.login}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono uppercase tracking-wide text-muted">
                        {u.perfil === "ADMIN" ? "Administrador" : "Operador de caixa"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusConexao usuario={u} />
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          u.ativo ? "bg-primary-light text-primary-dark" : "bg-danger-light text-danger"
                        }`}
                      >
                        {u.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => encerrarSessoes(u)}
                          title="Encerrar sessões deste usuário"
                          className="p-1.5 rounded-md text-muted hover:bg-background hover:text-primary transition"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setUsuarioEmEdicao(u);
                            setModalAberto(true);
                          }}
                          className="p-1.5 rounded-md text-muted hover:bg-background hover:text-primary transition"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => excluir(u)}
                          title="Excluir usuário"
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
            </div>
            {usuarios.length === 0 && (
              <p className="text-center text-sm text-muted py-10">Nenhum usuário cadastrado.</p>
            )}
          </div>
        )}
      </div>

      {modalAberto && (
        <ModalUsuario
          usuario={usuarioEmEdicao}
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

function tempoDesde(seg: number) {
  if (seg < 60) return "agora há pouco";
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function StatusConexao({ usuario }: { usuario: UsuarioAdmin }) {
  if (usuario.online) {
    return (
      <span className="inline-flex items-center gap-2 text-xs font-medium text-primary-dark">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-green-500" />
        </span>
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
      Offline
      {typeof usuario.ultimoAcessoHaSeg === "number" && Number.isFinite(usuario.ultimoAcessoHaSeg) && (
        <span className="text-[11px]">· visto {tempoDesde(usuario.ultimoAcessoHaSeg)}</span>
      )}
    </span>
  );
}

function ModalUsuario({
  usuario,
  onClose,
  onSaved,
}: {
  usuario: UsuarioAdmin | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [login, setLogin] = useState(usuario?.login ?? "");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "CAIXA");
  const [ativo, setAtivo] = useState(usuario?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const payload = { login, senha: senha || undefined, nome, perfil, ativo };
      if (usuario) {
        await api.put(`/usuarios/${usuario.id}`, payload);
      } else {
        await api.post("/usuarios", payload);
      }
      onSaved();
    } catch {
      setErro("Não foi possível salvar o usuário.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold">{usuario ? "Editar usuário" : "Novo usuário"}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="input" />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Login</span>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={!!usuario}
              className="input disabled:opacity-60"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">
              {usuario ? "Nova senha (deixe em branco para manter)" : "Senha"}
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="input"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted mb-1.5">Perfil</span>
            <select
              value={perfil}
              onChange={(e) => setPerfil(e.target.value as Perfil)}
              className="input"
            >
              <option value="CAIXA">Operador de caixa</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>

          {usuario && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="rounded border-border"
              />
              Usuário ativo
            </label>
          )}

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
            disabled={salvando || !nome || !login || (!usuario && !senha)}
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
