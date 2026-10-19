"use client";

import { useEffect } from "react";
import { Loader2, Trash2 } from "lucide-react";
import type { Despesa } from "@/lib/types";

export default function ConfirmarExclusao({
  despesa,
  moeda,
  excluindo,
  onCancelar,
  onConfirmar,
}: {
  despesa: Despesa;
  moeda: (v: number) => string;
  excluindo: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape" && !excluindo) onCancelar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onCancelar, excluindo]);

  const titulo = despesa.fornecedor || despesa.descricao;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-excluir"
        aria-describedby="texto-excluir"
        className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-light text-danger">
          <Trash2 className="h-5 w-5" aria-hidden />
        </span>
        <h3 id="titulo-excluir" className="mt-3 text-base font-semibold">
          Excluir “{titulo}”?
        </h3>
        <p id="texto-excluir" className="mt-1 text-sm text-muted">
          Lançamento de {moeda(despesa.valor)}
          {despesa.parcelas.length > 0 ? `, com ${despesa.parcelas.length} parcelas` : ""}. Isso não pode ser desfeito.
          {despesa.tipo !== "DESPESA" && " Se o caixa já foi fechado, a exclusão pode ser recusada."}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onCancelar}
            disabled={excluindo}
            className="rounded-lg px-4 py-2 text-sm text-muted transition hover:bg-background disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={excluindo}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {excluindo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Excluir lançamento
          </button>
        </div>
      </div>
    </div>
  );
}
