"use client";

import { CheckCircle2 } from "lucide-react";

export type FiltroFaixa = "VENCIDO" | "SEMANA" | "DEPOIS" | "SEM_DATA";

export interface TotaisAPagar {
  total: number;
  contas: number;
  vencido: { valor: number; contas: number };
  semana: { valor: number; contas: number };
  depois: { valor: number; contas: number };
  semData: { valor: number; contas: number };
}

const ITENS: { id: FiltroFaixa; chave: "vencido" | "semana" | "depois" | "semData"; rotulo: string; cor: string }[] = [
  { id: "VENCIDO", chave: "vencido", rotulo: "Vencido", cor: "bg-danger" },
  { id: "SEMANA", chave: "semana", rotulo: "Vence em até 7 dias", cor: "bg-accent" },
  { id: "DEPOIS", chave: "depois", rotulo: "Mais adiante", cor: "bg-info" },
  { id: "SEM_DATA", chave: "semData", rotulo: "Sem data", cor: "bg-muted/50" },
];

/**
 * Primeira coisa da tela: quanto falta pagar e quando. A barra mostra a
 * proporção por prazo, e cada faixa é um botão que filtra a lista logo abaixo.
 */
export default function ResumoAPagar({
  totais,
  moeda,
  faixaAtiva,
  onFiltrar,
}: {
  totais: TotaisAPagar;
  moeda: (v: number) => string;
  faixaAtiva: FiltroFaixa | null;
  onFiltrar: (faixa: FiltroFaixa | null) => void;
}) {
  const itens = ITENS.filter((i) => i.id !== "SEM_DATA" || totais.semData.valor > 0);

  return (
    <section aria-labelledby="titulo-falta-pagar" className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="titulo-falta-pagar" className="text-sm font-medium text-muted">
            Falta pagar
          </h3>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{moeda(totais.total)}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {totais.contas === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                Nenhuma conta em aberto. Tudo em dia.
              </>
            ) : (
              `${totais.contas} ${totais.contas === 1 ? "conta em aberto" : "contas em aberto"}`
            )}
          </p>
        </div>
        {faixaAtiva && (
          <button
            type="button"
            onClick={() => onFiltrar(null)}
            className="rounded-md px-2 py-1 text-sm text-primary hover:bg-primary-light focus-visible:outline-2 focus-visible:outline-primary"
          >
            Mostrar todas
          </button>
        )}
      </div>

      {totais.total > 0 && (
        <>
          <div
            className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-background"
            role="img"
            aria-label="Divisão do valor em aberto por prazo de vencimento"
          >
            {itens.map((i) => {
              const valor = totais[i.chave].valor;
              if (valor <= 0) return null;
              return (
                <div
                  key={i.id}
                  className={`${i.cor} ${faixaAtiva && faixaAtiva !== i.id ? "opacity-30" : ""} transition-opacity`}
                  style={{ width: `${(valor / totais.total) * 100}%`, minWidth: "6px" }}
                />
              );
            })}
          </div>

          <div className={`mt-4 grid grid-cols-2 gap-2 ${itens.length > 3 ? "lg:grid-cols-4" : "sm:grid-cols-3"}`}>
            {itens.map((i) => {
              const { valor, contas } = totais[i.chave];
              const ativo = faixaAtiva === i.id;
              const vazio = valor <= 0;
              return (
                <button
                  key={i.id}
                  type="button"
                  disabled={vazio}
                  aria-pressed={ativo}
                  onClick={() => onFiltrar(ativo ? null : i.id)}
                  title={vazio ? undefined : ativo ? "Mostrar todas as contas" : `Ver só: ${i.rotulo.toLowerCase()}`}
                  className={`rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default ${
                    ativo
                      ? "border-primary bg-primary-light"
                      : vazio
                        ? "border-border/60 opacity-60"
                        : "border-border hover:border-primary/50 hover:bg-background"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i.cor}`} aria-hidden />
                    {i.rotulo}
                  </span>
                  <span className="mt-1 block text-base font-semibold tabular-nums">{moeda(valor)}</span>
                  <span className="block text-xs text-muted">
                    {contas === 0 ? "nenhuma conta" : `${contas} ${contas === 1 ? "conta" : "contas"}`}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
