import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

const LARANJA = "E8731A";
const AZUL = "1A7F8F";
const CINZA = "D9D9D9";
const CINZA_CLARO = "F0F0F0";

/** Word (.docx) editável: Termo de Responsabilidade + Relatório de mercadorias (A4). */
export async function gerarWordConsignacao(m: ModeloConsignacao): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    PageBreak,
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
  const logo = await carregarLogo();

  const borda = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const bordas = { top: borda, bottom: borda, left: borda, right: borda };
  const semBorda = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const semBordas = { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda };

  function cabecalho(compacto: boolean) {
    const alt = compacto ? 60 : 90;
    const textoLoja = [
      new Paragraph({
        children: [new TextRun({ text: LOJA.nome, bold: true, color: LARANJA, size: compacto ? 30 : 40 })],
      }),
      new Paragraph({ children: [new TextRun({ text: LOJA.subtitulo, bold: true, color: AZUL, size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: LOJA.endereco, bold: true, size: 16 })] }),
      new Paragraph({ children: [new TextRun({ text: LOJA.telefone, bold: true, size: 16 })] }),
      new Paragraph({ children: [new TextRun({ text: LOJA.contato, bold: true, size: 16 })] }),
    ];
    const celulaLogo = new TableCell({
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
                  transformation: { width: Math.round((logo.largura / logo.altura) * alt), height: alt },
                }),
              ]
            : [],
        }),
      ],
    });
    const celulaTexto = new TableCell({
      borders: semBordas,
      width: { size: 6800, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      children: textoLoja,
    });
    return new Table({
      width: { size: 9000, type: WidthType.DXA },
      alignment: AlignmentType.CENTER,
      columnWidths: [2200, 6800],
      borders: { ...bordas, insideHorizontal: semBorda, insideVertical: semBorda, top: semBorda, bottom: semBorda, left: semBorda, right: semBorda },
      rows: [new TableRow({ children: [celulaLogo, celulaTexto] })],
    });
  }

  // -------------------------------- Termo --------------------------------
  const termo = [
    cabecalho(false),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 500, after: 400 },
      children: [new TextRun({ text: "TERMO DE RESPONSABILIDADE", bold: true, size: 28 })],
    }),
    ...m.paragrafos.map(
      (p) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200, line: 400 },
          indent: { firstLine: 700 },
          children: [new TextRun({ text: p, size: 24 })],
        })
    ),
    ...m.porcentagens.map(
      (t) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { line: 400 },
          indent: { left: 900 },
          children: [new TextRun({ text: t, bold: true, size: 24 })],
        })
    ),
    ...(m.observacao
      ? [
          new Paragraph({
            spacing: { before: 300 },
            children: [
              new TextRun({ text: "Observação: ", bold: true, size: 24 }),
              new TextRun({ text: m.observacao, size: 24 }),
            ],
          }),
        ]
      : []),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 700, after: 1000 },
      children: [new TextRun({ text: `Riacho Fundo I – DF, ${m.dataExtenso}`, size: 24 })],
    }),
    new Table({
      width: { size: 9000, type: WidthType.DXA },
      columnWidths: [4200, 600, 4200],
      borders: { top: semBorda, bottom: semBorda, left: semBorda, right: semBorda, insideHorizontal: semBorda, insideVertical: semBorda },
      rows: [
        new TableRow({
          children: [
            [LOJA.responsavel, "PRESENTE DE DEUS"],
            null, // coluna vazia só para separar as duas linhas de assinatura
            [m.consignatario.toUpperCase(), "CONSIGNATÁRIO"],
          ].map((par, idx) =>
            par === null
              ? new TableCell({ width: { size: 600, type: WidthType.DXA }, borders: semBordas, children: [new Paragraph({ children: [] })] })
              : new TableCell({
                  width: { size: 4200, type: WidthType.DXA },
                  borders: { ...semBordas, top: { style: BorderStyle.SINGLE, size: 6, color: "000000" } },
                  margins: { left: 100, right: 100 },
                  children: par.map(
                    (linha) =>
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: linha, size: 22 })] })
                  ),
                })
          ),
        }),
      ],
    }),
  ];

  // ------------------------------ Relatório ------------------------------
  const larguras = [1550, 2900, 850, 1200, 1200, 850, 1250]; // soma 9800
  const total = larguras.reduce((a, b) => a + b, 0);

  function celula(
    texto: string,
    i: number,
    opcoes: { negrito?: boolean; alinhar?: (typeof AlignmentType)[keyof typeof AlignmentType]; fundo?: string; tam?: number; colSpan?: number; largura?: number; manterComProxima?: boolean } = {}
  ) {
    return new TableCell({
      borders: bordas,
      columnSpan: opcoes.colSpan,
      width: { size: opcoes.largura ?? larguras[i], type: WidthType.DXA },
      shading: opcoes.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: opcoes.fundo } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: texto.split("\n").map(
        (linha) =>
          new Paragraph({
            alignment: opcoes.alinhar,
            keepNext: opcoes.manterComProxima,
            children: [new TextRun({ text: linha, bold: opcoes.negrito, size: opcoes.tam ?? 18 })],
          })
      ),
    });
  }

  const centro = AlignmentType.CENTER;
  const direita = AlignmentType.RIGHT;

  const linhasTabela: InstanceType<typeof TableRow>[] = [
    new TableRow({
      tableHeader: true,
      children: [
        celula(`RELATÓRIO DE MERCADORIAS EM CONSIGNAÇÃO\n${m.consignatario.toUpperCase()}`, 0, {
          colSpan: 7,
          largura: total,
          negrito: true,
          alinhar: centro,
          fundo: CINZA,
          tam: 22,
        }),
      ],
    }),
    new TableRow({
      tableHeader: true,
      children: ["COD.", "PRODUTO", "QTDE ENVIADA", "VLR UNITÁRIO", "VALOR TOTAL", "QTDE VENDIDA", "VLR TOTAL VENDIDO"].map(
        (t, i) => celula(t, i, { negrito: true, alinhar: centro, fundo: CINZA, tam: 15 })
      ),
    }),
  ];

  for (const g of m.grupos) {
    linhasTabela.push(
      // keepNext: o título da categoria nunca fica sozinho no fim da página
      new TableRow({
        cantSplit: true,
        children: [celula(`${g.categoria}:`, 0, { colSpan: 7, largura: total, negrito: true, manterComProxima: true })],
      })
    );
    for (const l of g.linhas) {
      linhasTabela.push(
        new TableRow({
          cantSplit: true,
          children: [
            celula(l.cod, 0),
            celula(l.produto, 1),
            celula(String(l.qtdEnviada), 2, { alinhar: centro }),
            celula(formatarMoeda(l.vlrUnitario), 3, { alinhar: direita }),
            celula(formatarMoeda(l.vlrTotal), 4, { alinhar: direita }),
            celula(l.qtdVendida === null ? "" : String(l.qtdVendida), 5, { alinhar: centro }),
            celula(l.vlrVendido === null ? "" : formatarMoeda(l.vlrVendido), 6, { alinhar: direita }),
          ],
        })
      );
    }
  }

  linhasTabela.push(
    new TableRow({
      cantSplit: true,
      children: [
        celula("TOTAL", 0, { colSpan: 2, largura: larguras[0] + larguras[1], negrito: true, fundo: CINZA_CLARO }),
        celula(String(m.totais.qtdEnviada), 2, { negrito: true, alinhar: centro, fundo: CINZA_CLARO }),
        celula("", 3, { fundo: CINZA_CLARO }),
        celula(formatarMoeda(m.totais.vlrEnviado), 4, { negrito: true, alinhar: direita, fundo: CINZA_CLARO }),
        celula(m.totais.qtdVendida === null ? "" : String(m.totais.qtdVendida), 5, { negrito: true, alinhar: centro, fundo: CINZA_CLARO }),
        celula(m.totais.vlrVendido === null ? "" : formatarMoeda(m.totais.vlrVendido), 6, { negrito: true, alinhar: direita, fundo: CINZA_CLARO }),
      ],
    })
  );

  const relatorio: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    cabecalho(true),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    // layout fixo: as colunas respeitam a largura e o nome do produto quebra em mais de uma linha
    new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: larguras, layout: TableLayoutType.FIXED, rows: linhasTabela }),
  ];

  if (m.acerto) {
    const a = m.acerto;
    const cw = [4300, 1500, 1500];
    const c = (t: string, i: number, o: Parameters<typeof celula>[2] = {}) => celula(t, i, { ...o, largura: cw[i] });
    relatorio.push(
      new Paragraph({ spacing: { after: 160 }, children: [] }),
      new Table({
        width: { size: 7300, type: WidthType.DXA },
        columnWidths: cw,
        rows: [
          new TableRow({
            children: [
              c("ACERTO", 0, { negrito: true, fundo: CINZA, tam: 15 }),
              c("VENDIDO", 1, { negrito: true, fundo: CINZA, tam: 15, alinhar: direita }),
              c("COMISSÃO", 2, { negrito: true, fundo: CINZA, tam: 15, alinhar: direita }),
            ],
          }),
          ...a.faixas.map(
            (f) =>
              new TableRow({
                children: [c(f.rotulo, 0), c(formatarMoeda(f.vendido), 1, { alinhar: direita }), c(formatarMoeda(f.comissao), 2, { alinhar: direita })],
              })
          ),
          new TableRow({
            children: [
              c("Comissão a repassar ao consignatário", 0, { negrito: true, fundo: CINZA_CLARO }),
              c(formatarMoeda(a.totalVendido), 1, { negrito: true, fundo: CINZA_CLARO, alinhar: direita }),
              c(formatarMoeda(a.totalComissao), 2, { negrito: true, fundo: CINZA_CLARO, alinhar: direita }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                borders: bordas,
                columnSpan: 2,
                width: { size: cw[0] + cw[1], type: WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 80, right: 80 },
                children: [new Paragraph({ children: [new TextRun({ text: "Valor líquido para a loja", bold: true, size: 18 })] })],
              }),
              c(formatarMoeda(a.liquidoLoja), 2, { negrito: true, alinhar: direita }),
            ],
          }),
        ],
      })
    );
  }

  const doc = new Document({
    creator: "Presente de Deus",
    title: `Consignação #${m.id} - ${m.consignatario}`,
    styles: { default: { document: { run: { font: "Arial" } } } },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 1050, right: 1050 } } },
        children: [...termo, ...relatorio],
      },
    ],
  });

  return Packer.toBlob(doc);
}
