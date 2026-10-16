"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import TelaChamada from "@/components/TelaChamada";

export type TipoChamada = "AUDIO" | "VIDEO";
export type FaseChamada = "iniciando" | "chamando" | "recebendo" | "conectando" | "conectada" | "reconectando";

export interface ChamadaAtiva {
  id: string | null;
  tipo: TipoChamada;
  direcao: "SAIDA" | "ENTRADA";
  outroId: number;
  outroNome: string;
  fase: FaseChamada;
}

interface ChamadaServidor {
  id: string;
  tipo: TipoChamada;
  status: "TOCANDO" | "EM_ANDAMENTO" | "ENCERRADA" | "RECUSADA" | "NAO_ATENDIDA" | "CANCELADA";
  direcao: "SAIDA" | "ENTRADA";
  outroId: number;
  outroNome: string;
  oferta: string | null;
  resposta: string | null;
}

interface ChamadaContextValue {
  iniciarChamada: (contato: { id: number; nome: string }, tipo: TipoChamada) => Promise<void>;
  emChamada: boolean;
}

const ChamadaContext = createContext<ChamadaContextValue | undefined>(undefined);

const POLLING_CHAMADA_MS = 1_500;
const POLLING_ENTRADA_MS = 3_000;
const FALHAS_SEGUIDAS_MAX = 8;
const LIMITE_ICE_MS = 4_000;

/**
 * Servidores STUN/TURN. Sem configuração usa só STUN público do Google, que
 * funciona na maioria das redes; redes corporativas/4G restritivas precisam de
 * um servidor TURN — defina NEXT_PUBLIC_ICE_SERVERS (JSON) para usá-lo.
 */
function obterIceServers(): RTCIceServer[] {
  const bruto = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (bruto) {
    try {
      const lista = JSON.parse(bruto);
      if (Array.isArray(lista) && lista.length > 0) return lista as RTCIceServer[];
    } catch {
      // JSON inválido: cai no padrão
    }
  }
  return [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
}

/** Espera o navegador terminar de coletar os caminhos de rede (ou desiste após o limite). */
function aguardarIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const concluir = () => {
      pc.removeEventListener("icegatheringstatechange", aoMudar);
      clearTimeout(limite);
      resolve();
    };
    const aoMudar = () => {
      if (pc.iceGatheringState === "complete") concluir();
    };
    const limite = setTimeout(concluir, LIMITE_ICE_MS);
    pc.addEventListener("icegatheringstatechange", aoMudar);
  });
}

async function obterMidia(tipo: TipoChamada): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: tipo === "VIDEO" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
  });
}

function mensagemDeErro(e: unknown, tipo: TipoChamada): string {
  const alvo = tipo === "VIDEO" ? "o microfone e a câmera" : "o microfone";
  if (e instanceof DOMException) {
    if (e.name === "NotAllowedError" || e.name === "SecurityError") {
      return `Permita o uso ${tipo === "VIDEO" ? "do microfone e da câmera" : "do microfone"} nas permissões do navegador para fazer chamadas.`;
    }
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError") return `Não encontrei ${alvo} neste aparelho.`;
    if (e.name === "NotReadableError") return `Não consegui usar ${alvo}: outro programa pode estar usando.`;
  }
  if (axios.isAxiosError(e)) {
    const msg = (e.response?.data as { message?: string } | undefined)?.message;
    return msg ?? "Não foi possível falar com o servidor. Tente de novo.";
  }
  return "Não foi possível iniciar a chamada.";
}

export function useChamada() {
  const ctx = useContext(ChamadaContext);
  if (!ctx) throw new Error("useChamada deve ser usado dentro de ChamadaProvider");
  return ctx;
}

function tocarToque(ctx: AudioContext, recebendo: boolean) {
  const tom = (freq: number, inicio: number, duracao: number, volume: number) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    ganho.gain.value = volume;
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(ctx.currentTime + inicio);
    osc.stop(ctx.currentTime + inicio + duracao);
  };
  if (recebendo) {
    tom(880, 0, 0.3, 0.12);
    tom(660, 0.4, 0.3, 0.12);
    tom(880, 0.8, 0.3, 0.12);
  } else {
    tom(425, 0, 0.9, 0.05); // "chamando": tom de espera de quem liga
  }
}

