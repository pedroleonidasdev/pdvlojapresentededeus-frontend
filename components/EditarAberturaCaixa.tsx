"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { Caixa } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import { Loader2, Pencil, X } from "lucide-react";

/**
 * Botão (lápis) + janela para corrigir o valor de abertura do caixa quando foi
 * digitado errado. Só vale para caixa aberto; o backend guarda o valor original,
 * quem corrigiu e quando, e avisa os administradores.
 */
export default function EditarAberturaCaixa({
  caixa,
  onAtualizado,
  className = "",
  rotulo,
}: {
  caixa: Caixa;
  onAtualizado: (caixa: Caixa) => void;
  className?: string;
  /** Texto ao lado do lápis (opcional); sem texto fica só o ícone. */
  rotulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);

  function abrir() {
    setValor(String(caixa.valorInicial).replace(".", ","));
    setErro(null);
    setAberto(true);
  }

  const novoValor = Number(valor.replace(",", "."));
  const valido = valor.trim() !== "" && !Number.isNaN(novoValor) && novoValor >= 0;
  const mudou = valido && Math.abs(novoValor - caixa.valorInicial) > 0.001;

  async function salvar() {
    if (!mudou || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.patch<Caixa>(`/caixa/${caixa.id}/valor-inicial`, { valorInicial: novoValor });
      onAtualizado(data);
      setAberto(false);
    } catch (e: unknown) {
      setErro(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Não foi possível corrigir o valor de abertura."
      );
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Corrigir o valor de abertura do caixa"
        aria-label="Corrigir o valor de abertura do caixa"
        className={`inline-flex items-center gap-1 rounded-md p-1 transition hover:bg-black/10 ${className}`}
      >
        <Pencil className="w-3 h-3" />
        {rotulo && <span>{rotulo}</span>}
      </button>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[70] no-print">
            <div className="bg-surface text-foreground rounded-2xl w-full max-w-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="font-semibold text-sm">Corrigir valor de abertura</h2>
                  <p className="text-xs text-muted mt-0.5">Atual: {formatarMoeda(caixa.valorInicial)}</p>
                </div>
                <button
                  onClick={() => setAberto(false)}
                  className="p-1 rounded-md hover:bg-background text-muted"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                <label className="block text-xs font-medium text-muted">
                  Valor correto da abertura (R$)
                  <input
                    autoFocus
                    inputMode="decimal"
                    className="input mt-1.5 text-lg"
                    value={valor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^[0-9]*[.,]?[0-9]*$/.test(v)) setValor(v);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && salvar()}
                  />
                </label>

                {mudou && (
                  <p className="text-xs text-muted bg-background rounded-lg px-3 py-2">
                    De <strong>{formatarMoeda(caixa.valorInicial)}</strong> para{" "}
                    <strong>{formatarMoeda(novoValor)}</strong>. A correção fica registrada e os administradores
                    são avisados.
                  </p>
                )}
                {caixa.valorInicialOriginal !== null && (
                  <p className="text-xs text-muted">
                    Já corrigido antes — valor digitado originalmente: {formatarMoeda(caixa.valorInicialOriginal)}.
                  </p>
                )}
                {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{erro}</p>}
              </div>

              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => setAberto(false)}
                  className="border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={!mudou || salvando}
                  className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar correção
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
