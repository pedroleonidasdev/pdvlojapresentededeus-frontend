"use client";

import { useEffect, useMemo, useState } from "react";
import api, { iniciarTrocaDeToken } from "@/lib/api";
import { atualizarToken } from "@/lib/sessao";
import { UsuarioAdmin, Perfil } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Plus, Pencil, Trash2, LogOut, Users, UserCheck, ShieldCheck, Search, X, UserRound } from "lucide-react";
import { CarregandoSecao } from "@/components/CarregamentoCatolico";
import {
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_ICONE,
  BOTAO_ICONE_PERIGO,
  CARTAO,
  THEAD,
  TH,
  TR,
  CartaoIndicador,
  ChipFiltro,
  EstadoVazio,
  Inicial,
  Selo,
  Aviso,
  ModalBase,
  BotaoSalvar,
  BotaoCancelar,
} from "@/components/ui";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<UsuarioAdmin | null>(null);
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "online" | "admin" | "inativos">("todos");

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
  const totalAdmins = usuarios.filter((u) => u.perfil === "ADMIN").length;
  const totalInativos = usuarios.filter((u) => !u.ativo).length;

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtro === "online" && !u.online) return false;
      if (filtro === "admin" && u.perfil !== "ADMIN") return false;
      if (filtro === "inativos" && u.ativo) return false;
      if (!termo) return true;
      return u.nome.toLowerCase().includes(termo) || u.login.toLowerCase().includes(termo);
    });
  }, [usuarios, busca, filtro]);

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
      if (data.novoToken) atualizarToken(data.novoToken);
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
              className={BOTAO_SECUNDARIO}
            >
              <LogOut className="w-4 h-4" /> Encerrar todas as sessões
            </button>
            <button
              onClick={() => {
                setUsuarioEmEdicao(null);
                setModalAberto(true);
              }}
              className={BOTAO_PRIMARIO}
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} /> Novo usuário
            </button>
          </div>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {mensagem && <Aviso tipo={mensagem.tipo}>{mensagem.texto}</Aviso>}

        {carregando ? (
          <CarregandoSecao />
        ) : (
          <>
            <section aria-label="Resumo dos usuários" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <CartaoIndicador
                icone={<Users className="w-5 h-5" strokeWidth={1.75} />}
                titulo="Usuários"
                valor={String(usuarios.length)}
                detalhe={totalInativos > 0 ? `${totalInativos} inativo(s)` : "Todos ativos"}
              />
              <CartaoIndicador
                icone={<UserCheck className="w-5 h-5" strokeWidth={1.75} />}
                titulo="Online agora"
                valor={String(totalOnline)}
                detalhe="Atualiza sozinho a cada 15 s"
                tom="info"
              />
              <CartaoIndicador
                icone={<ShieldCheck className="w-5 h-5" strokeWidth={1.75} />}
                titulo="Administradores"
                valor={String(totalAdmins)}
                detalhe="Podem editar estoque e usuários"
                tom="alerta"
              />
            </section>

            <section
              aria-label="Filtros"
              className="rounded-2xl bg-surface/95 border border-border/70 ring-1 ring-white/60 shadow-[0_10px_30px_-18px_rgba(15,51,42,0.35)] p-3 sm:p-4 flex flex-wrap items-center gap-3"
            >
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por nome ou login..."
                  aria-label="Buscar usuário"
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
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar usuários">
                <ChipFiltro ativo={filtro === "todos"} onClick={() => setFiltro("todos")} contagem={usuarios.length}>
                  Todos
                </ChipFiltro>
                <ChipFiltro ativo={filtro === "online"} onClick={() => setFiltro((f) => (f === "online" ? "todos" : "online"))} contagem={totalOnline}>
                  Online
                </ChipFiltro>
                <ChipFiltro ativo={filtro === "admin"} onClick={() => setFiltro((f) => (f === "admin" ? "todos" : "admin"))} contagem={totalAdmins}>
                  Administradores
                </ChipFiltro>
                {totalInativos > 0 && (
                  <ChipFiltro
                    tom="perigo"
                    ativo={filtro === "inativos"}
                    onClick={() => setFiltro((f) => (f === "inativos" ? "todos" : "inativos"))}
                    contagem={totalInativos}
                  >
                    Inativos
                  </ChipFiltro>
                )}
              </div>
            </section>

            <div className={CARTAO}>
              {visiveis.length === 0 ? (
                <EstadoVazio
                  icone={<UserRound className="w-7 h-7" strokeWidth={1.6} />}
                  mensagem={usuarios.length === 0 ? "Nenhum usuário cadastrado." : "Nenhum usuário neste filtro."}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className={THEAD}>
                      <tr className="text-left">
                        <th className={`${TH} pl-5`}>Nome</th>
                        <th className={TH}>Login</th>
                        <th className={TH}>Perfil</th>
                        <th className={TH}>Conexão</th>
                        <th className={TH}>Status</th>
                        <th className={`${TH} pr-5 text-right`}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((u) => (
                        <tr key={u.id} className={TR}>
                          <td className="pl-5 pr-4 py-3">
                            <div className="flex items-center gap-3">
                              <Inicial nome={u.nome} tom={u.perfil === "ADMIN" ? "alerta" : "neutro"} />
                              <span className="font-semibold text-foreground">{u.nome}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted">{u.login}</td>
                          <td className="px-4 py-3">
                            {u.perfil === "ADMIN" ? (
                              <Selo tom="alerta">
                                <ShieldCheck className="w-3 h-3" />
                                Administrador
                              </Selo>
                            ) : (
                              <Selo>Operador de caixa</Selo>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StatusConexao usuario={u} />
                          </td>
                          <td className="px-4 py-3">
                            <Selo tom={u.ativo ? "sucesso" : "perigo"}>{u.ativo ? "Ativo" : "Inativo"}</Selo>
                          </td>
                          <td className="pl-4 pr-5 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => encerrarSessoes(u)}
                                aria-label={`Encerrar sessões de ${u.nome}`}
                                title="Encerrar sessões deste usuário"
                                className={BOTAO_ICONE}
                              >
                                <LogOut className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setUsuarioEmEdicao(u);
                                  setModalAberto(true);
                                }}
                                aria-label={`Editar ${u.nome}`}
                                title="Editar"
                                className={BOTAO_ICONE}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => excluir(u)}
                                aria-label={`Excluir ${u.nome}`}
                                title="Excluir usuário"
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
                </div>
              )}
              {visiveis.length > 0 && (
                <p className="px-5 py-2.5 text-xs text-muted border-t border-border/50 bg-primary-soft/40">
                  Mostrando {visiveis.length} {visiveis.length === 1 ? "usuário" : "usuários"}
                </p>
              )}
            </div>
          </>
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
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-500" />
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
    <ModalBase
      titulo={usuario ? "Editar usuário" : "Novo usuário"}
      icone={<UserRound className="w-5 h-5" />}
      onClose={onClose}
      rodape={
        <>
          <BotaoCancelar onClick={onClose} />
          <BotaoSalvar salvando={salvando} onClick={salvar} disabled={!nome || !login || (!usuario && !senha)} />
        </>
      }
    >
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
        <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className="input" />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-muted mb-1.5">Perfil</span>
        <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)} className="input">
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
            className="w-4 h-4 rounded border-border accent-primary"
          />
          Usuário ativo
        </label>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </ModalBase>
  );
}
