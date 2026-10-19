"use client";

/**
 * Demonstrativo do período: vendas menos despesas dá o lucro estimado. Sangria e
 * suprimento ficam à parte porque só trocam o dinheiro de lugar (caixa ⇄ banco/bolso).
 */
export default function ResultadoPeriodo({
  faturamento,
  despesas,
  sangrias,
  suprimentos,
  moeda,
}: {
  faturamento: number;
  despesas: number;
  sangrias: number;
  suprimentos: number;
  moeda: (v: number) => string;
}) {
  const lucro = faturamento - despesas;
  const margem = faturamento > 0 ? Math.round((lucro / faturamento) * 100) : null;
  const positivo = lucro >= 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h3 className="text-sm font-medium text-muted">Resultado</h3>

      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt>Vendas</dt>
          <dd className="font-medium tabular-nums">{moeda(faturamento)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt>Despesas</dt>
          <dd className="font-medium tabular-nums text-danger">− {moeda(despesas)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <dt className="font-medium">
            Lucro estimado
            {margem !== null && (
              <span className={`ml-2 text-xs font-normal ${positivo ? "text-success" : "text-danger"}`}>
                {margem}% das vendas
              </span>
            )}
          </dt>
          <dd className={`text-xl font-semibold tabular-nums ${positivo ? "text-success" : "text-danger"}`}>
            {moeda(lucro)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-lg bg-background px-3 py-2.5">
        <p className="text-xs font-medium text-muted">Movimento do caixa (fora do lucro)</p>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>
            <span className="text-muted">Retiradas (sangrias) </span>
            <span className="font-medium tabular-nums text-danger">− {moeda(sangrias)}</span>
          </span>
          <span>
            <span className="text-muted">Reforços (suprimentos) </span>
            <span className="font-medium tabular-nums text-info">+ {moeda(suprimentos)}</span>
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Só mudam o dinheiro de lugar, entre o caixa e o banco ou o bolso. Não são custos nem vendas.
        </p>
      </div>
    </div>
  );
}
