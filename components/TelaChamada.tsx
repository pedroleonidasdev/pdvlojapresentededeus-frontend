"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import type { ChamadaAtiva } from "@/components/ChamadaProvider";

interface Props {
  chamada: ChamadaAtiva;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  mudo: boolean;
  semCamera: boolean;
  segundos: number;
  onAtender: () => void;
  onRecusar: () => void;
  onEncerrar: () => void;
  onAlternarMudo: () => void;
  onAlternarCamera: () => void;
}

function formatarTempo(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function rotuloDaFase(chamada: ChamadaAtiva, segundos: number): string {
  switch (chamada.fase) {
    case "iniciando":
      return "Preparando…";
    case "chamando":
      return "Chamando…";
    case "recebendo":
      return chamada.tipo === "VIDEO" ? "Chamada de vídeo" : "Chamada de áudio";
    case "conectando":
      return "Conectando…";
    case "reconectando":
      return "Reconectando…";
    case "conectada":
      return formatarTempo(segundos);
  }
}

export default function TelaChamada({
  chamada,
  localStream,
  remoteStream,
  mudo,
  semCamera,
  segundos,
  onAtender,
  onRecusar,
  onEncerrar,
  onAlternarMudo,
  onAlternarCamera,
}: Props) {
  const remotoVideoRef = useRef<HTMLVideoElement>(null);
  const remotoAudioRef = useRef<HTMLAudioElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const video = chamada.tipo === "VIDEO";
  const recebendo = chamada.fase === "recebendo";
  const emAndamento = chamada.fase === "conectada" || chamada.fase === "reconectando";
  const mostrarVideoRemoto = video && !!remoteStream && emAndamento;

  useEffect(() => {
    if (remotoVideoRef.current) remotoVideoRef.current.srcObject = remoteStream;
    if (remotoAudioRef.current) remotoAudioRef.current.srcObject = remoteStream;
  }, [remoteStream, video]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, mostrarVideoRemoto]);

  const inicial = chamada.outroNome.charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-primary-dark text-white"
      role="dialog"
      aria-label={`Chamada com ${chamada.outroNome}`}
    >
      {/* o som da outra pessoa: <video> escondido não é confiável em todos os navegadores, então áudio usa <audio> */}
      {!video && <audio ref={remotoAudioRef} autoPlay />}

      {video && (
        <video
          ref={remotoVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 h-full w-full bg-black object-cover ${mostrarVideoRemoto ? "" : "invisible"}`}
        />
      )}

      <div
        className="relative z-10 flex flex-col items-center px-4 pt-8 text-center"
        style={{ paddingTop: "calc(2rem + env(safe-area-inset-top, 0px))" }}
      >
        {!mostrarVideoRemoto && (
          <span className="mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-primary-light text-5xl font-semibold text-primary-dark shadow-lg">
            {inicial}
          </span>
        )}
        <p className="max-w-full truncate text-xl font-semibold drop-shadow">{chamada.outroNome}</p>
        <p className="mt-1 text-sm text-white/80 drop-shadow" aria-live="polite">
          {recebendo ? `${rotuloDaFase(chamada, segundos)} recebida` : rotuloDaFase(chamada, segundos)}
        </p>
      </div>

      <div className="flex-1" />

      {/* a própria câmera, pequena no canto */}
      {video && localStream && !recebendo && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`absolute right-4 z-20 h-36 w-28 rounded-xl border border-white/30 bg-black object-cover shadow-lg [transform:scaleX(-1)] sm:h-44 sm:w-32 ${
            semCamera ? "opacity-30" : ""
          }`}
          style={{ bottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))" }}
        />
      )}

      <div
        className="relative z-10 flex items-center justify-center gap-5 px-4 pb-8"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {recebendo ? (
          <>
            <BotaoRedondo rotulo="Recusar" cor="bg-danger hover:opacity-90" onClick={onRecusar}>
              <PhoneOff className="h-6 w-6" />
            </BotaoRedondo>
            <BotaoRedondo rotulo="Atender" cor="bg-success hover:opacity-90" onClick={onAtender}>
              {video ? <Video className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
            </BotaoRedondo>
          </>
        ) : (
          <>
            {chamada.fase !== "iniciando" && (
              <BotaoRedondo
                rotulo={mudo ? "Ativar microfone" : "Silenciar"}
                cor={mudo ? "bg-white text-primary-dark" : "bg-white/20 hover:bg-white/30"}
                onClick={onAlternarMudo}
              >
                {mudo ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </BotaoRedondo>
            )}
            {video && chamada.fase !== "iniciando" && (
              <BotaoRedondo
                rotulo={semCamera ? "Ligar câmera" : "Desligar câmera"}
                cor={semCamera ? "bg-white text-primary-dark" : "bg-white/20 hover:bg-white/30"}
                onClick={onAlternarCamera}
              >
                {semCamera ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </BotaoRedondo>
            )}
            <BotaoRedondo rotulo="Desligar" cor="bg-danger hover:opacity-90" onClick={onEncerrar}>
              <PhoneOff className="h-6 w-6" />
            </BotaoRedondo>
          </>
        )}
      </div>
    </div>
  );
}

function BotaoRedondo({
  rotulo,
  cor,
  onClick,
  children,
}: {
  rotulo: string;
  cor: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition ${cor}`}
    >
      {children}
    </button>
  );
}
