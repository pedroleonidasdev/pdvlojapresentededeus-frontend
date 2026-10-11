import { carregarLogo, LOJA } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

/** Recibos por folha A4 (3 faixas de 99 mm, separadas por linha pontilhada para cortar). */
export const RECIBOS_POR_FOLHA = 3;
export const MAXIMO_RECIBOS = 90;

export interface DadosRecibo {
  /** Nome do consignatário, exatamente como foi cadastrado. */
  consignatario: string;
  /** Valor a constar no recibo; null deixa a linha "R$ ______" em branco para preencher à mão. */
  valor: number | null;
}

type LogoRecibo = { bytes: ArrayBuffer; dataUrl: string; largura: number; altura: number } | null;
type Cor = [number, number, number];

const VERDE: Cor = [27, 77, 62]; // --primary do sistema
const VERDE_BORDA: Cor = [111, 174, 163]; // --border do sistema
const CREME: Cor = [255, 251, 243]; // --surface do sistema
const LARANJA: Cor = [232, 115, 26];
const AZUL: Cor = [26, 127, 143];
const CINZA: Cor = [120, 120, 120];

const PORCENTAGENS = [
  "15% do total vendido referente a Livros, Bíblias e Paulinas",
  "20% do total vendido referente aos demais Artigos Religiosos",
];

const hex = (c: Cor) => c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

/**
 * Nome do arquivo = exatamente o nome do consignatário. Só saem os caracteres que o
 * Windows não aceita em nome de arquivo (\ / : * ? " < > |), trocados por "-".
 */
export function nomeArquivoRecibo(consignatario: string): string {
  const limpo = consignatario
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, 150);
  return limpo || "recibo";
}

/** "R$ 1.234,56" com espaço comum (a fonte do PDF não tem o espaço não separável). */
export function valorParaRecibo(valor: number): string {
  return formatarMoeda(valor).replace(/\u00a0/g, " ");
}

/** Quantas folhas A4 são necessárias para essa quantidade de recibos. */
export const folhasNecessarias = (quantidade: number) => Math.ceil(Math.max(quantidade, 1) / RECIBOS_POR_FOLHA);

/* ===================================== PDF ===================================== */

// Geometria (mm) de um recibo dentro da sua faixa de 99 mm
const FAIXA = 297 / RECIBOS_POR_FOLHA; // 99
const CARD = { x: 10, w: 190, topo: 6, h: 87 };

type Palavra = { t: string; negrito: boolean; espacoDepois: boolean };
type Trecho = { texto: string; negrito?: boolean };

function palavrasDe(trechos: Trecho[]): Palavra[] {
  const palavras: Palavra[] = [];
  for (const tr of trechos) {
    for (const m of tr.texto.matchAll(/(\S+)(\s*)/g)) {
      palavras.push({ t: m[1], negrito: !!tr.negrito, espacoDepois: m[2].length > 0 });
    }
  }
  return palavras;
}

type Doc = import("jspdf").jsPDF;

/**
 * Escreve um parágrafo com trechos em negrito, quebrando por palavras.
 * Devolve quantas linhas ocupou. Com desenhar=false só mede.
 */
function paragrafoRico(
  doc: Doc,
  trechos: Trecho[],
  x: number,
  y: number,
  larguraMax: number,
  tamanho: number,
  alturaLinha: number,
  desenhar: boolean
): number {
  doc.setFontSize(tamanho);
  doc.setFont("helvetica", "normal");
  const espaco = doc.getTextWidth(" ");
  let cx = x;
  let linha = 0;
  let precisaEspaco = false;
  for (const p of palavrasDe(trechos)) {
    doc.setFont("helvetica", p.negrito ? "bold" : "normal");
    const w = doc.getTextWidth(p.t);
    const folga = precisaEspaco ? espaco : 0;
    if (cx > x && cx + folga + w > x + larguraMax) {
      linha++;
      cx = x;
    } else {
      cx += folga;
    }
    if (desenhar) doc.text(p.t, cx, y + linha * alturaLinha);
    cx += w;
    precisaEspaco = p.espacoDepois;
  }
  return linha + 1;
}

/** Tamanhos de letra testados, do maior para o menor, até o texto caber no recibo. */
const TAMANHOS = [10, 9.5, 9, 8.5, 8];

interface Posicoes {
  tamanho: number;
  linhasParagrafo: number;
  yParagrafo: number;
  yValor: number;
  yReferente: number;
  yBullet1: number;
  yBullet2: number;
  yData: number;
  ySignatura: number;
}

