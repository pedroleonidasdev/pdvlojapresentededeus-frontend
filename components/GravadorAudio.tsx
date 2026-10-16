"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";

export const MAX_SEGUNDOS_AUDIO = 120;

// mp4 primeiro: é o formato que toca em todos os navegadores (inclusive iPhone)
const TIPOS = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

interface Props {
  onEnviar: (audio: Blob, segundos: number) => void;
  onCancelar: () => void;
  onErro: (mensagem: string) => void;
}

function formatar(total: number): string {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Barra de gravação: começa a gravar ao aparecer; enviar ou descartar encerra e libera o microfone. */
export default function GravadorAudio({ onEnviar, onCancelar, onErro }: Props) {
  const [segundos, setSegundos] = useState(0);

  const gravadorRef = useRef<MediaRecorder | null>(null);
  const descartarRef = useRef(false);
  const onEnviarRef = useRef(onEnviar);
  const onCancelarRef = useRef(onCancelar);
  const onErroRef = useRef(onErro);

  useEffect(() => {
    onEnviarRef.current = onEnviar;
    onCancelarRef.current = onCancelar;
    onErroRef.current = onErro;
  });

  useEffect(() => {
    let encerrado = false;
    let stream: MediaStream | null = null;
    let relogio: ReturnType<typeof setInterval> | null = null;

    function pararTudo() {
      if (relogio) clearInterval(relogio);
      relogio = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    async function iniciar() {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        onErroRef.current("Este navegador não permite gravar áudio.");
        onCancelarRef.current();
        return;
      }
      try {
        const midia = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (encerrado) {
          midia.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = midia;

        const tipo = TIPOS.find((t) => MediaRecorder.isTypeSupported(t));
        const gravador = new MediaRecorder(midia, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 24_000 });
        const partes: Blob[] = [];
        const inicio = Date.now();

        gravador.ondataavailable = (ev) => {
          if (ev.data.size > 0) partes.push(ev.data);
        };
        gravador.onstop = () => {
          pararTudo();
          if (descartarRef.current || partes.length === 0) return;
          const duracao = Math.min(MAX_SEGUNDOS_AUDIO, Math.max(1, Math.round((Date.now() - inicio) / 1000)));
          onEnviarRef.current(new Blob(partes, { type: gravador.mimeType || tipo || "audio/webm" }), duracao);
        };
        gravador.start();
        gravadorRef.current = gravador;

        relogio = setInterval(() => {
          const decorrido = Math.floor((Date.now() - inicio) / 1000);
          setSegundos(decorrido);
          if (decorrido >= MAX_SEGUNDOS_AUDIO && gravador.state !== "inactive") gravador.stop(); // no limite, envia
        }, 250);
      } catch (e) {
        if (encerrado) return;
        const negado = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError");
        onErroRef.current(negado ? "Permita o uso do microfone no navegador para gravar áudio." : "Não foi possível gravar o áudio.");
        onCancelarRef.current();
      }
    }

    void iniciar();

    return () => {
      // saiu da tela (fechou o chat, trocou de conversa): descarta e solta o microfone
      encerrado = true;
      descartarRef.current = true;
      const g = gravadorRef.current;
      if (g && g.state !== "inactive") g.stop();
      pararTudo();
    };
  }, []);

  function enviar() {
    const g = gravadorRef.current;
    if (g && g.state !== "inactive") g.stop();
  }

  function descartar() {
    descartarRef.current = true;
    const g = gravadorRef.current;
    if (g && g.state !== "inactive") g.stop();
    onCancelar();
  }

  return (
    <div className="flex items-center gap-3 border-t border-border bg-surface p-3">
      <button
        onClick={descartar}
        aria-label="Descartar gravação"
        title="Descartar"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-danger transition hover:bg-danger-light"
      >
        <Trash2 className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center gap-2" role="timer" aria-live="off">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
        <span className="font-mono text-sm tabular-nums">{formatar(segundos)}</span>
        <span className="text-xs text-muted">/ {formatar(MAX_SEGUNDOS_AUDIO)}</span>
      </div>
      <button
        onClick={enviar}
        aria-label="Enviar áudio"
        title="Enviar áudio"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary-dark"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
