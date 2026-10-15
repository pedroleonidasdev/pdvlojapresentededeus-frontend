"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Loader2, MessageCircle, Send, X } from "lucide-react";

interface Contato {
  id: number;
  nome: string;
  login: string;
  perfil: string;
  online: boolean;
  naoLidas: number;
}

interface Mensagem {
  id: number;
  remetenteId: number;
  destinatarioId: number;
  texto: string;
  criadaEm: string;
  lida: boolean;
}

const CONTATOS_FECHADO_MS = 10_000;
const CONTATOS_ABERTO_MS = 6_000;
const MENSAGENS_MS = 3_000;

function apitar() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    ganho.gain.value = 0.08;
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
  } catch {
    // navegador bloqueou o áudio antes de qualquer clique: sem problema, fica só o aviso visual
  }
}

function formatarHora(iso: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? hora
    : `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

export default function ChatSuporte() {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [conversaId, setConversaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const abertoRef = useRef(false);
  const conversaIdRef = useRef<number | null>(null);
  const ultimoIdRef = useRef<number | null>(null);
  const naoLidasAnterioresRef = useRef<Map<number, number> | null>(null);
  const buscandoContatosRef = useRef(false);
  const buscandoMensagensRef = useRef(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  useEffect(() => {
    conversaIdRef.current = conversaId;
  }, [conversaId]);

  const buscarContatos = useCallback(async () => {
    if (buscandoContatosRef.current) return;
    buscandoContatosRef.current = true;
    try {
      const { data } = await api.get<Contato[]>("/suporte/contatos");
      setContatos(data);

      // avisa (bip e notificação) quando chega mensagem de alguém cuja conversa não está na tela
      const anteriores = naoLidasAnterioresRef.current;
      naoLidasAnterioresRef.current = new Map(data.map((c) => [c.id, c.naoLidas]));
      if (anteriores === null) return; // primeira carga: só registra o ponto de partida

      const novos = data.filter((c) => {
        const naTela = abertoRef.current && conversaIdRef.current === c.id;
        return !naTela && c.naoLidas > (anteriores.get(c.id) ?? 0);
      });
      if (novos.length > 0) {
        apitar();
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification(`Mensagem de ${novos[0].nome}`, { body: "Abra o sistema para responder.", tag: "chat-suporte" });
        }
      }
    } catch {
      // sem rede ou servidor acordando: tenta de novo no próximo ciclo
    } finally {
      buscandoContatosRef.current = false;
    }
  }, []);

  const buscarMensagens = useCallback(async () => {
    const id = conversaIdRef.current;
    if (id === null || buscandoMensagensRef.current) return;
    buscandoMensagensRef.current = true;
    try {
      const params = ultimoIdRef.current !== null ? { depois: ultimoIdRef.current } : {};
      const { data } = await api.get<Mensagem[]>(`/suporte/conversas/${id}/mensagens`, { params });
      if (conversaIdRef.current !== id || data.length === 0) return; // trocou de conversa ou nada novo

      ultimoIdRef.current = data[data.length - 1].id;
      setMensagens((atuais) => {
        const conhecidas = new Set(atuais.map((m) => m.id));
        return [...atuais, ...data.filter((m) => !conhecidas.has(m.id))];
      });

      if (data.some((m) => m.remetenteId === id)) {
        await api.post(`/suporte/conversas/${id}/lidas`);
        void buscarContatos();
      }
    } catch {
      // tenta de novo no próximo ciclo
    } finally {
      buscandoMensagensRef.current = false;
    }
  }, [buscarContatos]);

  // contatos: alimenta a lista e o contador do botão
  useEffect(() => {
    if (!usuario) return;
    void buscarContatos();
    const intervalo = setInterval(() => void buscarContatos(), aberto ? CONTATOS_ABERTO_MS : CONTATOS_FECHADO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void buscarContatos();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [usuario, aberto, buscarContatos]);

  // mensagens: só enquanto uma conversa está aberta
  useEffect(() => {
    if (!usuario || !aberto || conversaId === null) return;
    void buscarMensagens();
    const intervalo = setInterval(() => void buscarMensagens(), MENSAGENS_MS);
    return () => clearInterval(intervalo);
  }, [usuario, aberto, conversaId, buscarMensagens]);

  useEffect(() => {
    if (aberto && conversaId !== null) fimRef.current?.scrollIntoView({ block: "end" });
  }, [aberto, conversaId, mensagens]);

  const totalNaoLidas = useMemo(() => contatos.reduce((soma, c) => soma + c.naoLidas, 0), [contatos]);
  const contatosOrdenados = useMemo(
    () =>
      [...contatos].sort(
        (a, b) =>
          Number(b.naoLidas > 0) - Number(a.naoLidas > 0) ||
          Number(b.online) - Number(a.online) ||
          a.nome.localeCompare(b.nome, "pt-BR")
      ),
    [contatos]
  );
  const contatoAtual = contatos.find((c) => c.id === conversaId) ?? null;

  function abrirChat() {
    setAberto(true);
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {});
    }
  }

  function abrirConversa(id: number) {
    ultimoIdRef.current = null;
    conversaIdRef.current = id;
    setMensagens([]);
    setErro(null);
    setTexto("");
    setConversaId(id);
  }

  function voltarParaLista() {
    ultimoIdRef.current = null;
    conversaIdRef.current = null;
    setConversaId(null);
    setMensagens([]);
    setErro(null);
    void buscarContatos();
  }

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo || enviando || conversaId === null) return;
    setEnviando(true);
    setErro(null);
    try {
      const { data } = await api.post<Mensagem>(`/suporte/conversas/${conversaId}/mensagens`, { texto: conteudo });
      setTexto("");
      ultimoIdRef.current = Math.max(ultimoIdRef.current ?? 0, data.id);
      setMensagens((atuais) => (atuais.some((m) => m.id === data.id) ? atuais : [...atuais, data]));
    } catch {
      setErro("Não foi possível enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;

  return (
    <>
      {!aberto && (
        <button
          onClick={abrirChat}
          aria-label="Abrir conversas"
          className={`fixed right-4 z-40 flex items-center gap-2 rounded-full bg-primary hover:bg-primary-dark text-white shadow-lg px-4 py-3 text-sm font-medium transition ${
            totalNaoLidas > 0 ? "animate-pulse" : ""
          }`}
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <MessageCircle className="w-5 h-5" />
          Conversas
          {totalNaoLidas > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-xs flex items-center justify-center">
              {totalNaoLidas > 9 ? "9+" : totalNaoLidas}
            </span>
          )}
        </button>
      )}

      {aberto && (
        <div
          className="fixed right-4 z-40 flex h-[min(32rem,calc(100dvh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="flex items-center justify-between gap-2 bg-primary px-3 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              {conversaId !== null && (
                <button
                  onClick={voltarParaLista}
                  aria-label="Voltar para a lista"
                  className="p-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0 pl-1">
                <p className="truncate text-sm font-semibold">
                  {conversaId === null ? "Conversas" : (contatoAtual?.nome ?? "Conversa")}
                </p>
                <p className="text-xs text-white/80">
                  {conversaId === null
                    ? "Privadas: só você e a outra pessoa veem"
                    : contatoAtual?.online
                      ? "Online agora"
                      : "Offline"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAberto(false)}
              aria-label="Fechar chat"
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {conversaId === null ? (
            <div className="flex-1 min-h-0 overflow-y-auto bg-background">
              {contatosOrdenados.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  Não há outro usuário ativo para conversar. Cadastre um em Usuários.
                </p>
              ) : (
                contatosOrdenados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirConversa(c.id)}
                    className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition hover:bg-surface"
                  >
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark">
                      {c.nome.charAt(0).toUpperCase()}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                          c.online ? "bg-success" : "bg-muted"
                        }`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.nome}</span>
                      <span className="block text-xs text-muted">
                        {c.perfil === "ADMIN" ? "Administrador" : "Caixa"} · {c.online ? "online" : "offline"}
                      </span>
                    </span>
                    {c.naoLidas > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-xs flex items-center justify-center">
                        {c.naoLidas > 9 ? "9+" : c.naoLidas}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto bg-background px-3 py-3">
                {mensagens.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted">
                    Nenhuma mensagem ainda. Escreva abaixo para começar a conversa.
                  </p>
                )}
                {mensagens.map((m) => {
                  const minha = m.destinatarioId === conversaId;
                  return (
                    <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          minha ? "bg-primary text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                        <p className={`mt-1 text-[10px] ${minha ? "text-white/70" : "text-muted"}`}>
                          {formatarHora(m.criadaEm)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              {erro && <div className="bg-danger-light px-3 py-1.5 text-xs text-danger">{erro}</div>}

              <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                  rows={1}
                  maxLength={1000}
                  placeholder="Escreva uma mensagem…"
                  className="input flex-1 resize-none max-h-28"
                />
                <button
                  onClick={() => void enviar()}
                  disabled={!texto.trim() || enviando}
                  aria-label="Enviar mensagem"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark disabled:opacity-50"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
