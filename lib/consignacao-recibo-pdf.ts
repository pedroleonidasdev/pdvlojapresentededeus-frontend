import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

/** Quantos recibos cabem numa folha A4 (cada um ocupa 1/3 da altura). */
export const RECIBOS_POR_FOLHA = 3;
export const MAX_RECIBOS = 99;

const LARGURA = 210;
const ALTURA = 297;
const ALTURA_RECIBO = ALTURA / RECIBOS_POR_FOLHA; // 99 mm
const MARGEM = 16;
const LARANJA: [number, number, number] = [232, 115, 26];
const AZUL: [number, number, number] = [26, 127, 143];

type Trecho = { t: string; b: boolean };

/** Quebra os trechos em palavras (um trecho colado em outro, como "R$ 10,00" + ",", continua a mesma palavra). */
function palavras(trechos: Trecho[]): Trecho[][] {
  const saida: Trecho[][] = [];
  let atual: Trecho[] = [];
  for (const tr of trechos) {
    tr.t.split(" ").forEach((p, i) => {
      if (i > 0) {
        if (atual.length) saida.push(atual);
        atual = [];
      }
      if (p) atual.push({ t: p, b: tr.b });
    });
  }
  if (atual.length) saida.push(atual);
  return saida;
}

/**
 * PDF A4 com os recibos, 3 por folha, separados por linha tracejada (serrilhada) para
 * recortar com tesoura. Texto vetorial (selecionável), mesmo cabeçalho/cores do sistema.
 *
 * Consignação fechada -> valor já preenchido (líquido da loja); aberta -> linha em branco.
 */
export async function gerarPdfRecibos(m: ModeloConsignacao, quantidade: number): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const logo = await carregarLogo();
  const total = Math.max(1, Math.min(MAX_RECIBOS, Math.floor(quantidade) || 1));
  const valor = m.acerto ? formatarMoeda(m.acerto.valorRecibo) : null;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: `Recibo - ${m.consignatario}`, author: "Presente de Deus" });

  function cabecalho(y: number) {
    const alt = 15;
    const larg = logo ? (logo.largura / logo.altura) * alt : 0;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    const larguraNome = doc.getTextWidth(LOJA.nome);
    doc.setFontSize(7.5);
    const larguraLinhas = Math.max(
      larguraNome,
      doc.getTextWidth(LOJA.endereco),
      doc.getTextWidth(LOJA.telefone),
      doc.getTextWidth(LOJA.contato)
    );
    const folga = logo ? 3 : 0;
    const x0 = (LARGURA - (larg + folga + larguraLinhas)) / 2;
    if (logo) doc.addImage(logo.dataUrl, "JPEG", x0, y, larg, alt);
    const xt = x0 + larg + folga;

    doc.setFontSize(15);
    doc.setTextColor(...LARANJA);
    doc.text(LOJA.nome, xt, y + 4.5);
    doc.setFontSize(9);
    doc.setTextColor(...AZUL);
    doc.text(LOJA.subtitulo, xt, y + 8.5);
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    doc.text(LOJA.endereco, xt, y + 11.5);
    doc.text(LOJA.telefone, xt, y + 14);
    doc.text(LOJA.contato, xt, y + 16.5);
  }

  /** Escreve o parágrafo (com o valor em negrito) quebrando linha à mão; devolve o Y da última linha. */
  function paragrafo(trechos: Trecho[], y: number): number {
    const tam = 10.5;
    const alturaLinha = 5.8;
    const limite = LARGURA - MARGEM;
    doc.setFontSize(tam);
    doc.setFont("helvetica", "normal");
    const larguraEspaco = doc.getTextWidth(" ");

    let x = MARGEM + 10; // recuo da primeira linha
    for (const palavra of palavras(trechos)) {
      let larguraPalavra = 0;
      for (const s of palavra) {
        doc.setFont("helvetica", s.b ? "bold" : "normal");
        larguraPalavra += doc.getTextWidth(s.t);
      }
      if (x + larguraPalavra > limite && x > MARGEM) {
        y += alturaLinha;
        x = MARGEM;
      }
      for (const s of palavra) {
        doc.setFont("helvetica", s.b ? "bold" : "normal");
        doc.text(s.t, x, y);
        x += doc.getTextWidth(s.t);
      }
      doc.setFont("helvetica", "normal");
      x += larguraEspaco;
    }
    return y;
  }

  function recibo(y0: number) {
    cabecalho(y0 + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("RECIBO", LARGURA / 2, y0 + 32, { align: "center" });

    const trechos: Trecho[] = [
      { t: `Recebi de ${m.consignatario}, o valor total de `, b: false },
      { t: valor ?? "_".repeat(26), b: valor !== null },
      { t: ", referente a:", b: false },
    ];
    let y = paragrafo(trechos, y0 + 42) + 3;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    for (const item of m.porcentagens) {
      y += 6;
      doc.text("•", MARGEM + 12, y);
      doc.text(item, MARGEM + 18, y);
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text("Riacho Fundo I – DF, ______ de ____________________ de ________.", LARGURA / 2, y0 + 74, { align: "center" });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(65, y0 + 83, 145, y0 + 83);
    doc.setFontSize(8.5);
    doc.text(LOJA.responsavel, LARGURA / 2, y0 + 86.6, { align: "center" });
    doc.text("PRESENTE DE DEUS", LARGURA / 2, y0 + 89.6, { align: "center" });
  }

  /** Linha tracejada para recortar, entre um recibo e o de baixo. */
  function linhaDeCorte(y: number) {
    doc.setDrawColor(110, 110, 110);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([2, 1.5], 0);
    doc.line(4, y, LARGURA - 4, y);
    doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text("cortar aqui", 6, y - 0.8);
    doc.setTextColor(0, 0, 0);
  }

  for (let i = 0; i < total; i++) {
    const posicao = i % RECIBOS_POR_FOLHA;
    if (i > 0 && posicao === 0) doc.addPage();
    const y0 = posicao * ALTURA_RECIBO;
    recibo(y0);
    if (posicao < RECIBOS_POR_FOLHA - 1) linhaDeCorte(y0 + ALTURA_RECIBO);
  }

  return doc.output("blob");
}
