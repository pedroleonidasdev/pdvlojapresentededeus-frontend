"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface FiltroCheckboxOpcao<T extends string | number> {
  valor: T;
  rotulo: string;
}

/**
 * Filtro de múltipla escolha por checkbox, no estilo do filtro de coluna do
 * Excel: um botão que abre uma lista com "Selecionar todos" no topo e um
 * checkbox por opção. `selecionados === null` significa "todos" (sem
 * filtro) — é o estado inicial, antes do usuário desmarcar algo.
 */
export default function FiltroCheckbox<T extends string | number>({
  label,
  opcoes,
  selecionados,
  onChange,
}: {
  label: string;
  opcoes: FiltroCheckboxOpcao<T>[];
  selecionados: Set<T> | null;
  onChange: (novo: Set<T> | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const estaMarcado = (valor: T) => selecionados === null || selecionados.has(valor);
  const todosMarcados = selecionados === null || selecionados.size === opcoes.length;
  const nenhumMarcado = selecionados !== null && selecionados.size === 0;

  function alternarTodos() {
    onChange(todosMarcados ? new Set() : null);
  }

  function alternarItem(valor: T) {
    // parte de "todos selecionados" (null) — desmarcar um vira "todos menos esse"
    const atual = selecionados === null ? new Set(opcoes.map((o) => o.valor)) : new Set(selecionados);
    if (atual.has(valor)) {
      atual.delete(valor);
    } else {
      atual.add(valor);
    }
    onChange(atual.size === opcoes.length ? null : atual);
  }

  const quantidadeTexto = todosMarcados
    ? "Todas"
    : nenhumMarcado
      ? "Nenhuma"
      : `${selecionados!.size} de ${opcoes.length}`;

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-muted mb-1.5">{label}</label>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="input flex items-center justify-between gap-2 min-w-[160px] text-left"
      >
        <span className="truncate">{quantidadeTexto}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && (
        <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
          <button
            type="button"
            onClick={alternarTodos}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background transition border-b border-border font-medium"
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                todosMarcados ? "bg-primary border-primary text-white" : "border-border"
              }`}
            >
              {todosMarcados && <Check className="w-3 h-3" />}
            </span>
            Selecionar todos
          </button>

          {opcoes.map((opcao) => {
            const marcado = estaMarcado(opcao.valor);
            return (
              <button
                key={opcao.valor}
                type="button"
                onClick={() => alternarItem(opcao.valor)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-background transition"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    marcado ? "bg-primary border-primary text-white" : "border-border"
                  }`}
                >
                  {marcado && <Check className="w-3 h-3" />}
                </span>
                <span className="truncate">{opcao.rotulo}</span>
              </button>
            );
          })}

          {opcoes.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted">Nenhuma opção disponível.</p>
          )}
        </div>
      )}
    </div>
  );
}
