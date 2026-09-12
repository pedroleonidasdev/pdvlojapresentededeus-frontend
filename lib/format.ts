export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

const FUSO_BRASILIA = "America/Sao_Paulo";
const OFFSET_BRASILIA_HORAS = 3; // Brasília = UTC-3 (sem horário de verão desde 2019)

/**
 * O backend envia o horário da venda sem informação de fuso (ex: "2026-08-27T13:45:30"),
 * representando na verdade um instante UTC. O navegador, ao dar new Date() nessa string,
 * a interpreta como horário local, exibindo a hora "crua" sem conversão — por isso a venda
 * aparecia adiantada. Aqui tratamos a string como UTC (quando não vier com Z/offset) e
 * convertemos explicitamente para o fuso de Brasília na hora de exibir.
 */
function paraDataUtc(iso: string): Date {
  const jaTemFuso = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  if (jaTemFuso) return new Date(iso);
  // trunca frações de segundo com mais de 3 dígitos (LocalDateTime do Java pode mandar nanossegundos)
  const normalizado = iso.replace(/(\.\d{3})\d*$/, "$1");
  return new Date(`${normalizado}Z`);
}

export function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: FUSO_BRASILIA,
  }).format(paraDataUtc(iso));
}

/** Retorna "YYYY-MM-DD" da venda já no fuso de Brasília — usado para agrupar por dia (gráfico). */
export function dataBrasiliaISO(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(paraDataUtc(iso));
}

/** Converte "YYYY-MM-DD" (dia no fuso de Brasília) para o instante UTC de início ou fim desse dia,
 *  no mesmo formato "sem Z" que o backend espera (ele grava os instantes como UTC "cru"). */
export function limiteDiaBrasiliaParaUtc(dataYYYYMMDD: string, fimDoDia: boolean): string {
  const [ano, mes, dia] = dataYYYYMMDD.split("-").map(Number);
  const utc = fimDoDia
    ? new Date(Date.UTC(ano, mes - 1, dia, 23 + OFFSET_BRASILIA_HORAS, 59, 59))
    : new Date(Date.UTC(ano, mes - 1, dia, 0 + OFFSET_BRASILIA_HORAS, 0, 0));
  return utc.toISOString().slice(0, 19);
}

/** Converte a dataHora "crua" (UTC) da venda para o formato aceito pelo input
 *  datetime-local ("YYYY-MM-DDTHH:mm"), já no fuso de Brasília. Usado para
 *  pré-preencher o formulário de edição de data/hora com o valor atual. */
export function paraInputDataHoraLocal(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const partes = formatter.formatToParts(paraDataUtc(iso));
  const obter = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${obter("year")}-${obter("month")}-${obter("day")}T${obter("hour")}:${obter("minute")}`;
}

/** Converte o valor de um input datetime-local ("YYYY-MM-DDTHH:mm"), entendido
 *  como horário de Brasília, para o formato UTC "cru" que o backend espera ao
 *  salvar a correção de data/hora (mesmo padrão de limiteDiaBrasiliaParaUtc). */
export function deInputDataHoraLocalParaUtc(valorLocal: string): string {
  const [data, hora] = valorLocal.split("T");
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, m] = hora.split(":").map(Number);
  const utc = new Date(Date.UTC(ano, mes - 1, dia, h + OFFSET_BRASILIA_HORAS, m, 0));
  return utc.toISOString().slice(0, 19);
}

export const LABEL_FORMA_PAGAMENTO: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  CHEQUE: "Cheque",
  MULTIPLO: "Múltiplos pagamentos",
};

export const LABEL_TIPO_DESPESA: Record<string, string> = {
  DESPESA: "Despesa",
  SANGRIA: "Sangria (retirada)",
  SUPRIMENTO: "Suprimento (reforço)",
};

// sugestões de categoria pro autocomplete/datalist na tela de Finanças — o
// campo aceita texto livre, isso é só pra agilizar o lançamento mais comum
export const CATEGORIAS_DESPESA_SUGERIDAS = [
  "Aluguel",
  "Fornecedor",
  "Energia",
  "Água",
  "Internet/Telefone",
  "Salários",
  "Manutenção",
  "Embalagens",
  "Marketing",
  "Impostos/Taxas",
  "Despesas com pessoal",
  "Frete/Entrega",
  "Equipamentos",
  "Software/Assinaturas",
  "Contabilidade/Jurídico",
  "Limpeza/Higiene",
  "Combustível",
  "Doações",
  "Outros",
];
