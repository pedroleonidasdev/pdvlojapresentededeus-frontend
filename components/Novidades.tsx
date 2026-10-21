"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { formatarDataISO } from "@/lib/format";
import {
  EVENTO_ABRIR_NOVIDADES,
  ID_NOVIDADE_MAIS_NOVA,
  NOVIDADES,
  marcarNovidadesVistas,
  temNovidadeNaoVista,
} from "@/lib/novidades";

/**
 * Caixa "Novidades": lista o que mudou no sistema.
 * - Abre sozinha uma vez por atualização (para quem ainda não viu a novidade mais recente).
 * - Pode ser reaberta a qualquer momento pelo botão "Novidades" do menu.
 */
export default function Novidades() {
  const [aberta, setAberta] = useState(false);
  // o que era novidade quando a caixa abriu (para marcar com "NOVO" mesmo depois de registrar que foi vista)
  const [naoVistaAoAbrir, setNaoVistaAoAbrir] = useState(false);

  const abrir = useCallback(() => {
    setNaoVistaAoAbrir(temNovidadeNaoVista());
    setAberta(true);
  }, []);

  const fechar = useCallback(() => {
    setAberta(false);
    marcarNovidadesVistas();
  }, []);

  // abre sozinha se houver novidade não vista (com uma pequena espera para o painel terminar de carregar)
  useEffect(() => {
    if (!temNovidadeNaoVista()) return;
    const t = setTimeout(abrir, 800);
    return () => clearTimeout(t);
  }, [abrir]);

  // botão do menu
  useEffect(() => {
    window.addEventListener(EVENTO_ABRIR_NOVIDADES, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_NOVIDADES, abrir);
  }, [abrir]);

  // Esc fecha
  useEffect(() => {
    if (!aberta) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberta, fechar]);

  if (!aberta || NOVIDADES.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-primary-dark/60 backdrop-blur-sm p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-novidades"
      onClick={fechar}
    >
      <div
        className="relative w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-primary via-accent to-secondary" />

        <div className="flex items-start gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-dark">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-novidades" className="text-lg font-semibold text-foreground leading-tight">
              Novidades do sistema
            </h2>
            <p className="text-xs text-muted mt-0.5">Veja o que mudou nas últimas atualizações.</p>
          </div>
          <button
            onClick={fechar}
            aria-label="Fechar"
            className="p-1.5 -mr-1.5 rounded-lg text-muted hover:bg-background hover:text-foreground transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-2 space-y-3">
          {NOVIDADES.map((n) => {
            const ehNova = naoVistaAoAbrir && n.id === ID_NOVIDADE_MAIS_NOVA;
            return (
              <section
                key={n.id}
                className={`rounded-xl border px-4 py-3 ${
                  ehNova ? "border-accent bg-accent-light/50" : "border-border bg-background/60"
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{n.titulo}</h3>
                  {ehNova && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-dark">
                      Novo
                    </span>
                  )}
                  <span className="ml-auto text-[11px] font-mono text-muted">{formatarDataISO(n.data)}</span>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {n.itens.map((item, idx) => (
                    <li key={idx} className="flex gap-2 text-[13px] leading-snug text-foreground">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="px-5 py-4 shrink-0">
          <button
            onClick={fechar}
            autoFocus
            className="w-full rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:brightness-110 active:scale-[0.99]"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
