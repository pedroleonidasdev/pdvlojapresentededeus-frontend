import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

const LARANJA = "E8731A";
const AZUL = "1A7F8F";
const POR_FOLHA = 3;

/**
 * Recibos em Word (.docx) editável, A4, 3 por folha, separados por linha tracejada
 * (serrilhada) para recortar. Mesmo texto, cabeçalho e cores do PDF da visualização.
 *
 * Consignação fechada -> valor já preenchido (líquido da loja); aberta -> linha em branco.
 */
export async function gerarReciboConsignacao(m: ModeloConsignacao, quantidade = 1): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    HeightRule,
    ImageRun,
    LineRuleType,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = await import("docx");
  const logo = await carregarLogo();
  const total = Math.max(1, Math.min(99, Math.floor(quantidade) || 1));
  const valor = m.acerto ? formatarMoeda(m.acerto.liquidoLoja) : null;

  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };
  const tracejada = { style: BorderStyle.DASHED, size: 6, color: "808080" };
  const tam = 21;

  function cabecalho() {
    const alt = 52;
    return new Table({
      width: { size: 8700, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      columnWidths: [1700, 7000],
      borders: { ...semBordas, insideHorizontal: semBorda, insideVertical: semBorda },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: semBordas,
              width: { size: 1700, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: logo
                    ? [
                        new ImageRun({
                          type: "jpg",
                          data: logo.bytes,
                          transformation: { width: Math.round((logo.largura / logo.altura) * alt), height: alt },
                        }),
                      ]
                    : [],
                }),
              ],
            }),
            new TableCell({
              borders: semBordas,
              width: { size: 7000, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({ children: [new TextRun({ text: LOJA.nome, bold: true, color: LARANJA, size: 30 })] }),
                new Paragraph({ children: [new TextRun({ text: LOJA.subtitulo, bold: true, color: AZUL, size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: LOJA.endereco, bold: true, size: 14 })] }),
                new Paragraph({ children: [new TextRun({ text: LOJA.telefone, bold: true, size: 14 })] }),
                new Paragraph({ children: [new TextRun({ text: LOJA.contato, bold: true, size: 14 })] }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  function conteudoRecibo() {
    return [
      cabecalho(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 160 },
        children: [new TextRun({ text: "RECIBO", bold: true, size: 26 })],
      }),
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 100, line: 320 },
        indent: { firstLine: 500 },
        children: [
          new TextRun({ text: `Recebi de ${m.consignatario}, o valor total de `, size: tam }),
          valor
            ? new TextRun({ text: valor, bold: true, size: tam })
            : new TextRun({ text: "_".repeat(40), size: tam }),
          new TextRun({ text: ", referente a:", size: tam }),
        ],
      }),
      ...m.porcentagens.map(
        (t) =>
          new Paragraph({
            bullet: { level: 0 },
            spacing: { line: 300 },
            indent: { left: 900 },
            children: [new TextRun({ text: t, bold: true, size: tam })],
          })
      ),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 250, after: 550 },
        children: [new TextRun({ text: "Riacho Fundo I – DF, ______ de ____________________ de ________.", size: tam })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 3 } },
        indent: { left: 2800, right: 2800 },
        children: [new TextRun({ text: LOJA.responsavel, size: 18 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "PRESENTE DE DEUS", size: 18 })],
      }),
    ];
  }

  // Cada recibo é uma linha da tabela com altura fixa (1/3 da folha): o Word coloca 3 por página
  // e a borda tracejada de baixo de cada linha é a marcação de corte.
  const larguraTabela = 10506;
  const linhas = Array.from({ length: total }, (_, i) => {
    const ultima = i === total - 1;
    return new TableRow({
      cantSplit: true,
      height: { value: 5380, rule: HeightRule.EXACT },
      children: [
        new TableCell({
          width: { size: larguraTabela, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 200, right: 200 },
          borders: { ...semBordas, bottom: ultima && (i + 1) % POR_FOLHA !== 0 ? semBorda : tracejada },
          children: conteudoRecibo(),
        }),
      ],
    });
  });

  const doc = new Document({
    creator: LOJA.nome,
    title: `Recibo - ${m.consignatario}`,
    styles: { default: { document: { run: { font: "Calibri", size: tam } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 300, bottom: 300, left: 700, right: 700, header: 0, footer: 0 },
          },
        },
        children: [
          new Table({
            width: { size: larguraTabela, type: WidthType.DXA },
            columnWidths: [larguraTabela],
            borders: { ...semBordas, insideHorizontal: semBorda, insideVertical: semBorda },
            rows: linhas,
          }),
          // o Word exige um parágrafo depois da tabela; mínimo para não abrir folha em branco
          new Paragraph({
            spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
            children: [new TextRun({ text: "", size: 2 })],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
