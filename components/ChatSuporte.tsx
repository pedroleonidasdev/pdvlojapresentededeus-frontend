"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Check, CheckCheck, Loader2, MessageCircle, Mic, Paperclip, Phone, PhoneCall, Send, Smile, Trash2, Video, X } from "lucide-react";
import SeletorEmoji from "@/components/SeletorEmoji";
import GravadorAudio from "@/components/GravadorAudio";
import MensagemAudio from "@/components/MensagemAudio";
import MensagemArquivo from "@/components/MensagemArquivo";
import AvisosMensagem, { AvisoChat } from "@/components/AvisosMensagem";
import { MAX_ANEXO_BYTES, MAX_ANEXO_MB, formatarTamanho } from "@/lib/anexos";
import { figurinhaTemTexto, soEmojis } from "@/lib/figurinhas";
import { useChamada } from "@/components/ChamadaProvider";
import { EVENTO_ALTERNAR_CHAT, publicarEstadoChat } from "@/lib/chat-eventos";

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

const CONTATOS_FECHADO_MS = 5_000;
const CONTATOS_ABERTO_MS = 6_000;
const MENSAGENS_MS = 3_000;

// Um único contexto de áudio, reaproveitado. Os navegadores só liberam som depois de um clique/toque
// do usuário na página; por isso ele é "destravado" na primeira interação (ver useEffect abaixo).
let contextoAudio: AudioContext | null = null;

function obterContextoAudio(): AudioContext | null {
  try {
    if (contextoAudio) return contextoAudio;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    contextoAudio = new Ctx();
    return contextoAudio;
  } catch {
    return null;
  }
}

function liberarAudio() {
  const ctx = obterContextoAudio();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

/** Toca um "ding-dong" de duas notas, bem audível, para avisar que chegou mensagem. */
function apitar() {
  try {
    const ctx = obterContextoAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const inicio = ctx.currentTime + 0.02;
    [
      { freq: 880, t: 0 },
      { freq: 1319, t: 0.2 },
    ].forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, inicio + t);
      ganho.gain.exponentialRampToValueAtTime(0.35, inicio + t + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + t + 0.45);
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      osc.start(inicio + t);
      osc.stop(inicio + t + 0.5);
    });
  } catch {
    // navegador bloqueou o áudio antes de qualquer clique: sem problema, fica só o aviso visual
  }
}

/** Som curto e suave para mensagem que chega com a conversa aberta e a janela em foco. */
function tocarSuave() {
  try {
    const ctx = obterContextoAudio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    const inicio = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 988;
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.18, inicio + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.25);
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + 0.3);
  } catch {
    // sem som: não faz mal
  }
}

function chaveDia(iso: string): string {
  return new Date(iso).toDateString();
}

function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

/** Confirmação de leitura: ✓ enviada, ✓✓ azul quando a outra pessoa leu. */
function Recibo({ lida, escuro }: { lida: boolean; escuro: boolean }) {
  const titulo = lida ? "Lida" : "Enviada";
  return lida ? (
    <CheckCheck aria-label={titulo} className={`h-3.5 w-3.5 ${escuro ? "text-sky-300" : "text-sky-600"}`} strokeWidth={2.5}>
      <title>{titulo}</title>
    </CheckCheck>
  ) : (
    <Check aria-label={titulo} className={`h-3.5 w-3.5 ${escuro ? "text-white/60" : "text-muted"}`} strokeWidth={2.5}>
      <title>{titulo}</title>
    </Check>
  );
}

function Rodape({ m, minha, escuro = true, className = "" }: { m: Mensagem; minha: boolean; escuro?: boolean; className?: string }) {
  const cor = minha ? (escuro ? "text-white/70" : "text-muted") : "text-muted";
  return (
    <span className={`mt-1 flex items-center gap-1 text-[10px] ${minha ? "justify-end" : "justify-start"} ${cor} ${className}`}>
      {formatarHora(m.criadaEm)}
      {minha && <Recibo lida={m.lida} escuro={escuro} />}
    </span>
  );
}

