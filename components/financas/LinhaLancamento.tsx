"use client";

import { ArrowDownCircle, ArrowUpCircle, CheckCircle2, ChevronDown, Circle, Loader2, Pencil, Trash2 } from "lucide-react";
import type { Despesa } from "@/lib/types";
import { dataBrasiliaISO, LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import {
  descreverVencimento,
  faixaDe,
  formatarDiaMes,
  proximaParcela,
  resumoPagamento,
  vencimentoRelevante,
  type Faixa,
  type TomVencimento,
} from "@/lib/financas";

const TOM: Record<TomVencimento, string> = {
  perigo: "text-danger font-medium",
  atencao: "text-secondary-dark font-medium",
  neutro: "text-muted",
};

// a cor da lateral resume a urgência de relance
const BORDA_FAIXA: Record<Faixa, string> = {
  VENCIDO: "border-l-danger",
  HOJE: "border-l-danger",
  SEMANA: "border-l-accent",
  DEPOIS: "border-l-info",
  SEM_DATA: "border-l-border",
};

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function LinhaLancamento({
  d,
  modo,
  moeda,
  expandido,
  marcando,
  onAlternarExpandido,
  onAlternarPago,
  onAlternarParcela,
  onEditar,
  onExcluir,
}: {
  d: Despesa;
  /** "pagar": lista de contas em aberto. "periodo": tudo que foi registrado no período. */
  modo: "pagar" | "periodo";
  moeda: (v: number) => string;
  expandido: boolean;
  /** Chave do pagamento sendo gravado agora ("12" ou "12-3" para a parcela 3). */
  marcando: string | null;
  onAlternarExpandido: () => void;
  onAlternarPago: (d: Despesa) => void;
  onAlternarParcela: (d: Despesa, numero: number, pagoAtual: boolean) => void;
  onEditar: (d: Despesa) => void;
  onExcluir: (d: Despesa) => void;
}) {
  const ehDespesa = d.tipo === "DESPESA";
  const { parcelado, pagas, total, restante } = resumoPagamento(d);
  const quitado = ehDespesa && pagas === total;
  const venc = vencimentoRelevante(d);
  const prazo = descreverVencimento(venc.data, venc.pago);
  const proxima = parcelado ? proximaParcela(d) : null;
  const atrasada = prazo?.tom === "perigo" && prazo.texto.startsWith("venceu");

  const borda = !ehDespesa
    ? d.tipo === "SANGRIA"
      ? "border-l-danger"
      : "border-l-info"
    : quitado
      ? "border-l-primary"
      : BORDA_FAIXA[faixaDe(d)];

  // na lista de contas a pagar o que importa é a próxima parcela; no período, o total lançado
  const mostraProxima = modo === "pagar" && parcelado && proxima;
  const valorPrincipal = mostraProxima ? proxima.valor : d.valor;
  const legendaValor = mostraProxima
    ? `parcela ${proxima.numero} de ${total}`
    : parcelado
      ? `total em ${total}x`
      : !ehDespesa
        ? d.tipo === "SANGRIA"
          ? "retirada do caixa"
          : "reforço do caixa"
        : null;

  const corValor = d.tipo === "SANGRIA" ? "text-danger" : d.tipo === "SUPRIMENTO" ? "text-info" : "text-foreground";
  const sinal = d.tipo === "SANGRIA" ? "− " : d.tipo === "SUPRIMENTO" ? "+ " : "";

  const forma = LABEL_FORMA_PAGAMENTO[d.formaPagamento] ?? d.formaPagamento;
  const titulo = d.fornecedor || d.descricao;
  const subtitulo = d.fornecedor ? d.descricao : null;
  const chaveAvista = `${d.id}`;

  return (
    <li className={`border-l-4 ${borda} ${atrasada ? "bg-danger-light/40" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5 md:flex-nowrap md:items-center">
        {/* o que é */}
        <div className="min-w-0 basis-full md:flex-1 md:basis-auto">
          <div className="flex items-start gap-2">
            {!ehDespesa &&
              (d.tipo === "SANGRIA" ? (
                <ArrowDownCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Sangria" />
              ) : (
                <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-label="Suprimento" />
              ))}
            <div className="min-w-0">
              <p className="truncate font-medium leading-snug">{titulo}</p>
              {subtitulo && <p className="truncate text-sm text-muted">{subtitulo}</p>}
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {d.categoria && (
              <span className="rounded-md border border-border bg-surface-alt px-1.5 py-0.5 font-medium text-foreground">
                {d.categoria}
              </span>
            )}
            {ehDespesa && <span>{forma}</span>}
            {modo === "periodo" && (
              <span>
                registrado em {formatarDiaMes(dataBrasiliaISO(d.dataHora))} por {d.usuarioNome}
              </span>
            )}
          </div>
          {parcelado && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-background" aria-hidden>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(pagas / total) * 100}%` }} />
              </span>
              {pagas} de {total} pagas{!quitado && <> · restam {moeda(restante)}</>}
            </div>
          )}
        </div>

        {/* quando vence */}
        <div className="min-w-[7.5rem] flex-1 text-sm md:w-36 md:flex-none">
          {ehDespesa && !quitado && venc.data ? (
            <>
              <p className={prazo ? TOM[prazo.tom] : "text-muted"}>{prazo?.texto}</p>
              <p className="text-xs text-muted">{formatarDiaMes(venc.data)}</p>
            </>
          ) : ehDespesa && !quitado ? (
            <p className="text-muted">sem data</p>
          ) : null}
        </div>

        {/* quanto */}
        <div className="min-w-[7rem] text-right md:w-36 md:flex-none">
          <p className={`font-semibold tabular-nums ${corValor}`}>
            {sinal}
            {moeda(valorPrincipal)}
          </p>
          {legendaValor && <p className="text-xs text-muted">{legendaValor}</p>}
        </div>

        {/* o que fazer */}
        <div className="flex items-center justify-end gap-1.5 md:w-48 md:flex-none">
          {!ehDespesa ? (
            <span className="text-xs text-muted">movimento de caixa</span>
          ) : quitado ? (
            parcelado ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-2.5 py-1.5 text-sm font-medium text-primary-dark">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Quitada
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onAlternarPago(d)}
                disabled={marcando === chaveAvista}
                title="Clique para desfazer e marcar como não paga"
                className={`inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-2.5 py-1.5 text-sm font-medium text-primary-dark transition hover:bg-primary-soft disabled:opacity-60 ${FOCO}`}
              >
                {marcando === chaveAvista ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                )}
                Paga
              </button>
            )
          ) : parcelado && proxima ? (
            <>
              <button
                type="button"
                onClick={() => onAlternarParcela(d, proxima.numero, false)}
                disabled={marcando === `${d.id}-${proxima.numero}`}
                title={`Marcar a parcela ${proxima.numero} como paga`}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-primary px-2.5 py-1.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-60 ${FOCO}`}
              >
                {marcando === `${d.id}-${proxima.numero}` ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden />
                )}
                Pagar parcela {proxima.numero}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onAlternarPago(d)}
              disabled={marcando === chaveAvista}
              title="Marcar esta conta como paga"
              className={`inline-flex items-center gap-1.5 rounded-lg border border-primary px-2.5 py-1.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-60 ${FOCO}`}
            >
              {marcando === chaveAvista ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Circle className="h-4 w-4" aria-hidden />
              )}
              Marcar como paga
            </button>
          )}
        </div>

        {/* editar / excluir / ver parcelas */}
        <div className="ml-auto flex shrink-0 items-center md:ml-0">
          {parcelado && (
            <button
              type="button"
              onClick={onAlternarExpandido}
              aria-expanded={expandido}
              aria-label={expandido ? "Esconder parcelas" : "Ver parcelas"}
              title={expandido ? "Esconder parcelas" : "Ver parcelas"}
              className={`rounded-md p-2 text-muted transition hover:bg-background hover:text-foreground ${FOCO}`}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEditar(d)}
            aria-label={`Editar ${titulo}`}
            title="Editar"
            className={`rounded-md p-2 text-muted transition hover:bg-background hover:text-primary ${FOCO}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onExcluir(d)}
            aria-label={`Excluir ${titulo}`}
            title="Excluir"
            className={`rounded-md p-2 text-muted transition hover:bg-background hover:text-danger ${FOCO}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* parcelas: recolhidas por padrão para a lista não virar um paredão */}
      {parcelado && expandido && (
        <div className="px-4 pb-4 md:pl-6">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {d.parcelas.map((p) => {
              const chave = `${d.id}-${p.numero}`;
              const prazoParcela = descreverVencimento(p.dataVencimento, p.pago);
              const atrasadaParcela = prazoParcela?.tom === "perigo";
              return (
                <li key={p.numero}>
                  <button
                    type="button"
                    onClick={() => onAlternarParcela(d, p.numero, p.pago)}
                    disabled={marcando === chave}
                    title={p.pago ? "Clique para desfazer o pagamento" : "Marcar esta parcela como paga"}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:opacity-60 ${FOCO} ${
                      p.pago
                        ? "border-primary/30 bg-primary-light"
                        : atrasadaParcela
                          ? "border-danger/40 bg-danger-light hover:border-danger"
                          : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    {marcando === chave ? (
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted" aria-hidden />
                    ) : p.pago ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden />
                    ) : (
                      <Circle className={`h-5 w-5 shrink-0 ${atrasadaParcela ? "text-danger" : "text-muted"}`} aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted">
                        Parcela {p.numero} de {total}
                      </span>
                      <span className={`block text-sm font-semibold tabular-nums ${p.pago ? "text-muted line-through" : ""}`}>
                        {moeda(p.valor)}
                      </span>
                    </span>
                    <span className="text-right text-xs">
                      {p.pago ? (
                        <span className="text-primary-dark">paga</span>
                      ) : p.dataVencimento ? (
                        <>
                          <span className={`block ${prazoParcela ? TOM[prazoParcela.tom] : "text-muted"}`}>
                            {prazoParcela?.texto}
                          </span>
                          <span className="block text-muted">{formatarDiaMes(p.dataVencimento)}</span>
                        </>
                      ) : (
                        <span className="text-muted">sem data</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

