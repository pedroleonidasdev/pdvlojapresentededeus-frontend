"use client";

import { BellRing, X } from "lucide-react";

export interface AvisoChat {
  /** identifica o aviso na tela (um por contato: mensagem nova do mesmo contato substitui o aviso) */
  chave: string;
  contatoId: number;
  nome: string;
  previa: string;
  hora: string;
  online: boolean;
}

/**
 * Pop-up de "nova mensagem" bem visível, no topo da tela: cartão verde escuro com brilho dourado
 * pulsando, sino balançando e texto grande. Fica 20 segundos (a barrinha de baixo é o cronômetro;
 * passar o mouse por cima pausa). Clicar no cartão abre a conversa.
 */
export default function AvisosMensagem({
  avisos,
  onAbrir,
  onFechar,
}: {
  avisos: AvisoChat[];
  onAbrir: (contatoId: number) => void;
  onFechar: (chave: string) => void;
}) {
  if (avisos.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      className="pointer-events-none fixed right-3 z-[60] flex w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-3 sm:right-5"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      {avisos.map((a) => (
        <div
          key={a.chave}
          role="alert"
          className="aviso-chat aviso-chat-brilho group pointer-events-auto relative overflow-hidden rounded-3xl border-2 border-accent bg-gradient-to-br from-primary via-primary to-primary-dark text-white"
        >
          <button
            type="button"
            onClick={() => onAbrir(a.contatoId)}
            className="flex w-full items-start gap-3.5 py-4 pl-4 pr-11 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
          >
            <span className="relative shrink-0">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-extrabold ring-2 ring-white/40">
                {a.nome.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="aviso-chat-sino absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-white shadow-lg ring-2 ring-primary-dark">
                <BellRing className="h-4 w-4" strokeWidth={2.5} />
              </span>
              {a.online && (
                <span aria-hidden className="absolute -left-1 -top-1 flex h-3.5 w-3.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-primary-dark" />
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                Nova mensagem
                <span className="font-sans text-xs normal-case tracking-normal text-white/70">{a.hora}</span>
              </span>
              <span className="mt-1 block truncate text-lg font-extrabold leading-tight">{a.nome}</span>
              <span className="mt-1 block line-clamp-3 break-words text-[15px] leading-snug text-white/90">{a.previa}</span>
              <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-bold text-primary-dark shadow-md transition-transform group-hover:scale-105">
                Responder
                <span aria-hidden>→</span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFechar(a.chave)}
            aria-label={`Dispensar aviso de ${a.nome}`}
            className="absolute right-2.5 top-2.5 rounded-xl p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
          >
            <X className="h-5 w-5" />
          </button>

          {/* cronômetro: quando a barra acaba, o aviso some */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
            <span
              className="aviso-chat-barra block h-full origin-left bg-accent group-hover:[animation-play-state:paused]"
              onAnimationEnd={() => onFechar(a.chave)}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
