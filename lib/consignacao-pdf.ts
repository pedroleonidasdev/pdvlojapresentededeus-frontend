import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";
import { formatarMoeda } from "./format";

const LARGURA = 210;
const MARGEM = 15;
const LARGURA_UTIL = LARGURA - MARGEM * 2;
const LARANJA: [number, number, number] = [232, 115, 26];
const AZUL: [number, number, number] = [26, 127, 143];
const CINZA: [number, number, number] = [217, 217, 217];

/** PDF A4 vetorial (texto selecionável): Termo de Responsabilidade + Relatório de mercadorias. */
export async function gerarPdfConsignacao(m: ModeloConsignacao): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const logo = await carregarLogo();

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setProperties({ title: `Consignação #${m.id} - ${m.consignatario}`, author: "Presente de Deus" });

  /** Desenha logo + dados da loja centralizados e devolve o Y logo abaixo do cabeçalho. */
  function cabecalho(y: number, compacto: boolean): number {
    const altLogo = compacto ? 16 : 24;
    const largLogo = logo ? (logo.largura / logo.altura) * altLogo : 0;
    const tamNome = compacto ? 15 : 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(tamNome);
    const larguraNome = doc.getTextWidth(LOJA.nome);
    doc.setFontSize(8);
    const larguraLinhas = Math.max(
      larguraNome,
      doc.getTextWidth(LOJA.endereco),
      doc.getTextWidth(LOJA.telefone),
      doc.getTextWidth(LOJA.contato)
    );
    const folga = logo ? 4 : 0;
    const total = largLogo + folga + larguraLinhas;
    const xInicio = (LARGURA - total) / 2;

    if (logo) doc.addImage(logo.dataUrl, "JPEG", xInicio, y, largLogo, altLogo);
    const xTexto = xInicio + largLogo + folga;

    doc.setFontSize(tamNome);
    doc.setTextColor(...LARANJA);
    doc.text(LOJA.nome, xTexto, y + (compacto ? 5 : 7));
    doc.setFontSize(compacto ? 9 : 10.5);
    doc.setTextColor(...AZUL);
    doc.text(LOJA.subtitulo, xTexto, y + (compacto ? 9.5 : 13));
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(LOJA.endereco, xTexto, y + (compacto ? 13 : 17.5));
    doc.text(LOJA.telefone, xTexto, y + (compacto ? 16.5 : 21));
    doc.text(LOJA.contato, xTexto, y + (compacto ? 20 : 24.5));
    return y + Math.max(altLogo, compacto ? 21 : 26) + 4;
  }

  // ------------------------ Página 1: Termo de Responsabilidade ------------------------
  let y = cabecalho(MARGEM, false);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("TERMO DE RESPONSABILIDADE", LARGURA / 2, y, { align: "center" });
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const p of m.paragrafos) {
    const linhas = doc.splitTextToSize(p, LARGURA_UTIL - 10) as string[];
    doc.text(linhas, MARGEM + 10, y, { align: "left", maxWidth: LARGURA_UTIL - 10, lineHeightFactor: 1.7 });
    y += linhas.length * 6.6 + 3;
  }

  y += 2;
  doc.setFont("helvetica", "bold");
  for (const item of m.porcentagens) {
    doc.text("•", MARGEM + 12, y);
    doc.text(item, MARGEM + 18, y);
    y += 8;
  }

  if (m.observacao) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Observação:", MARGEM + 10, y);
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(m.observacao, LARGURA_UTIL - 38) as string[];
    doc.text(obs, MARGEM + 38, y);
    y += obs.length * 6;
  }

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.text(`Riacho Fundo I – DF, ${m.dataExtenso}`, LARGURA / 2, y, { align: "center" });

  y += 30;
  const larguraAssinatura = (LARGURA_UTIL - 12) / 2;
  const assinaturas: [string, string][] = [
    [LOJA.responsavel, "PRESENTE DE DEUS"],
    [m.consignatario.toUpperCase(), "CONSIGNATÁRIO"],
  ];
  assinaturas.forEach(([linha1, linha2], idx) => {
    const x = MARGEM + idx * (larguraAssinatura + 12);
    doc.setLineWidth(0.3);
    doc.line(x, y, x + larguraAssinatura, y);
    doc.setFontSize(10);
    const nome = doc.splitTextToSize(linha1, larguraAssinatura) as string[];
    doc.text(nome, x + larguraAssinatura / 2, y + 5, { align: "center" });
    doc.text(linha2, x + larguraAssinatura / 2, y + 5 + nome.length * 4.5, { align: "center" });
  });

  // ------------------------ Página 2+: Relatório de mercadorias ------------------------
  doc.addPage();
  const yTabela = cabecalho(MARGEM, true) + 2;

  const centro = { halign: "center" as const };
  const direita = { halign: "right" as const };
  type Celula = string | { content: string; colSpan?: number; styles?: Record<string, unknown> };
  const corpo: Celula[][] = [];
  for (const g of m.grupos) {
    corpo.push([
      {
        content: `${g.categoria}:`,
        colSpan: 7,
        styles: { fontStyle: "bold", fillColor: [255, 255, 255], halign: "left" },
      },
    ]);
    for (const l of g.linhas) {
      corpo.push([
        l.cod,
        l.produto,
        String(l.qtdEnviada),
        formatarMoeda(l.vlrUnitario),
        formatarMoeda(l.vlrTotal),
        l.qtdVendida === null ? "" : String(l.qtdVendida),
        l.vlrVendido === null ? "" : formatarMoeda(l.vlrVendido),
      ]);
    }
  }

  autoTable(doc, {
    startY: yTabela,
    margin: { left: MARGEM, right: MARGEM, top: MARGEM, bottom: MARGEM },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: CINZA, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", fontSize: 7.5 },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 62 },
      2: { cellWidth: 18, ...centro },
      3: { cellWidth: 22, ...direita },
      4: { cellWidth: 22, ...direita },
      5: { cellWidth: 18, ...centro },
      6: { cellWidth: 22, ...direita },
    },
    head: [
      [
        {
          content: `RELATÓRIO DE MERCADORIAS EM CONSIGNAÇÃO\n${m.consignatario.toUpperCase()}`,
          colSpan: 7,
          styles: { halign: "center", fontSize: 10, cellPadding: 2.2 },
        },
      ],
      ["COD.", "PRODUTO", "QTDE ENVIADA", "VLR UNITÁRIO", "VALOR TOTAL", "QTDE VENDIDA", "VLR TOTAL VENDIDO"],
    ],
    body: corpo as never,
    foot: [
      [
        { content: "TOTAL", colSpan: 2 },
        { content: String(m.totais.qtdEnviada), styles: centro },
        "",
        { content: formatarMoeda(m.totais.vlrEnviado), styles: direita },
        { content: m.totais.qtdVendida === null ? "" : String(m.totais.qtdVendida), styles: centro },
        { content: m.totais.vlrVendido === null ? "" : formatarMoeda(m.totais.vlrVendido), styles: direita },
      ],
    ] as never,
    showFoot: "lastPage",
  });

  if (m.acerto) {
    const acerto = m.acerto;
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(doc, {
      startY: finalY + 8,
      margin: { left: MARGEM, right: MARGEM, top: MARGEM, bottom: MARGEM },
      tableWidth: 112,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
      headStyles: { fillColor: CINZA, textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 26, ...direita }, 2: { cellWidth: 26, ...direita } },
      head: [["ACERTO", { content: "VENDIDO", styles: direita }, { content: "COMISSÃO", styles: direita }]] as never,
      body: [
        ...acerto.faixas.map((f) => [f.rotulo, formatarMoeda(f.vendido), formatarMoeda(f.comissao)]),
        [
          { content: "Comissão a repassar ao consignatário", styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: formatarMoeda(acerto.totalVendido), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
          { content: formatarMoeda(acerto.totalComissao), styles: { fontStyle: "bold", fillColor: [240, 240, 240] } },
        ],
        [
          { content: "Valor líquido para a loja", colSpan: 2, styles: { fontStyle: "bold" } },
          { content: formatarMoeda(acerto.liquidoLoja), styles: { fontStyle: "bold" } },
        ],
      ] as never,
    });
  }

  // numeração "Página X de Y" no rodapé de todas as páginas
  const total = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 110);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.text(`Página ${i} de ${total}`, LARGURA - MARGEM, 290, { align: "right" });
  }

  return doc.output("blob");
}