function calcularPosicoes(doc: Doc, d: DadosRecibo, y0: number): Posicoes {
  const larguraTexto = CARD.w - 24;
  const ySignatura = y0 + CARD.h - 12;
  let melhor: Posicoes | null = null;
  for (const tamanho of TAMANHOS) {
    const alturaLinha = tamanho * 0.53;
    const linhasParagrafo = paragrafoRico(
      doc,
      [{ texto: "Recebi de " }, { texto: d.consignatario, negrito: true }, { texto: ", o valor total de" }],
      CARD.x + 12,
      0,
      larguraTexto,
      tamanho,
      alturaLinha,
      false
    );
    // os espaços entre as linhas encolhem junto com a letra, para nomes longos caberem
    const k = tamanho / 10;
    const yParagrafo = y0 + 32;
    const yValor = yParagrafo + (linhasParagrafo - 1) * alturaLinha + 8 * k;
    const yReferente = yValor + 7 * k;
    const yBullet1 = yReferente + 6 * k;
    const yBullet2 = yBullet1 + 5.5 * k;
    const yData = yBullet2 + 9 * k;
    melhor = { tamanho, linhasParagrafo, yParagrafo, yValor, yReferente, yBullet1, yBullet2, yData, ySignatura };
    if (yData <= ySignatura - 6) break;
  }
  return melhor as Posicoes;
}

function desenharRecibo(doc: Doc, slot: number, d: DadosRecibo, logo: LogoRecibo) {
  const y0 = slot * FAIXA + CARD.topo;
  const { x, w, h } = CARD;

  // cartão (mesmo visual dos cards do sistema: fundo marfim, borda teal, cantos arredondados)
  doc.setFillColor(...CREME);
  doc.setDrawColor(...VERDE_BORDA);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y0, w, h, 3, 3, "FD");

  // cabeçalho: logo + dados da loja
  const altLogo = 15;
  const largLogo = logo ? (logo.largura / logo.altura) * altLogo : 0;
  if (logo) doc.addImage(logo.dataUrl, "JPEG", x + 6, y0 + 4.5, largLogo, altLogo);
  const xTexto = x + 6 + largLogo + (logo ? 4 : 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...LARANJA);
  doc.text(LOJA.nome, xTexto, y0 + 9.5);
  doc.setFontSize(9);
  doc.setTextColor(...AZUL);
  doc.text(LOJA.subtitulo, xTexto, y0 + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text(LOJA.endereco, xTexto, y0 + 18);
  doc.text(`${LOJA.telefone}  ·  ${LOJA.contato}`, xTexto, y0 + 21.5);

  // selo "RECIBO" (verde do sistema)
  doc.setFillColor(...VERDE);
  doc.roundedRect(x + w - 6 - 32, y0 + 5, 32, 9, 4.5, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("RECIBO", x + w - 6 - 16, y0 + 11.2, { align: "center" });

  // divisória do cabeçalho
  doc.setDrawColor(...VERDE_BORDA);
  doc.setLineWidth(0.3);
  doc.line(x + 6, y0 + 24.5, x + w - 6, y0 + 24.5);

  // corpo
  const pos = calcularPosicoes(doc, d, y0);
  const alturaLinha = pos.tamanho * 0.53;
  const xCorpo = x + 12;
  const xFim = x + w - 12;
  doc.setTextColor(0, 0, 0);
  paragrafoRico(
    doc,
    [{ texto: "Recebi de " }, { texto: d.consignatario, negrito: true }, { texto: ", o valor total de" }],
    xCorpo,
    pos.yParagrafo,
    CARD.w - 24,
    pos.tamanho,
    alturaLinha,
    true
  );

  // linha do valor: "R$ ____________," em branco ou já preenchida
  doc.setFont("helvetica", "bold");
  doc.setFontSize(pos.tamanho);
  doc.text("R$", xCorpo, pos.yValor);
  if (d.valor !== null) {
    const txt = valorParaRecibo(d.valor).replace(/^R\$\s*/, "");
    doc.text(txt, xCorpo + doc.getTextWidth("R$ "), pos.yValor);
    doc.setFont("helvetica", "normal");
    doc.text(",", xCorpo + doc.getTextWidth("R$ ") + doc.getTextWidth(txt), pos.yValor);
  } else {
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(xCorpo + doc.getTextWidth("R$ "), pos.yValor + 0.6, xFim - 2, pos.yValor + 0.6);
    doc.setFont("helvetica", "normal");
    doc.text(",", xFim - 1.2, pos.yValor);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(pos.tamanho);
  doc.text("referente a:", xCorpo, pos.yReferente);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(pos.tamanho - 0.5);
  [pos.yBullet1, pos.yBullet2].forEach((yy, i) => {
    doc.text("•", xCorpo + 8, yy);
    doc.text(PORCENTAGENS[i], xCorpo + 13, yy);
  });

  // local e data (em branco, como no modelo)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(pos.tamanho);
  doc.text("Riacho Fundo I – DF, ______ de ____________________ de ________.", x + w / 2, pos.yData, { align: "center" });

  // assinatura
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(x + w / 2 - 40, pos.ySignatura, x + w / 2 + 40, pos.ySignatura);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(LOJA.responsavel, x + w / 2, pos.ySignatura + 4, { align: "center" });
  doc.setFontSize(7.5);
  doc.text("PRESENTE DE DEUS", x + w / 2, pos.ySignatura + 7.6, { align: "center" });
}

function linhasDeCorte(doc: Doc) {
  doc.setDrawColor(...CINZA);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2.2, 1.6], 0);
  for (let i = 1; i < RECIBOS_POR_FOLHA; i++) doc.line(5, i * FAIXA, 205, i * FAIXA);
  doc.setLineDashPattern([], 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...CINZA);
  for (let i = 1; i < RECIBOS_POR_FOLHA; i++) doc.text("corte aqui", 105, i * FAIXA - 0.8, { align: "center" });
}

