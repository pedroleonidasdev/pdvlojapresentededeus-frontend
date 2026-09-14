"use client";

import { useState } from "react";
import api from "@/lib/api";
import { Venda } from "@/lib/types";
import { paraInputDataHoraLocal, deInputDataHoraLocalParaUtc } from "@/lib/format";
import { X, Loader2, CalendarClock } from "lucide-react";

/**
 * Corrige a data/hora de uma venda já registrada (ex: venda lançada com atraso
 * ou no dia errado). Ação restrita a administrador: o botão que abre este modal
 * só aparece pra ADMIN (ver vendas/page.tsx), e o backend valida de novo via
 * @PreAuthorize — por isso, diferente de EditarFormaPagamentoModal, não há aqui
 * um fluxo de autorização por login/senha para outros perfis.
 */
export default function EditarDataHoraModal({
  venda,
  onFechar,
  onSalvo,
}: {
  venda: Venda;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const valorOriginal = paraInputDataHoraLocal(venda.dataHora);
  const [dataHoraLocal, setDataHoraLocal] = useState(valorOriginal);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/vendas/${venda.id}/data-hora`, {
        dataHora: deInputDataHoraLocalParaUtc(dataHoraLocal),
      });
      onSalvo();
      onFechar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível salvar a alteração.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  const nadaMudou = dataHoraLocal === valorOriginal;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Editar data/hora — Venda #{venda.id}</h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted mb-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              Data e hora (horário de Brasília)
            </label>
            <input
              type="datetime-local"
              value={dataHoraLocal}
              onChange={(e) => setDataHoraLocal(e.target.value)}
              className="input w-full"
            />
          </div>

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-background transition"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || nadaMudou || !dataHoraLocal}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
