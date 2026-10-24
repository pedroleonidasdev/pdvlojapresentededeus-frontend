"use client";

import { MessageCircle, X } from "lucide-react";

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
 * Pop-up de "nova mensagem" no canto da tela. Some sozinho em alguns segundos (a barrinha de baixo
 * é o cronômetro; passar o mouse por cima pausa). Clicar no cartão abre a conversa.
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
      aria-live="polite"
      className="pointer-events-none fixed right-3 z-[60] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2.5 sm:right-4"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      {avisos.map((a) => (
        <div
          key={a.chave}
          role="status"
          className="aviso-chat group pointer-events-auto relative overflow-hidden rounded-2xl border border-white/70 bg-surface/95 shadow-[0_18px_40px_-12px_rgba(15,51,42,0.55)] ring-1 ring-border/50 backdrop-blur"
        >
          {/* faixa de destaque na lateral */}
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-accent via-primary to-primary-dark" />

          <button
            type="button"
            onClick={() => onAbrir(a.contatoId)}
            className="flex w-full items-start gap-3 py-3 pl-4 pr-10 text-left transition-colors hover:bg-primary-soft/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            <span className="relative shrink-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-lg font-bold text-white shadow-lg shadow-primary/30 ring-1 ring-white/30">
                {a.nome.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-dark text-white ring-2 ring-surface">
                <MessageCircle className="h-3 w-3" strokeWidth={2.25} />
              </span>
              {a.online && (
                <span aria-hidden className="absolute -left-0.5 -top-0.5 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface" />
                </span>
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-dark">
                Nova mensagem
                <span className="font-sans normal-case tracking-normal text-muted">{a.hora}</span>
              </span>
              <span className="mt-0.5 block truncate text-sm font-bold leading-tight text-foreground">{a.nome}</span>
              <span className="mt-0.5 block line-clamp-2 break-words text-[13px] leading-snug text-muted">{a.previa}</span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Responder
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onFechar(a.chave)}
            aria-label={`Dispensar aviso de ${a.nome}`}
            className="absolute right-2 top-2 rounded-lg p-1 text-muted transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-4 w-4" />
          </button>

          {/* cronômetro: quando a barra acaba, o aviso some */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border/40">
            <span
              className="aviso-chat-barra block h-full origin-left bg-gradient-to-r from-accent to-primary group-hover:[animation-play-state:paused]"
              onAnimationEnd={() => onFechar(a.chave)}
            />
          </span>
        </div>
      ))}
    </div>
  );
}
