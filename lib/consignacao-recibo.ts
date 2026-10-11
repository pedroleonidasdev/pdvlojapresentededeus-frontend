import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

const LARANJA = "E8731A";
const AZUL = "1A7F8F";

/**
 * Recibo (Word .docx editável, 1 página A4) no mesmo formato do modelo "RECIBO ECC":
 * cabeçalho da loja, texto "Recebi de ... o valor total de R$ ...", as porcentagens
 * combinadas, data para preencher e linha de assinatura do responsável da loja.
 *
 * Consignação fechada  -> o valor já sai preenchido (valor líquido que fica com a loja).
 * Consignação aberta   -> o valor sai em branco (linha) para preencher à mão.
 */
export async function gerarReciboConsignacao(m: ModeloConsignacao): Promise<Blob> {
  const { AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } =
    await import("docx");
  const logo = await carregarLogo();

  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };

  const valor = m.acerto ? formatarMoeda(m.acerto.liquidoLoja) : null;
  const tam = 24;

  const altLogo = 90;
  const cabecalho = new Table({
    width: { size: 9000, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: [2200, 6800],
    borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: semBordas,
            width: { size: 2200, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: logo
                  ? [
                      new ImageRun({
                        type: "jpg",
                        data: logo.bytes,
                        transformation: { width: Math.round((logo.largura / logo.altura) * altLogo), height: altLogo },
                      }),
                    ]
                  : [],
              }),
            ],
          }),
          new TableCell({
            borders: semBordas,
            width: { size: 6800, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({ children: [new TextRun({ text: LOJA.nome, bold: true, color: LARANJA, size: 40 })] }),
              new Paragraph({ children: [new TextRun({ text: LOJA.subtitulo, bold: true, color: AZUL, size: 22 })] }),
              new Paragraph({ children: [new TextRun({ text: LOJA.endereco, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: LOJA.telefone, bold: true, size: 16 })] }),
              new Paragraph({ children: [new TextRun({ text: LOJA.contato, bold: true, size: 16 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const linhaValor = valor
    ? [new TextRun({ text: valor, bold: true, size: tam })]
    : [new TextRun({ text: "_".repeat(60), size: tam })];

  const doc = new Document({
    creator: LOJA.nome,
    title: `Recibo - ${m.consignatario}`,
    styles: { default: { document: { run: { font: "Calibri", size: tam } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 1417, right: 1417 } } },
        children: [
          cabecalho,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 900, after: 500 },
            children: [new TextRun({ text: "RECIBO", bold: true, size: 28 })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200, line: 400 },
            indent: { firstLine: 700 },
            children: [
              new TextRun({ text: `Recebi de ${m.consignatario}, o valor total de `, size: tam }),
              ...linhaValor,
              new TextRun({ text: ", referente a:", size: tam }),
            ],
          }),
          ...m.porcentagens.map(
            (t) =>
              new Paragraph({
                bullet: { level: 0 },
                spacing: { line: 400 },
                indent: { left: 900 },
                children: [new TextRun({ text: t, bold: true, size: tam })],
              })
          ),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 700, after: 1400 },
            children: [new TextRun({ text: "Riacho Fundo I – DF, ______ de ____________________ de ________.", size: tam })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 4 } },
            indent: { left: 1800, right: 1800 },
            children: [new TextRun({ text: LOJA.responsavel, size: 22 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "PRESENTE DE DEUS", size: 22 })],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
