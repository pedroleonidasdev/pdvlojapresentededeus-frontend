"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Loader2, Pause, Play } from "lucide-react";
import api from "@/lib/api";

interface Props {
  mensagemId: number;
  duracao: number;
  minha: boolean;
}

type Estado = "carregando" | "pronto" | "expirado" | "erro";

// só um áudio toca por vez
let tocandoAgora: HTMLAudioElement | null = null;

function formatar(total: number): string {
  const t = Math.max(0, Math.round(total));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * Player de mensagem de voz. O áudio é baixado com o token (um <audio src> comum
 * não envia o login) e tocado a partir de um arquivo local.
 */
export default function MensagemAudio({ mensagemId, duracao, minha }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("carregando");
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let cancelado = false;
    let objeto: string | null = null;
    (async () => {
      try {
        const { data } = await api.get<Blob>(`/suporte/audios/${mensagemId}`, { responseType: "blob" });
        if (cancelado) return;
        objeto = URL.createObjectURL(data);
        setUrl(objeto);
        setEstado("pronto");
      } catch (e) {
        if (cancelado) return;
        setEstado(axios.isAxiosError(e) && e.response?.status === 404 ? "expirado" : "erro");
      }
    })();
    return () => {
      cancelado = true;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [mensagemId]);

  function alternar() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (tocandoAgora && tocandoAgora !== audio) tocandoAgora.pause();
      tocandoAgora = audio;
      audio.play().catch(() => setEstado("erro"));
    } else {
      audio.pause();
    }
  }

  function buscar(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || estado !== "pronto") return;
    const caixa = e.currentTarget.getBoundingClientRect();
    const proporcao = Math.min(1, Math.max(0, (e.clientX - caixa.left) / caixa.width));
    audio.currentTime = proporcao * duracao;
    setPosicao(audio.currentTime);
  }

  if (estado === "expirado") {
    return <p className="text-xs italic opacity-80">🎤 Áudio expirado ({formatar(duracao)})</p>;
  }
  if (estado === "erro") {
    return <p className="text-xs italic opacity-80">🎤 Não foi possível carregar ou tocar este áudio ({formatar(duracao)})</p>;
  }

  const progresso = duracao > 0 ? Math.min(100, (posicao / duracao) * 100) : 0;

  return (
    <div className="flex w-52 items-center gap-2">
      <button
        onClick={alternar}
        disabled={estado !== "pronto"}
        aria-label={tocando ? "Pausar áudio" : "Tocar áudio"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-60 ${
          minha ? "bg-white/20 hover:bg-white/30" : "bg-primary text-white hover:bg-primary-dark"
        }`}
      >
        {estado === "carregando" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : tocando ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
      <div className="flex-1">
        <div
          onClick={buscar}
          className={`h-1.5 cursor-pointer rounded-full ${minha ? "bg-white/30" : "bg-border"}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={duracao}
          aria-valuenow={Math.round(posicao)}
        >
          <div className={`h-full rounded-full ${minha ? "bg-white" : "bg-primary"}`} style={{ width: `${progresso}%` }} />
        </div>
        <p className="mt-1 text-[11px] tabular-nums opacity-80">
          {tocando || posicao > 0 ? `${formatar(posicao)} / ${formatar(duracao)}` : formatar(duracao)}
        </p>
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          onPlay={() => setTocando(true)}
          onPause={() => setTocando(false)}
          onEnded={() => {
            setTocando(false);
            setPosicao(0);
          }}
          onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
          onError={() => setEstado("erro")}
        />
      )}
    </div>
  );
}
