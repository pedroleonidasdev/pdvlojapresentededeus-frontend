"use client";

import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import BarcodeSvg from "@/components/BarcodeSvg";
import { X, Printer } from "lucide-react";

/**
 * Tela de etiquetas para impressão: cada produto selecionado vira uma etiqueta
 * (nome + preço + código de barras) empilhada na largura da bobina de 80mm,
 * para cortar uma a uma depois de impresso.
 */
export default function FolhaEtiquetas({
  produtos,
  onFechar,
}: {
  produtos: Produto[];
  onFechar: () => void;
}) {
  const comCodigo = produtos.filter((p) => p.codigoBarras);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border no-print">
          <h2 className="font-semibold text-sm">
            Etiquetas para impressão ({comCodigo.length})
          </h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {comCodigo.length < produtos.length && (
          <p className="text-xs text-muted px-5 pt-3 no-print">
            {produtos.length - comCodigo.length} produto(s) selecionado(s) ainda não têm código
            de barras e não vão aparecer aqui. Use &quot;Gerar códigos faltantes&quot; primeiro.
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          <div className="receipt-print space-y-3">
            {comCodigo.map((produto) => (
              <div key={produto.id} className="text-center border-b border-dashed border-border pb-3 last:border-0">
                <p className="text-xs font-medium leading-tight px-1">{produto.nome}</p>
                <p className="text-xs font-mono">{formatarMoeda(produto.precoVenda)}</p>
                <BarcodeSvg valor={produto.codigoBarras!} className="mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-border no-print">
          <button
            onClick={() => window.print()}
            disabled={comCodigo.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir {comCodigo.length} etiqueta{comCodigo.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
