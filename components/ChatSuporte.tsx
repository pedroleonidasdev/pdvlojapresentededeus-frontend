"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Loader2, MessageCircle, Mic, Paperclip, Phone, PhoneCall, Send, Smile, Trash2, Video, X } from "lucide-react";
import SeletorEmoji from "@/components/SeletorEmoji";
import GravadorAudio from "@/components/GravadorAudio";
import MensagemAudio from "@/components/MensagemAudio";
import MensagemArquivo from "@/components/MensagemArquivo";
import { MAX_ANEXO_BYTES, MAX_ANEXO_MB, formatarTamanho } from "@/lib/anexos";
import { figurinhaTemTexto, soEmojis } from "@/lib/figurinhas";
import { useChamada } from "@/components/ChamadaProvider";

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
  tipo: string | null;
}

/** Texto de erro útil: usa a mensagem do servidor ou ao menos o código HTTP, para dar para diagnosticar. */
function descreverErro(e: unknown, padrao: string): string {
  if (axios.isAxiosError(e)) {
    if (!e.response) return `${padrao} Sem conexão com o servidor.`;
    const msg = (e.response.data as { message?: string } | undefined)?.message;
    return `${padrao} (erro ${e.response.status}${msg ? `: ${msg}` : ""})`;
  }
  return padrao;
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
  const { iniciarChamada, emChamada } = useChamada();
  const [aberto, setAberto] = useState(false);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [conversaId, setConversaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [apagando, setApagando] = useState(false);
  // envio de arquivos: nome do que está subindo e o andamento (0-100)
  const [anexoEnviando, setAnexoEnviando] = useState<{ nome: string; progresso: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const abertoRef = useRef(false);
  const conversaIdRef = useRef<number | null>(null);
  const ultimoIdRef = useRef<number | null>(null);
  const naoLidasAnterioresRef = useRef<Map<number, number> | null>(null);
  const buscandoContatosRef = useRef(false);
  const buscandoMensagensRef = useRef(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);

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
    setConfirmandoApagar(false);
    setSeletorAberto(false);
    setGravando(false);
    setArrastando(false);
    setConversaId(id);
  }

  function voltarParaLista() {
    ultimoIdRef.current = null;
    conversaIdRef.current = null;
    setConversaId(null);
    setMensagens([]);
    setErro(null);
    setConfirmandoApagar(false);
    setSeletorAberto(false);
    setGravando(false);
    void buscarContatos();
  }

  async function apagarConversa() {
    if (conversaId === null || apagando) return;
    setApagando(true);
    setErro(null);
    try {
      await api.delete(`/suporte/conversas/${conversaId}/mensagens`);
      voltarParaLista();
    } catch (e) {
      setErro(descreverErro(e, "Não foi possível apagar a conversa."));
      setConfirmandoApagar(false);
    } finally {
      setApagando(false);
    }
  }

  function ligar(tipo: "AUDIO" | "VIDEO") {
    if (!contatoAtual) return;
    void iniciarChamada({ id: contatoAtual.id, nome: contatoAtual.nome }, tipo);
  }

  async function postarMensagem(conteudo: string, tipo?: "FIGURINHA"): Promise<boolean> {
    if (enviando || conversaId === null) return false;
    setEnviando(true);
    setErro(null);
    try {
      const { data } = await api.post<Mensagem>(`/suporte/conversas/${conversaId}/mensagens`, { texto: conteudo, tipo });
      ultimoIdRef.current = Math.max(ultimoIdRef.current ?? 0, data.id);
      setMensagens((atuais) => (atuais.some((m) => m.id === data.id) ? atuais : [...atuais, data]));
      return true;
    } catch (e) {
      setErro(descreverErro(e, "Não foi possível enviar."));
      return false;
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (await postarMensagem(conteudo)) setTexto("");
  }

  async function enviarAudio(audio: Blob, duracao: number) {
    setGravando(false);
    if (enviando || conversaId === null) return;
    setEnviando(true);
    setErro(null);
    try {
      const { data } = await api.post<Mensagem>(`/suporte/conversas/${conversaId}/audios`, audio, {
        params: { duracao },
        headers: { "Content-Type": audio.type || "audio/webm" },
      });
      ultimoIdRef.current = Math.max(ultimoIdRef.current ?? 0, data.id);
      setMensagens((atuais) => (atuais.some((m) => m.id === data.id) ? atuais : [...atuais, data]));
    } catch (e) {
      setErro(descreverErro(e, "Não foi possível enviar o áudio."));
    } finally {
      setEnviando(false);
    }
  }

  function comecarGravacao() {
    setSeletorAberto(false);
    setErro(null);
    setGravando(true);
  }

  /** Envia um ou mais arquivos (de qualquer formato), um de cada vez. */
  async function enviarArquivos(lista: File[]) {
    const id = conversaId;
    if (id === null || enviando || lista.length === 0) return;
    setSeletorAberto(false);
    setErro(null);
    setEnviando(true);
    const problemas: string[] = [];
    try {
      for (const arquivo of lista) {
        if (arquivo.size === 0) {
          problemas.push(`“${arquivo.name}” está vazio.`);
          continue;
        }
        if (arquivo.size > MAX_ANEXO_BYTES) {
          problemas.push(`“${arquivo.name}” tem ${formatarTamanho(arquivo.size)} (o máximo é ${MAX_ANEXO_MB} MB).`);
          continue;
        }
        setAnexoEnviando({ nome: arquivo.name, progresso: 0 });
        try {
          const form = new FormData();
          form.append("arquivo", arquivo, arquivo.name);
          const { data } = await api.post<Mensagem>(`/suporte/conversas/${id}/anexos`, form, {
            onUploadProgress: (ev) => {
              if (ev.total) setAnexoEnviando({ nome: arquivo.name, progresso: Math.round((ev.loaded / ev.total) * 100) });
            },
          });
          if (conversaIdRef.current === id) {
            ultimoIdRef.current = Math.max(ultimoIdRef.current ?? 0, data.id);
            setMensagens((atuais) => (atuais.some((m) => m.id === data.id) ? atuais : [...atuais, data]));
          }
        } catch (e) {
          problemas.push(descreverErro(e, `Não foi possível enviar “${arquivo.name}”.`));
        }
      }
    } finally {
      setAnexoEnviando(null);
      setEnviando(false);
      if (problemas.length > 0) setErro(problemas.join(" "));
    }
  }

  function aoEscolherArquivos(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    void enviarArquivos(lista);
  }

  async function enviarFigurinha(conteudo: string) {
    if (await postarMensagem(conteudo, "FIGURINHA")) setSeletorAberto(false);
  }

  /** Coloca o emoji onde está o cursor (ou no fim, se a caixa nunca foi usada). */
  function inserirEmoji(emoji: string) {
    const el = textareaRef.current;
    const inicio = el?.selectionStart ?? texto.length;
    const fim = el?.selectionEnd ?? texto.length;
    const novo = texto.slice(0, inicio) + emoji + texto.slice(fim);
    if (novo.length > 1000) return;
    setTexto(novo);
    const posicao = inicio + emoji.length;
    requestAnimationFrame(() => el?.setSelectionRange(posicao, posicao));
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
                <p className="truncate text-xs text-white/80">
                  {conversaId === null
                    ? `Você: @${usuario.login} · conversas privadas`
                    : `@${contatoAtual?.login ?? ""} · ${contatoAtual?.online ? "online agora" : "offline"}`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {conversaId !== null && (
                <>
                  <button
                    onClick={() => ligar("AUDIO")}
                    disabled={!contatoAtual?.online || emChamada}
                    aria-label="Chamada de áudio"
                    title={contatoAtual?.online ? "Chamada de áudio" : "Disponível quando a pessoa estiver online"}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => ligar("VIDEO")}
                    disabled={!contatoAtual?.online || emChamada}
                    aria-label="Chamada de vídeo"
                    title={contatoAtual?.online ? "Chamada de vídeo" : "Disponível quando a pessoa estiver online"}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setConfirmandoApagar(true)}
                    aria-label="Apagar conversa"
                    title="Apagar conversa"
                    className="p-1.5 rounded-lg hover:bg-white/10 transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setGravando(false);
                  setAberto(false);
                }}
                aria-label="Fechar chat"
                className="p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {confirmandoApagar && (
            <div className="space-y-2 border-b border-border bg-danger-light px-3 py-3 text-sm">
              <p className="font-medium text-danger">Apagar esta conversa?</p>
              <p className="text-xs text-foreground/80">
                As mensagens somem só para você. {contatoAtual?.nome ?? "A outra pessoa"} continua vendo o histórico dela.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmandoApagar(false)}
                  disabled={apagando}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-alt disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void apagarConversa()}
                  disabled={apagando}
                  className="flex items-center gap-1.5 rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {apagando && <Loader2 className="h-3 w-3 animate-spin" />}
                  Apagar
                </button>
              </div>
            </div>
          )}

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
                      <span className="block truncate text-xs text-muted">
                        {c.perfil === "ADMIN" ? "Administrador" : "Caixa"} · @{c.login} · {c.online ? "online" : "offline"}
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
              <div
                className={`relative flex-1 min-h-0 space-y-2 overflow-y-auto bg-background px-3 py-3 ${
                  arrastando ? "outline-2 -outline-offset-4 outline-dashed outline-primary" : ""
                }`}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("Files")) {
                    e.preventDefault();
                    setArrastando(true);
                  }
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  if (!e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setArrastando(false);
                  void enviarArquivos(Array.from(e.dataTransfer.files));
                }}
              >
                {arrastando && (
                  <p className="pointer-events-none sticky top-0 z-10 rounded-lg bg-primary-light px-3 py-2 text-center text-xs font-medium text-primary">
                    Solte aqui para enviar o arquivo
                  </p>
                )}
                {mensagens.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted">
                    Nenhuma mensagem ainda. Escreva abaixo para começar a conversa.
                  </p>
                )}
                {mensagens.map((m) => {
                  if (m.tipo === "CHAMADA") {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                          <PhoneCall className="h-3.5 w-3.5" />
                          {m.texto} · {formatarHora(m.criadaEm)}
                        </span>
                      </div>
                    );
                  }
                  const minha = m.destinatarioId === conversaId;
                  if (m.tipo === "AUDIO") {
                    return (
                      <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-sm ${
                            minha ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-border bg-surface"
                          }`}
                        >
                          <MensagemAudio mensagemId={m.id} duracao={Number(m.texto) || 0} minha={minha} />
                          <p className={`mt-1 text-[10px] ${minha ? "text-white/70" : "text-muted"}`}>{formatarHora(m.criadaEm)}</p>
                        </div>
                      </div>
                    );
                  }
                  if (m.tipo === "ARQUIVO") {
                    return (
                      <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-2.5 py-2 text-sm ${
                            minha ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm border border-border bg-surface"
                          }`}
                        >
                          <MensagemArquivo mensagemId={m.id} texto={m.texto} minha={minha} />
                          <p className={`mt-1 px-0.5 text-[10px] ${minha ? "text-white/70" : "text-muted"}`}>{formatarHora(m.criadaEm)}</p>
                        </div>
                      </div>
                    );
                  }
                  if (m.tipo === "FIGURINHA") {
                    return (
                      <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[85%]">
                          {figurinhaTemTexto(m.texto) ? (
                            <p className="rounded-2xl border border-accent/40 bg-accent-light px-4 py-3 text-center text-base font-semibold">
                              {m.texto}
                            </p>
                          ) : (
                            <p className="text-center text-6xl leading-none">{m.texto}</p>
                          )}
                          <p className={`mt-1 text-[10px] text-muted ${minha ? "text-right" : "text-left"}`}>
                            {formatarHora(m.criadaEm)}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} className={`flex ${minha ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                          minha ? "bg-primary text-white rounded-br-sm" : "bg-surface border border-border rounded-bl-sm"
                        }`}
                      >
                        <p className={`whitespace-pre-wrap break-words ${soEmojis(m.texto) ? "text-3xl leading-tight" : ""}`}>{m.texto}</p>
                        <p className={`mt-1 text-[10px] ${minha ? "text-white/70" : "text-muted"}`}>
                          {formatarHora(m.criadaEm)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              {anexoEnviando && (
                <div className="border-t border-border bg-surface px-3 py-2 text-xs" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">Enviando “{anexoEnviando.nome}”…</span>
                    <span className="shrink-0 font-mono">{anexoEnviando.progresso}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border/50">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${anexoEnviando.progresso}%` }} />
                  </div>
                </div>
              )}

              {erro && <div className="bg-danger-light px-3 py-1.5 text-xs text-danger">{erro}</div>}

              {seletorAberto && (
                <SeletorEmoji onEmoji={inserirEmoji} onFigurinha={(f) => void enviarFigurinha(f)} desabilitado={enviando} />
              )}

              {gravando ? (
                <GravadorAudio
                  onEnviar={(audio, duracao) => void enviarAudio(audio, duracao)}
                  onCancelar={() => setGravando(false)}
                  onErro={setErro}
                />
              ) : (
              <div className="flex items-end gap-2 border-t border-border bg-surface p-3">
                <button
                  onClick={() => setSeletorAberto((v) => !v)}
                  aria-label="Emojis e figurinhas"
                  title="Emojis e figurinhas"
                  aria-pressed={seletorAberto}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-background ${
                    seletorAberto ? "bg-primary-light text-primary" : "text-muted"
                  }`}
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={() => arquivoInputRef.current?.click()}
                  disabled={enviando}
                  aria-label="Anexar arquivo"
                  title={`Anexar arquivo (até ${MAX_ANEXO_MB} MB)`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-background disabled:opacity-50"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input ref={arquivoInputRef} type="file" multiple className="hidden" onChange={aoEscolherArquivos} />
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onPaste={(e) => {
                    // colar print/arquivo (Ctrl+V) envia como anexo; colar texto continua normal
                    const colados = Array.from(e.clipboardData.files);
                    if (colados.length > 0) {
                      e.preventDefault();
                      void enviarArquivos(colados);
                    }
                  }}
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
                {texto.trim() || enviando ? (
                  <button
                    onClick={() => void enviar()}
                    disabled={!texto.trim() || enviando}
                    aria-label="Enviar mensagem"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    onClick={comecarGravacao}
                    disabled={emChamada}
                    aria-label="Gravar áudio"
                    title={emChamada ? "Indisponível durante uma chamada" : "Gravar áudio"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
