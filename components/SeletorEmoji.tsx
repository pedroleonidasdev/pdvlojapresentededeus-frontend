"use client";

import { useState } from "react";
import { CATEGORIAS_EMOJI, FIGURINHAS_EMOJI, FIGURINHAS_TEXTO } from "@/lib/figurinhas";

interface Props {
  onEmoji: (emoji: string) => void;
  onFigurinha: (conteudo: string) => void;
  desabilitado?: boolean;
}

const CHAVE_RECENTES = "chat_emojis_recentes";
const MAX_RECENTES = 24;

function lerRecentes(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE_RECENTES);
    const lista = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENTES) : [];
  } catch {
    return [];
  }
}

function guardarRecentes(lista: string[]) {
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista));
  } catch {
    // sem localStorage: só não lembra os recentes
  }
}

export default function SeletorEmoji({ onEmoji, onFigurinha, desabilitado = false }: Props) {
  const [aba, setAba] = useState<"emojis" | "figurinhas">("emojis");
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const [categoriaId, setCategoriaId] = useState<string>(() => (lerRecentes().length > 0 ? "recentes" : "carinhas"));

  function escolherEmoji(emoji: string) {
    const novos = [emoji, ...recentes.filter((r) => r !== emoji)].slice(0, MAX_RECENTES);
    setRecentes(novos);
    guardarRecentes(novos);
    onEmoji(emoji);
  }

  const lista =
    categoriaId === "recentes"
      ? recentes
      : (CATEGORIAS_EMOJI.find((c) => c.id === categoriaId) ?? CATEGORIAS_EMOJI[0]).emojis;

  return (
    <div className="border-t border-border bg-surface">
      <div className="flex border-b border-border text-xs font-medium">
        {(["emojis", "figurinhas"] as const).map((id) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex-1 py-2 transition ${
              aba === id ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {id === "emojis" ? "Emojis" : "Figurinhas"}
          </button>
        ))}
      </div>

      {aba === "emojis" ? (
        <>
          <div className="flex gap-0.5 overflow-x-auto border-b border-border px-1.5 py-1">
            {recentes.length > 0 && (
              <button
                onClick={() => setCategoriaId("recentes")}
                title="Recentes"
                aria-label="Recentes"
                className={`shrink-0 rounded-md px-2 py-1 text-lg ${categoriaId === "recentes" ? "bg-primary-light" : "hover:bg-background"}`}
              >
                🕘
              </button>
            )}
            {CATEGORIAS_EMOJI.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoriaId(c.id)}
                title={c.nome}
                aria-label={c.nome}
                className={`shrink-0 rounded-md px-2 py-1 text-lg ${categoriaId === c.id ? "bg-primary-light" : "hover:bg-background"}`}
              >
                {c.icone}
              </button>
            ))}
          </div>
          <div className="grid h-44 grid-cols-8 content-start gap-0.5 overflow-y-auto p-1.5">
            {lista.map((emoji) => (
              <button
                key={emoji}
                onClick={() => escolherEmoji(emoji)}
                className="rounded-md py-1 text-2xl leading-none transition hover:bg-background"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[12.5rem] space-y-2 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-1.5">
            {FIGURINHAS_TEXTO.map((f) => (
              <button
                key={f}
                onClick={() => onFigurinha(f)}
                disabled={desabilitado}
                className="rounded-xl border border-accent/40 bg-accent-light px-2 py-2 text-center text-sm font-semibold transition hover:brightness-95 disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-1">
            {FIGURINHAS_EMOJI.map((f) => (
              <button
                key={f}
                onClick={() => onFigurinha(f)}
                disabled={desabilitado}
                className="rounded-lg py-1 text-3xl leading-none transition hover:bg-background disabled:opacity-50"
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
