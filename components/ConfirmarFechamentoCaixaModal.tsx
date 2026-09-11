"use client";

import { formatarMoeda } from "@/lib/format";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * Passo de confirmação explícito antes de fechar o caixa. Existe porque é um
 * erro comum confundir "valor final" com o faturamento do dia — aqui pra
 * TODOS os perfis (CAIXA e ADMIN), em qualquer tela que feche caixa.
 *
 * Regra: o valor informado é só o dinheiro físico (cédulas e moedas) contado
 * na gaveta. Vendas em PIX, cartão de crédito e cartão de débito NÃO entram
 * nesse valor — elas não passam pela gaveta.
 */
export default function ConfirmarFechamentoCaixaModal({
  valor,
  confirmando,
  erro,
  onCancelar,
  onConfirmar,
}: {
  valor: number;
  confirmando: boolean;
  erro?: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-danger">
            <AlertTriangle className="w-4 h-4" />
            Confirme antes de fechar o caixa
          </h2>
          <button onClick={onCancelar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg bg-danger-light px-4 py-3 text-center">
            <p className="text-[11px] text-danger uppercase tracking-wide font-medium">
              Valor que você vai registrar
            </p>
            <p className="text-2xl font-bold font-mono text-danger mt-0.5">{formatarMoeda(valor)}</p>
          </div>

          <div className="text-sm text-foreground space-y-2">
            <p>
              Esse valor tem que ser <strong>somente o dinheiro em espécie</strong> (cédulas e moedas)
              contado agora, fisicamente, dentro da gaveta.
            </p>
            <p className="text-muted">
              <strong>Não</strong> é o faturamento do dia e <strong>não</strong> inclui vendas em PIX,
              cartão de crédito ou cartão de débito — esse dinheiro não passa pela gaveta.
            </p>
          </div>

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onCancelar}
            disabled={confirmando}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-background transition disabled:opacity-50"
          >
            Voltar e conferir
          </button>
          <button
            onClick={onConfirmar}
            disabled={confirmando}
            className="flex-1 flex items-center justify-center gap-2 bg-danger hover:opacity-90 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {confirmando && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar valor em espécie
          </button>
        </div>
      </div>
    </div>
  );
}