export function ChamadaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  const [chamada, setChamadaEstado] = useState<ChamadaAtiva | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [mudo, setMudo] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  const chamadaRef = useRef<ChamadaAtiva | null>(null);
  const sessaoRef = useRef(0);
  const ocupadoRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const idRef = useRef<string | null>(null);
  const ofertaRef = useRef<string | null>(null);
  const respostaAplicadaRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consultandoRef = useRef(false);
  const verificandoEntradaRef = useRef(false);
  const falhasRef = useRef(0);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setChamada = useCallback(
    (v: ChamadaAtiva | null | ((atual: ChamadaAtiva | null) => ChamadaAtiva | null)) => {
      const novo = typeof v === "function" ? v(chamadaRef.current) : v;
      chamadaRef.current = novo;
      setChamadaEstado(novo);
    },
    []
  );

  const mostrarAviso = useCallback((texto: string) => {
    setAviso(texto);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(null), 5_000);
  }, []);

  /** Desfaz tudo da chamada atual (conexão, câmera/microfone, timers) e volta ao estado livre. */
  const limpar = useCallback(
    (textoAviso?: string) => {
      sessaoRef.current += 1;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      const pc = pcRef.current;
      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      }
      pcRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      idRef.current = null;
      ofertaRef.current = null;
      respostaAplicadaRef.current = false;
      falhasRef.current = 0;
      consultandoRef.current = false;
      ocupadoRef.current = false;
      setChamada(null);
      setLocalStream(null);
      setRemoteStream(null);
      setMudo(false);
      setSemCamera(false);
      setSegundos(0);
      if (textoAviso) mostrarAviso(textoAviso);
    },
    [mostrarAviso, setChamada]
  );

  const criarPeer = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: obterIceServers() });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (ev) => setRemoteStream(ev.streams[0] ?? new MediaStream([ev.track]));
      pc.onconnectionstatechange = () => {
        if (pcRef.current !== pc) return;
        const estado = pc.connectionState;
        if (estado === "connected") {
          setChamada((c) => (c ? { ...c, fase: "conectada" } : c));
        } else if (estado === "disconnected") {
          setChamada((c) => (c && c.fase === "conectada" ? { ...c, fase: "reconectando" } : c));
        } else if (estado === "failed") {
          const id = idRef.current;
          if (id) void api.post(`/chamadas/${id}/encerrar`).catch(() => {});
          limpar("Não foi possível conectar a chamada. Verifique a internet e tente de novo.");
        }
      };
      return pc;
    },
    [limpar, setChamada]
  );

  /** Aplica no navegador o que o servidor informou sobre a chamada. */
  const aplicarEstado = useCallback(
    async (d: ChamadaServidor, sessao: number) => {
      const nome = d.outroNome;
      switch (d.status) {
        case "TOCANDO":
          return;
        case "EM_ANDAMENTO": {
          if (d.direcao === "SAIDA") {
            if (!respostaAplicadaRef.current && d.resposta && pcRef.current) {
              respostaAplicadaRef.current = true;
              await pcRef.current.setRemoteDescription(JSON.parse(d.resposta));
              if (sessao !== sessaoRef.current) return;
              setChamada((c) => (c && c.fase === "chamando" ? { ...c, fase: "conectando" } : c));
            }
          } else if (chamadaRef.current?.fase === "recebendo") {
            limpar("A chamada foi atendida em outra janela.");
          }
          return;
        }
        case "RECUSADA":
          limpar(d.direcao === "SAIDA" ? `${nome} recusou a chamada.` : undefined);
          return;
        case "NAO_ATENDIDA":
          limpar(d.direcao === "SAIDA" ? `${nome} não atendeu.` : `Chamada perdida de ${nome}.`);
          return;
        case "CANCELADA":
          limpar(d.direcao === "ENTRADA" ? `Chamada perdida de ${nome}.` : undefined);
          return;
        case "ENCERRADA":
          limpar("Chamada encerrada.");
          return;
      }
    },
    [limpar, setChamada]
  );

  const consultar = useCallback(async () => {
    const id = idRef.current;
    if (!id || consultandoRef.current) return;
    consultandoRef.current = true;
    const sessao = sessaoRef.current;
    try {
      const { data } = await api.get<ChamadaServidor>(`/chamadas/${id}`);
      if (sessao !== sessaoRef.current) return;
      falhasRef.current = 0;
      await aplicarEstado(data, sessao);
    } catch (e) {
      if (sessao !== sessaoRef.current) return;
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        limpar("A chamada foi perdida.");
        return;
      }
      falhasRef.current += 1;
      if (falhasRef.current >= FALHAS_SEGUIDAS_MAX) {
        limpar("Sem conexão com o servidor. Chamada encerrada.");
      }
    } finally {
      consultandoRef.current = false;
    }
  }, [aplicarEstado, limpar]);

  const iniciarPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => void consultar(), POLLING_CHAMADA_MS);
  }, [consultar]);

  const iniciarChamada = useCallback(
    async (contato: { id: number; nome: string }, tipo: TipoChamada) => {
      if (ocupadoRef.current) {
        mostrarAviso("Você já está em uma chamada.");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
        mostrarAviso("Este navegador não permite chamadas. Use um navegador atualizado e o endereço seguro (https).");
        return;
      }
      ocupadoRef.current = true;
      sessaoRef.current += 1;
      const sessao = sessaoRef.current;
      setChamada({ id: null, tipo, direcao: "SAIDA", outroId: contato.id, outroNome: contato.nome, fase: "iniciando" });

      try {
        const stream = await obterMidia(tipo);
        if (sessao !== sessaoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = criarPeer(stream);
        pcRef.current = pc;
        await pc.setLocalDescription(await pc.createOffer());
        await aguardarIce(pc);
        if (sessao !== sessaoRef.current) return;

        const { data } = await api.post<ChamadaServidor>("/chamadas", {
          destinatarioId: contato.id,
          tipo,
          oferta: JSON.stringify(pc.localDescription),
        });
        if (sessao !== sessaoRef.current) {
          // a pessoa desligou enquanto o servidor criava a chamada
          void api.post(`/chamadas/${data.id}/encerrar`).catch(() => {});
          return;
        }
        idRef.current = data.id;
        setChamada((c) => (c ? { ...c, id: data.id, fase: "chamando" } : c));
        iniciarPolling();
      } catch (e) {
        if (sessao !== sessaoRef.current) return;
        limpar(mensagemDeErro(e, tipo));
      }
    },
    [criarPeer, iniciarPolling, limpar, mostrarAviso, setChamada]
  );

  const atender = useCallback(async () => {
    const info = chamadaRef.current;
    const id = idRef.current;
    const oferta = ofertaRef.current;
    if (!info || !id || !oferta || info.fase !== "recebendo") return;
    const sessao = sessaoRef.current;
    setChamada({ ...info, fase: "conectando" });

    try {
      const stream = await obterMidia(info.tipo);
      if (sessao !== sessaoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = criarPeer(stream);
      pcRef.current = pc;
      await pc.setRemoteDescription(JSON.parse(oferta));
      await pc.setLocalDescription(await pc.createAnswer());
      await aguardarIce(pc);
      if (sessao !== sessaoRef.current) return;

      await api.post(`/chamadas/${id}/atender`, { resposta: JSON.stringify(pc.localDescription) });
    } catch (e) {
      if (sessao !== sessaoRef.current) return;
      void api.post(`/chamadas/${id}/recusar`).catch(() => {});
      limpar(mensagemDeErro(e, info.tipo));
    }
  }, [criarPeer, limpar, setChamada]);

  const recusar = useCallback(() => {
    const id = idRef.current;
    if (id) void api.post(`/chamadas/${id}/recusar`).catch(() => {});
    limpar();
  }, [limpar]);

  const encerrar = useCallback(() => {
    const id = idRef.current;
    if (id) void api.post(`/chamadas/${id}/encerrar`).catch(() => {});
    limpar();
  }, [limpar]);

  const alternarMudo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const novo = !stream.getAudioTracks().every((t) => !t.enabled);
    stream.getAudioTracks().forEach((t) => (t.enabled = !novo));
    setMudo(novo);
  }, []);

  const alternarCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const novo = !stream.getVideoTracks().every((t) => !t.enabled);
    stream.getVideoTracks().forEach((t) => (t.enabled = !novo));
    setSemCamera(novo);
  }, []);

  /** Chamada recebida: guarda a oferta, mostra a tela de "atender" e avisa mesmo com a aba escondida. */
  const receber = useCallback(
    (d: ChamadaServidor) => {
      ocupadoRef.current = true;
      sessaoRef.current += 1;
      idRef.current = d.id;
      ofertaRef.current = d.oferta;
      setChamada({ id: d.id, tipo: d.tipo, direcao: "ENTRADA", outroId: d.outroId, outroNome: d.outroNome, fase: "recebendo" });
      iniciarPolling();
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        try {
          const n = new Notification(`Chamada de ${d.outroNome}`, {
            body: d.tipo === "VIDEO" ? "Chamada de vídeo recebida" : "Chamada de áudio recebida",
            tag: "chamada-suporte",
            requireInteraction: true,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          // alguns navegadores móveis não permitem Notification direta: fica só a tela
        }
      }
    },
    [iniciarPolling, setChamada]
  );

  // sem chamada em curso: de tempos em tempos pergunta ao servidor se alguém está ligando
  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    const verificar = async () => {
      if (ocupadoRef.current || verificandoEntradaRef.current) return;
      verificandoEntradaRef.current = true;
      try {
        const res = await api.get<ChamadaServidor>("/chamadas/atual");
        if (!ativo || ocupadoRef.current || res.status !== 200 || !res.data) return;
        const d = res.data;
        if (d.direcao === "ENTRADA" && d.status === "TOCANDO" && d.oferta) receber(d);
      } catch {
        // sem rede: tenta no próximo ciclo
      } finally {
        verificandoEntradaRef.current = false;
      }
    };
    void verificar();
    const intervalo = setInterval(() => void verificar(), POLLING_ENTRADA_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void verificar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [usuario, receber]);

  // logout (ou usuário some) no meio de uma chamada: derruba tudo
  const logado = !!usuario;
  useEffect(() => {
    if (!logado && ocupadoRef.current) encerrar();
  }, [logado, encerrar]);

  // fechou a aba/recarregou: avisa o servidor se der (senão ele encerra sozinho em poucos segundos)
  useEffect(() => {
    const aoSair = () => {
      const id = idRef.current;
      const token = localStorage.getItem("pdv_token");
      if (!id || !token) return;
      void fetch(`${api.defaults.baseURL}/chamadas/${id}/encerrar`, {
        method: "POST",
        keepalive: true,
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  // toque: "chamando" para quem liga, campainha para quem recebe
  const fase = chamada?.fase;
  useEffect(() => {
    if (fase !== "chamando" && fase !== "recebendo") return;
    const recebendo = fase === "recebendo";
    let ctx: AudioContext | null = null;
    const tocar = () => {
      try {
        if (!ctx) {
          const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (!Ctx) return;
          ctx = new Ctx();
        }
        void ctx.resume();
        tocarToque(ctx, recebendo);
      } catch {
        // áudio bloqueado antes de qualquer clique: fica só a tela
      }
    };
    tocar();
    const intervalo = setInterval(tocar, recebendo ? 2_500 : 3_500);
    return () => {
      clearInterval(intervalo);
      void ctx?.close().catch(() => {});
    };
  }, [fase]);

  // cronômetro da chamada
  useEffect(() => {
    if (fase !== "conectada" && fase !== "reconectando") return;
    const intervalo = setInterval(() => setSegundos((s) => s + 1), 1_000);
    return () => clearInterval(intervalo);
  }, [fase]);

  const valor = useMemo<ChamadaContextValue>(
    () => ({ iniciarChamada, emChamada: chamada !== null }),
    [iniciarChamada, chamada]
  );

  return (
    <ChamadaContext.Provider value={valor}>
      {children}
      {aviso && (
        <div
          role="status"
          className="fixed left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2 text-sm text-white shadow-lg"
          style={{ top: "calc(1rem + env(safe-area-inset-top, 0px))", maxWidth: "calc(100vw - 2rem)" }}
        >
          {aviso}
        </div>
      )}
      {chamada && (
        <TelaChamada
          chamada={chamada}
          localStream={localStream}
          remoteStream={remoteStream}
          mudo={mudo}
          semCamera={semCamera}
          segundos={segundos}
          onAtender={() => void atender()}
          onRecusar={recusar}
          onEncerrar={encerrar}
          onAlternarMudo={alternarMudo}
          onAlternarCamera={alternarCamera}
        />
      )}
    </ChamadaContext.Provider>
  );
}