function Avatar({ nome, online, tamanho = "h-10 w-10", claro = false }: { nome: string; online?: boolean; tamanho?: string; claro?: boolean }) {
  return (
    <span
      className={`relative flex ${tamanho} shrink-0 items-center justify-center rounded-full text-sm font-bold ring-1 ${
        claro
          ? "bg-white/15 text-white ring-white/30"
          : "bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25 ring-white/40"
      }`}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${claro ? "border-primary-dark" : "border-surface"} ${
            online ? "bg-emerald-400" : "bg-slate-400"
          }`}
        />
      )}
    </span>
  );
}

/** Texto curto para o pop-up, conforme o tipo da mensagem. */
function previaDaMensagem(m: Mensagem | undefined): string {
  if (!m) return "Você recebeu uma nova mensagem.";
  switch (m.tipo) {
    case "AUDIO":
      return "🎤 Mensagem de áudio";
    case "ARQUIVO":
      return "📎 Enviou um arquivo";
    case "CHAMADA":
      return "📞 Chamada";
    default: {
      const t = m.texto.trim().replace(/\s+/g, " ");
      return t.length > 140 ? `${t.slice(0, 140)}…` : t || "Você recebeu uma nova mensagem.";
    }
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
  // pop-ups de "nova mensagem" (um por contato, no máximo 3 na tela)
  const [avisos, setAvisos] = useState<AvisoChat[]>([]);

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

  // destrava o som do aviso na primeira interação com a página (regra dos navegadores)
  useEffect(() => {
    const eventos = ["pointerdown", "keydown", "touchstart"] as const;
    const destravar = () => {
      liberarAudio();
      eventos.forEach((e) => window.removeEventListener(e, destravar));
    };
    eventos.forEach((e) => window.addEventListener(e, destravar, { passive: true }));
    return () => eventos.forEach((e) => window.removeEventListener(e, destravar));
  }, []);

  useEffect(() => {
    conversaIdRef.current = conversaId;
  }, [conversaId]);

  /** Mostra o pop-up (e a notificação do navegador, se a aba estiver escondida) com o começo da mensagem. */
  const anunciarNovas = useCallback(async (novos: Contato[]) => {
    const lista = novos.slice(0, 3);
    const previas = await Promise.all(
      lista.map(async (c) => {
        try {
          const { data } = await api.get<Mensagem[]>(`/suporte/conversas/${c.id}/mensagens`);
          return previaDaMensagem([...data].reverse().find((m) => m.remetenteId === c.id));
        } catch {
          return previaDaMensagem(undefined);
        }
      })
    );
    const hora = formatarHora(new Date().toISOString());
    setAvisos((atuais) => {
      const restantes = atuais.filter((a) => !lista.some((c) => a.contatoId === c.id));
      const novosAvisos = lista.map((c, i) => ({
        chave: `${c.id}-${Date.now()}-${i}`,
        contatoId: c.id,
        nome: c.nome,
        previa: previas[i],
        hora,
        online: c.online,
      }));
      return [...novosAvisos, ...restantes].slice(0, 3);
    });
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      new Notification(`Mensagem de ${lista[0].nome}`, { body: previas[0], tag: "chat-suporte" });
    }
  }, []);

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
        void anunciarNovas(novos);
      }
    } catch {
      // sem rede ou servidor acordando: tenta de novo no próximo ciclo
    } finally {
      buscandoContatosRef.current = false;
    }
  }, [anunciarNovas]);

  const buscarMensagens = useCallback(async () => {
    const id = conversaIdRef.current;
    if (id === null || buscandoMensagensRef.current) return;
    buscandoMensagensRef.current = true;
    try {
      // Traz sempre as mensagens recentes (não só as novas): assim quem enviou também fica
      // sabendo quando a outra pessoa leu (os ✓✓ azuis).
      const { data } = await api.get<Mensagem[]>(`/suporte/conversas/${id}/mensagens`);
      if (conversaIdRef.current !== id || data.length === 0) return; // trocou de conversa ou nada ainda

      const ultimoConhecido = ultimoIdRef.current;
      ultimoIdRef.current = Math.max(ultimoConhecido ?? 0, data[data.length - 1].id);
      const novasDele = data.filter(
        (m) => m.remetenteId === id && !m.lida && (ultimoConhecido === null || m.id > ultimoConhecido)
      );

      setMensagens((atuais) => {
        const porId = new Map(data.map((m) => [m.id, m]));
        const conhecidas = new Set(atuais.map((m) => m.id));
        let mudou = false;
        const atualizadas = atuais.map((m) => {
          const nova = porId.get(m.id);
          if (nova && nova.lida !== m.lida) {
            mudou = true;
            return { ...m, lida: nova.lida };
          }
          return m;
        });
        const extras = data.filter((m) => !conhecidas.has(m.id));
        if (!mudou && extras.length === 0) return atuais;
        return [...atualizadas, ...extras];
      });

      const emFoco = !document.hidden && document.hasFocus();
      if (novasDele.length > 0) {
        if (emFoco) {
          tocarSuave();
        } else {
          // conversa aberta, mas a pessoa está em outra aba/janela: avisa com som e notificação
          apitar();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Nova mensagem", { body: previaDaMensagem(novasDele[novasDele.length - 1]), tag: "chat-suporte" });
          }
        }
      }

      // só confirma a leitura quando a pessoa está realmente olhando a conversa
      if (emFoco && data.some((m) => m.remetenteId === id && !m.lida)) {
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
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void buscarMensagens();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
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

  // avisa o menu lateral / barra do celular (que têm o botão "Conversas") do total de não lidas e se está aberto
  useEffect(() => {
    publicarEstadoChat({ naoLidas: totalNaoLidas, aberto });
  }, [totalNaoLidas, aberto]);

  // o botão "Conversas" do menu pede para abrir/fechar o chat por este evento
  useEffect(() => {
    function alternar() {
      if (abertoRef.current) setAberto(false);
      else abrirChat();
    }
    window.addEventListener(EVENTO_ALTERNAR_CHAT, alternar);
    return () => window.removeEventListener(EVENTO_ALTERNAR_CHAT, alternar);
  });

  function abrirConversa(id: number) {
    setAvisos((atuais) => atuais.filter((a) => a.contatoId !== id));
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

  /** Clique no pop-up: abre o chat direto na conversa de quem mandou. */
  function abrirPeloAviso(id: number) {
    abrirChat();
    abrirConversa(id);
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

  const renderBolha = (m: Mensagem) => {
    if (m.tipo === "CHAMADA") {
      return (
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1 text-xs text-muted shadow-sm">
            <PhoneCall className="h-3.5 w-3.5" />
            {m.texto} · {formatarHora(m.criadaEm)}
          </span>
        </div>
      );
    }
    const minha = m.destinatarioId === conversaId;
    const balao = minha
      ? "rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/20"
      : "rounded-2xl rounded-bl-md border border-border/60 bg-surface shadow-sm";
    if (m.tipo === "AUDIO") {
      return (
        <div className={`chat-msg flex ${minha ? "justify-end" : "justify-start"}`}>
          <div className={`px-3 py-2 text-sm ${balao}`}>
            <MensagemAudio mensagemId={m.id} duracao={Number(m.texto) || 0} minha={minha} />
            <Rodape m={m} minha={minha} />
          </div>
        </div>
      );
    }
    if (m.tipo === "ARQUIVO") {
      return (
        <div className={`chat-msg flex ${minha ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] px-2.5 py-2 text-sm ${balao}`}>
            <MensagemArquivo mensagemId={m.id} texto={m.texto} minha={minha} />
            <Rodape m={m} minha={minha} className="px-0.5" />
          </div>
        </div>
      );
    }
    if (m.tipo === "FIGURINHA") {
      return (
        <div className={`chat-msg flex ${minha ? "justify-end" : "justify-start"}`}>
          <div className="max-w-[85%]">
            {figurinhaTemTexto(m.texto) ? (
              <p className="rounded-2xl border border-accent/40 bg-accent-light px-4 py-3 text-center text-base font-semibold shadow-sm">
                {m.texto}
              </p>
            ) : (
              <p className="text-center text-6xl leading-none drop-shadow-sm">{m.texto}</p>
            )}
            <Rodape m={m} minha={minha} escuro={false} />
          </div>
        </div>
      );
    }
    return (
      <div className={`chat-msg flex ${minha ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[85%] px-3.5 py-2 text-sm ${balao}`}>
          <p className={`whitespace-pre-wrap break-words ${soEmojis(m.texto) ? "text-3xl leading-tight" : ""}`}>{m.texto}</p>
          <Rodape m={m} minha={minha} />
        </div>
      </div>
    );
  };

  if (!usuario) return null;

  return (
    <>
      <AvisosMensagem
        avisos={avisos}
        onAbrir={abrirPeloAviso}
        onFechar={(chave) => setAvisos((atuais) => atuais.filter((a) => a.chave !== chave))}
      />
      {aberto && (
        <div
          className="chat-janela fixed right-4 md:right-auto md:left-[15.75rem] z-40 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/60 bg-surface shadow-[0_28px_70px_-20px_rgba(15,51,42,0.6)] ring-1 ring-black/10"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="relative flex items-center justify-between gap-2 bg-gradient-to-br from-primary via-primary to-primary-dark px-3 py-3.5 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
            <div className="relative flex min-w-0 items-center gap-2.5">
              {conversaId !== null && (
                <button
                  onClick={voltarParaLista}
                  aria-label="Voltar para a lista"
                  className="rounded-xl p-1.5 transition hover:bg-white/10"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              {conversaId === null ? (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <MessageCircle className="h-5 w-5" />
                </span>
              ) : (
                <Avatar nome={contatoAtual?.nome ?? "?"} online={contatoAtual?.online ?? false} claro />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">
                  {conversaId === null ? "Conversas" : (contatoAtual?.nome ?? "Conversa")}
                </p>
                <p className="truncate text-xs text-white/75">
                  {conversaId === null
                    ? `Você: @${usuario.login} · conversas privadas`
                    : `@${contatoAtual?.login ?? ""} · ${contatoAtual?.online ? "online agora" : "offline"}`}
                </p>
              </div>
            </div>
            <div className="relative flex shrink-0 items-center">
              {conversaId !== null && (
                <>
                  <button
                    onClick={() => ligar("AUDIO")}
                    disabled={!contatoAtual?.online || emChamada}
                    aria-label="Chamada de áudio"
                    title={contatoAtual?.online ? "Chamada de áudio" : "Disponível quando a pessoa estiver online"}
                    className="rounded-xl p-1.5 transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Phone className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => ligar("VIDEO")}
                    disabled={!contatoAtual?.online || emChamada}
                    aria-label="Chamada de vídeo"
                    title={contatoAtual?.online ? "Chamada de vídeo" : "Disponível quando a pessoa estiver online"}
                    className="rounded-xl p-1.5 transition hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Video className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setConfirmandoApagar(true)}
                    aria-label="Apagar conversa"
                    title="Apagar conversa"
                    className="rounded-xl p-1.5 transition hover:bg-white/10"
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
                className="rounded-xl p-1.5 transition hover:bg-white/10"
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
            <div className="flex-1 min-h-0 space-y-1 overflow-y-auto bg-gradient-to-b from-background to-surface-alt/40 p-2">
              {contatosOrdenados.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  Não há outro usuário ativo para conversar. Cadastre um em Usuários.
                </p>
              ) : (
                contatosOrdenados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => abrirConversa(c.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface hover:shadow-sm ${
                      c.naoLidas > 0 ? "bg-surface shadow-sm ring-1 ring-accent/40" : ""
                    }`}
                  >
                    <Avatar nome={c.nome} online={c.online} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm ${c.naoLidas > 0 ? "font-bold" : "font-semibold"}`}>{c.nome}</span>
                      <span className="block truncate text-xs text-muted">
                        {c.perfil === "ADMIN" ? "Administrador" : "Caixa"} · @{c.login} · {c.online ? "online" : "offline"}
                      </span>
                    </span>
                    {c.naoLidas > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark px-1.5 text-xs font-bold text-white shadow shadow-accent/40">
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
                className={`relative flex-1 min-h-0 space-y-2 overflow-y-auto bg-gradient-to-b from-background to-surface-alt/40 px-3 py-3 ${
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
                  <div className="flex flex-col items-center gap-2 py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <MessageCircle className="h-6 w-6" />
                    </span>
                    <p className="text-sm text-muted">Nenhuma mensagem ainda.<br />Escreva abaixo para começar a conversa.</p>
                  </div>
                )}
                {mensagens.map((m, i) => (
                  <Fragment key={m.id}>
                    {(i === 0 || chaveDia(mensagens[i - 1].criadaEm) !== chaveDia(m.criadaEm)) && (
                      <div className="flex justify-center py-1">
                        <span className="rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-semibold text-primary">
                          {rotuloDia(m.criadaEm)}
                        </span>
                      </div>
                    )}
                    {renderBolha(m)}
                  </Fragment>
                ))}
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
              <div className="flex items-end gap-1.5 border-t border-border/60 bg-surface p-2.5">
                <button
                  onClick={() => setSeletorAberto((v) => !v)}
                  aria-label="Emojis e figurinhas"
                  title="Emojis e figurinhas"
                  aria-pressed={seletorAberto}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-background ${
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-background disabled:opacity-50"
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
                  className="input chat-input flex-1 resize-none max-h-28"
                />
                {texto.trim() || enviando ? (
                  <button
                    onClick={() => void enviar()}
                    disabled={!texto.trim() || enviando}
                    aria-label="Enviar mensagem"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    onClick={comecarGravacao}
                    disabled={emChamada}
                    aria-label="Gravar áudio"
                    title={emChamada ? "Indisponível durante uma chamada" : "Gravar áudio"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
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
