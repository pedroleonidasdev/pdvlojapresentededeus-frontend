import type { Despesa, Parcela } from "./types";

/**
 * Regras de datas e de "o que falta pagar" da tela de Finanças. Datas de
 * vencimento são calendário puro ("YYYY-MM-DD", sem hora/fuso): tudo aqui compara
 * e soma dias em UTC para não virar o dia por causa do fuso.
 */

/** Hoje no fuso de Brasília como "YYYY-MM-DD". */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Dias entre hoje e a data (negativo = já passou). */
export function diasAte(dataYYYYMMDD: string): number {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const [ah, mh, dh] = hojeISO().split("-").map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ah, mh - 1, dh)) / 86_400_000);
}

export function somarDias(dataYYYYMMDD: string, dias: number): string {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28/02, o último dia do mês seguinte). */
export function somarMeses(dataYYYYMMDD: string, meses: number): string {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(a, m + meses, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimoDia))).toISOString().slice(0, 10);
}

export function limitesDoMes(dataYYYYMMDD: string): { inicio: string; fim: string } {
  const [a, m] = dataYYYYMMDD.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(a, m - 1, 1)).toISOString().slice(0, 10),
    fim: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10),
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "17 out" (com o ano só quando não é o ano atual: "17 out 2027"). */
export function formatarDiaMes(dataYYYYMMDD: string): string {
  const [a, m, d] = dataYYYYMMDD.split("-").map(Number);
  const anoAtual = Number(hojeISO().slice(0, 4));
  return `${d} ${MESES[m - 1]}${a !== anoAtual ? ` ${a}` : ""}`;
}

export type StatusVencimento = "VENCIDO" | "VENCE_HOJE" | "PROXIMO" | "EM_DIA";

/** Só existe enquanto não estiver pago: depois de quitado a data vira histórico. */
export function statusVencimento(dataYYYYMMDD: string | null, pago: boolean): StatusVencimento | null {
  if (!dataYYYYMMDD || pago) return null;
  const dias = diasAte(dataYYYYMMDD);
  if (dias < 0) return "VENCIDO";
  if (dias === 0) return "VENCE_HOJE";
  if (dias <= 7) return "PROXIMO";
  return "EM_DIA";
}

export type TomVencimento = "perigo" | "atencao" | "neutro";

/** Texto humano do prazo ("venceu há 3 dias", "vence amanhã") e a urgência dele. */
export function descreverVencimento(
  dataYYYYMMDD: string | null,
  pago: boolean
): { texto: string; tom: TomVencimento } | null {
  if (!dataYYYYMMDD || pago) return null;
  const dias = diasAte(dataYYYYMMDD);
  if (dias < 0) {
    const n = -dias;
    return { texto: `venceu há ${n} ${n === 1 ? "dia" : "dias"}`, tom: "perigo" };
  }
  if (dias === 0) return { texto: "vence hoje", tom: "perigo" };
  if (dias === 1) return { texto: "vence amanhã", tom: "atencao" };
  if (dias <= 7) return { texto: `vence em ${dias} dias`, tom: "atencao" };
  return { texto: `vence em ${dias} dias`, tom: "neutro" };
}

/** Quantas parcelas pagas e quanto falta. À vista conta como "1 parcela". */
export function resumoPagamento(d: Despesa) {
  if (d.parcelas.length === 0) {
    return { parcelado: false, pagas: d.pago ? 1 : 0, total: 1, restante: d.pago ? 0 : d.valor };
  }
  const pagas = d.parcelas.filter((p) => p.pago).length;
  const restante = d.parcelas.filter((p) => !p.pago).reduce((acc, p) => acc + p.valor, 0);
  return { parcelado: true, pagas, total: d.parcelas.length, restante };
}

/** A parcela em aberto mais antiga (a próxima a pagar). */
export function proximaParcela(d: Despesa): Parcela | null {
  const abertas = d.parcelas.filter((p) => !p.pago);
  if (abertas.length === 0) return null;
  return [...abertas].sort((a, b) => {
    if (!a.dataVencimento && !b.dataVencimento) return a.numero - b.numero;
    if (!a.dataVencimento) return 1;
    if (!b.dataVencimento) return -1;
    return a.dataVencimento < b.dataVencimento ? -1 : a.dataVencimento > b.dataVencimento ? 1 : a.numero - b.numero;
  })[0];
}

/** O vencimento que importa: à vista é o próprio; parcelado é o da próxima parcela em aberto. */
export function vencimentoRelevante(d: Despesa): { data: string | null; pago: boolean } {
  if (d.parcelas.length === 0) return { data: d.dataVencimento, pago: d.pago };
  const proxima = proximaParcela(d);
  if (!proxima) return { data: null, pago: true };
  return { data: proxima.dataVencimento, pago: false };
}

export type Faixa = "VENCIDO" | "HOJE" | "SEMANA" | "DEPOIS" | "SEM_DATA";

export const ORDEM_FAIXAS: Faixa[] = ["VENCIDO", "HOJE", "SEMANA", "DEPOIS", "SEM_DATA"];

export const TITULO_FAIXA: Record<Faixa, string> = {
  VENCIDO: "Vencidas",
  HOJE: "Vencem hoje",
  SEMANA: "Nos próximos 7 dias",
  DEPOIS: "Mais adiante",
  SEM_DATA: "Sem data de vencimento",
};

export function faixaDaData(data: string | null): Faixa {
  if (!data) return "SEM_DATA";
  const dias = diasAte(data);
  if (dias < 0) return "VENCIDO";
  if (dias === 0) return "HOJE";
  if (dias <= 7) return "SEMANA";
  return "DEPOIS";
}

/** Em que faixa uma conta em aberto aparece na lista (pela parcela em aberto mais antiga). */
export function faixaDe(d: Despesa): Faixa {
  return faixaDaData(vencimentoRelevante(d).data);
}

/** Cada pagamento que ainda falta fazer: o valor à vista, ou cada parcela em aberto. */
export function obrigacoesEmAberto(d: Despesa): { data: string | null; valor: number }[] {
  if (d.tipo !== "DESPESA") return [];
  if (d.parcelas.length === 0) return d.pago ? [] : [{ data: d.dataVencimento, valor: d.valor }];
  return d.parcelas.filter((p) => !p.pago).map((p) => ({ data: p.dataVencimento, valor: p.valor }));
}

export function temAlgoEmAberto(d: Despesa): boolean {
  if (d.tipo !== "DESPESA") return false;
  const { pagas, total } = resumoPagamento(d);
  return pagas < total;
}

/** Divide o total em n parcelas iguais; a última absorve os centavos que sobram. */
export function dividirEmParcelas(totalReais: number, n: number): string[] {
  const totalCentavos = Math.round(totalReais * 100);
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => ((base + (i === n - 1 ? resto : 0)) / 100).toFixed(2).replace(".", ","));
}