/** PDF A4 com a quantidade pedida de recibos, 3 por folha, com pontilhado para cortar. */
export async function gerarPdfRecibos(d: DadosRecibo, quantidade: number): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const logo = await carregarLogo();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: `Recibo - ${d.consignatario}`, author: "Presente de Deus" });

  const total = Math.min(Math.max(Math.floor(quantidade) || 1, 1), MAXIMO_RECIBOS);
  for (let i = 0; i < total; i++) {
    const slot = i % RECIBOS_POR_FOLHA;
    if (slot === 0) {
      if (i > 0) doc.addPage();
      linhasDeCorte(doc);
    }
    desenharRecibo(doc, slot, d, logo);
  }
  return doc.output("blob");
}

/* ===================================== Word ==================================== */

const TWIP_MM = 56.7;
const mm = (v: number) => Math.round(v * TWIP_MM);

/** Monta o .docx; separado de gerarWordRecibos para poder receber o logo já carregado. */
export async function montarWordRecibos(d: DadosRecibo, quantidade: number, logo: LogoRecibo): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeightRule,
    ImageRun,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import("docx");

  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const bordaCard = { style: BorderStyle.SINGLE, size: 10, color: hex(VERDE_BORDA) };
  const bordasCard = { top: bordaCard, bottom: bordaCard, left: bordaCard, right: bordaCard };
  const pontilhado = { style: BorderStyle.DASHED, size: 6, color: hex(CINZA) };

  const LARGURA_FOLHA = 11906; // A4 em twips
  const larguraCard = mm(190);

  const p = (texto: string, opc: { negrito?: boolean; tamanho?: number; cor?: string; alinhar?: (typeof AlignmentType)[keyof typeof AlignmentType]; antes?: number; depois?: number; recuo?: number } = {}) =>
    new Paragraph({
      alignment: opc.alinhar,
      spacing: { before: opc.antes ?? 0, after: opc.depois ?? 0 },
      indent: opc.recuo ? { left: opc.recuo } : undefined,
      children: [new TextRun({ text: texto, bold: opc.negrito, size: opc.tamanho ?? 19, color: opc.cor })],
    });

  function cartao(): InstanceType<typeof Table> {
    const alturaLogo = 56; // px
    const celulaLogo = new TableCell({
      borders: semBordas,
      width: { size: mm(26), type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        new Paragraph({
          children: logo
            ? [
                new ImageRun({
                  type: "jpg",
                  data: logo.bytes,
                  transformation: { width: Math.round((logo.largura / logo.altura) * alturaLogo), height: alturaLogo },
                }),
              ]
            : [],
        }),
      ],
    });
    const celulaTexto = new TableCell({
      borders: semBordas,
      width: { size: mm(112), type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: [
        p(LOJA.nome, { negrito: true, tamanho: 28, cor: hex(LARANJA) }),
        p(LOJA.subtitulo, { negrito: true, tamanho: 18, cor: hex(AZUL) }),
        p(LOJA.endereco, { tamanho: 14 }),
        p(`${LOJA.telefone}  ·  ${LOJA.contato}`, { tamanho: 14 }),
      ],
    });
    const celulaSelo = new TableCell({
      borders: semBordas,
      width: { size: mm(40), type: WidthType.DXA },
      verticalAlign: VerticalAlign.TOP,
      children: [
        new Table({
          width: { size: mm(32), type: WidthType.DXA },
          alignment: AlignmentType.RIGHT,
          columnWidths: [mm(32)],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              height: { value: mm(9), rule: HeightRule.EXACT },
              children: [
                new TableCell({
                  borders: semBordas,
                  width: { size: mm(32), type: WidthType.DXA },
                  shading: { type: ShadingType.CLEAR, fill: hex(VERDE), color: "auto" },
                  verticalAlign: VerticalAlign.CENTER,
                  children: [p("RECIBO", { negrito: true, tamanho: 24, cor: "FFFFFF", alinhar: AlignmentType.CENTER })],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "", size: 2 })] }),
      ],
    });
    const cabecalho = new Table({
      width: { size: mm(178), type: WidthType.DXA },
      columnWidths: [mm(26), mm(112), mm(40)],
      layout: TableLayoutType.FIXED,
      rows: [new TableRow({ children: [celulaLogo, celulaTexto, celulaSelo] })],
    });

    const valorTxt = d.valor !== null ? valorParaRecibo(d.valor).replace(/^R\$\s*/, "") : null;
    const linhaValor = new Paragraph({
      spacing: { before: 160, after: 0 },
      children: [
        new TextRun({ text: "R$ ", bold: true, size: 20 }),
        new TextRun({
          text: valorTxt ?? "_".repeat(52),
          bold: valorTxt !== null,
          size: 20,
        }),
        new TextRun({ text: ",", size: 20 }),
      ],
    });

    const corpo = [
      new Paragraph({
        spacing: { before: 200, after: 0, line: 300 },
        children: [
          new TextRun({ text: "Recebi de ", size: 20 }),
          new TextRun({ text: d.consignatario, bold: true, size: 20 }),
          new TextRun({ text: ", o valor total de", size: 20 }),
        ],
      }),
      linhaValor,
      p("referente a:", { tamanho: 20, antes: 120 }),
      ...PORCENTAGENS.map(
        (t) =>
          new Paragraph({
            spacing: { before: 60, after: 0 },
            indent: { left: 360 },
            children: [new TextRun({ text: `•  ${t}`, bold: true, size: 19 })],
          })
      ),
      p("Riacho Fundo I – DF, ______ de ____________________ de ________.", {
        tamanho: 20,
        alinhar: AlignmentType.CENTER,
        antes: 260,
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 360, after: 0 },
        children: [new TextRun({ text: "_".repeat(46), size: 18 })],
      }),
      p(LOJA.responsavel, { tamanho: 17, alinhar: AlignmentType.CENTER }),
      p("PRESENTE DE DEUS", { tamanho: 15, alinhar: AlignmentType.CENTER }),
    ];

    return new Table({
      width: { size: larguraCard, type: WidthType.DXA },
      columnWidths: [larguraCard],
      layout: TableLayoutType.FIXED,
      alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({
          height: { value: mm(87), rule: HeightRule.EXACT },
          cantSplit: true,
          children: [
            new TableCell({
              borders: bordasCard,
              width: { size: larguraCard, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: hex(CREME), color: "auto" },
              margins: { top: mm(3), bottom: 0, left: mm(6), right: mm(6) },
              children: [
                cabecalho,
                new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "", size: 4 })] }),
                ...corpo,
              ],
            }),
          ],
        }),
      ],
    });
  }

  const total = Math.min(Math.max(Math.floor(quantidade) || 1, 1), MAXIMO_RECIBOS);
  const alturaFaixa = mm(98.5); // 3 faixas ficam um pouco abaixo de 297 mm e nunca estouram a folha
  const linhas = Array.from(
    { length: total },
    () =>
      new TableRow({
        height: { value: alturaFaixa, rule: HeightRule.EXACT },
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: LARGURA_FOLHA, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: { top: semBorda, left: semBorda, right: semBorda, bottom: pontilhado },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [cartao(), new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: "", size: 2 })] })],
          }),
        ],
      })
  );

  const doc = new Document({
    creator: "Presente de Deus",
    title: `Recibo - ${d.consignatario}`,
    styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: LARGURA_FOLHA, height: 16838 },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
          },
        },
        children: [
          new Table({
            width: { size: LARGURA_FOLHA, type: WidthType.DXA },
            columnWidths: [LARGURA_FOLHA],
            layout: TableLayoutType.FIXED,
            rows: linhas,
          }),
          new Paragraph({ spacing: { before: 0, after: 0, line: 20 }, children: [new TextRun({ text: "", size: 2 })] }),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

/** Word (.docx) editável: mesma quantidade de recibos, 3 por folha A4, com pontilhado para cortar. */
export async function gerarWordRecibos(d: DadosRecibo, quantidade: number): Promise<Blob> {
  return montarWordRecibos(d, quantidade, await carregarLogo());
}
