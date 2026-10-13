// Evento interno usado pra avisar o MonitorCaixa que o caixa acabou de ser
// aberto, fechado ou reaberto NESTA aba — assim ele reconsulta na hora, sem
// esperar o próximo ciclo de verificação (15s).
export const EVENTO_CAIXA_MUDOU = "pdv:caixa-mudou";

export function avisarCaixaMudou(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENTO_CAIXA_MUDOU));
  }
}
