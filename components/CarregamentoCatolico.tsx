"use client";

import { useEffect, useState } from "react";

/**
 * Carregamento temático católico — uma "barra de terço": um fio dourado com
 * contas que vão se acendendo uma a uma até a cruz. Usado em todo lugar que
 * espera algo (abrir página, buscar dados, entrar no sistema, atualizar).
 *
 * - <BarraCarregamento />  a barra em si. Sem `progresso` ela é indeterminada
 *   (as contas acendem em sequência, como quem reza o terço); com `progresso`
 *   (0–100) as contas acendem conforme o avanço real.
 * - <CarregandoSecao />    bloco para dentro de uma página/modal.
 * - <TelaCarregamento />   tela cheia (abrir o sistema, redirecionar).
 * - <OracaoRotativa />     frases curtas que se alternam sob a barra.
 *
 * Os estilos (.conta, .barra-indeterminada...) ficam em app/globals.css.
 */

const ORACOES = [
  "Ave Maria, cheia de graça…",
  "Louvado seja Nosso Senhor Jesus Cristo",
  "São Miguel Arcanjo, defendei-nos",
  "Senhor, abençoai o nosso trabalho",
  "Nossa Senhora, rogai por nós",
];

const TOTAL_CONTAS = 10;

export function CruzIcone({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6z" />
    </svg>
  );
}

export function OracaoRotativa({ escuro = false, className = "" }: { escuro?: boolean; className?: string }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => setIndice((i) => (i + 1) % ORACOES.length), 3500);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <p
      key={indice}
      className={`oracao-fade text-xs italic text-center ${escuro ? "text-accent-light/80" : "text-muted"} ${className}`}
    >
      {ORACOES[indice]}
    </p>
  );
}

export function BarraCarregamento({
  progresso,
  escuro = false,
  className = "",
}: {
  /** 0–100. Omitido = indeterminada (animação contínua). */
  progresso?: number;
  /** Versão para fundo verde-escuro. */
  escuro?: boolean;
  className?: string;
}) {
  const determinada = typeof progresso === "number";
  const p = determinada ? Math.max(0, Math.min(100, progresso)) : 0;

  return (
    <div
      role="progressbar"
      aria-busy={p < 100}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinada ? Math.round(p) : undefined}
      aria-label="Carregando"
      className={`flex items-center gap-2 w-full ${escuro ? "barra-escura" : ""} ${className}`}
    >
      <div className="relative flex-1 h-3 flex items-center">
        {/* fio do terço */}
        <div
          className={`absolute inset-x-0 h-1.5 rounded-full overflow-hidden ${escuro ? "bg-white/20" : "bg-border/50"}`}
        >
          {determinada ? (
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-dark via-accent to-accent-light transition-all duration-300 ease-out"
              style={{ width: `${p}%` }}
            />
          ) : (
            <div className="barra-indeterminada h-full w-2/5 rounded-full bg-gradient-to-r from-accent-dark via-accent to-accent-light" />
          )}
        </div>

        {/* contas */}
        <div className="relative w-full flex items-center justify-between">
          {Array.from({ length: TOTAL_CONTAS }, (_, i) => {
            const acesa = determinada && p > 0 && p >= (i / (TOTAL_CONTAS - 1)) * 100;
            return (
              <span
                key={i}
                className={`conta ${determinada ? (acesa ? "conta-acesa" : "") : "conta-pulsa"}`}
                style={determinada ? undefined : { animationDelay: `${i * 0.2}s` }}
              />
            );
          })}
        </div>
      </div>

      {/* cruz no final do terço */}
      <CruzIcone
        className={`w-4 h-4 shrink-0 ${escuro ? "text-accent" : "text-accent-dark"} ${p >= 100 ? "drop-shadow-[0_0_6px_rgba(224,151,47,0.8)]" : ""}`}
      />
    </div>
  );
}

/** Bloco de carregamento para dentro de uma página, lista ou janela. */
export function CarregandoSecao({
  mensagem = "Carregando…",
  className = "py-16",
}: {
  mensagem?: string;
  /** Sobrescreve o espaçamento/altura padrão (py-16). Ex.: "h-full". */
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 px-6 ${className}`}>
      <BarraCarregamento className="max-w-[16rem]" />
      <p className="text-sm font-medium text-primary">{mensagem}</p>
      <OracaoRotativa />
    </div>
  );
}

/** Tela cheia: abertura do sistema, validação de sessão, redirecionamentos. */
export function TelaCarregamento({ mensagem = "Abrindo o sistema…" }: { mensagem?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen flex flex-col items-center justify-center gap-6 bg-primary-dark text-white px-6"
    >
      <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-accent shadow-lg shadow-black/30 animate-icon-glow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-loja.jpg" alt="Presente de Deus" className="w-full h-full object-cover" />
      </div>
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">Loja</p>
        <p className="font-semibold text-xl leading-tight">Presente de Deus</p>
      </div>
      <BarraCarregamento escuro className="max-w-xs" />
      <div className="text-center space-y-1.5">
        <p className="text-sm text-white/85">{mensagem}</p>
        <OracaoRotativa escuro />
      </div>
    </div>
  );
}
