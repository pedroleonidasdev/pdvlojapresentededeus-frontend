"use client";

import { useState } from "react";

const VISIVEIS = 6;

/** Para onde foi o dinheiro: clicar numa categoria filtra os lançamentos do período. */
export default function PorCategoria({
  categorias,
  total,
  moeda,
  ativa,
  onEscolher,
}: {
  categorias: [string, number][];
  total: number;
  moeda: (v: number) => string;
  ativa: string | null;
  onEscolher: (categoria: string | null) => void;
}) {
  const [verTodas, setVerTodas] = useState(false);
  const lista = verTodas ? categorias : categorias.slice(0, VISIVEIS);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-medium text-muted">Despesas por categoria</h3>

      {categorias.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nenhuma despesa lançada neste período.</p>
      ) : (
        <>
          <ul className="mt-3 space-y-1">
            {lista.map(([categoria, valor]) => {
              const pct = total > 0 ? (valor / total) * 100 : 0;
              const marcada = ativa === categoria;
              return (
                <li key={categoria}>
                  <button
                    type="button"
                    onClick={() => onEscolher(marcada ? null : categoria)}
                    aria-pressed={marcada}
                    title={marcada ? "Remover filtro" : `Ver os lançamentos de ${categoria}`}
                    className={`w-full rounded-lg px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-primary ${
                      marcada ? "bg-primary-light" : "hover:bg-background"
                    } ${ativa && !marcada ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate">{categoria}</span>
                      <span className="shrink-0 tabular-nums">
                        {moeda(valor)} <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                      </span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-background">
                      <span className="block h-full rounded-full bg-secondary/70" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {categorias.length > VISIVEIS && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              className="mt-2 rounded-md px-2 py-1 text-sm text-primary hover:bg-primary-light"
            >
              {verTodas ? "Mostrar menos" : `Ver todas (${categorias.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
