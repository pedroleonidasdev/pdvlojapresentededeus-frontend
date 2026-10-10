import { carregarLogo, LOJA, ModeloConsignacao } from "./consignacao-modelo";

const MOEDA = '"R$" #,##0.00';

/**
 * Excel (.xlsx) com duas abas: "Relatório" (tabela com fórmulas nos totais, para
 * continuar editando) e "Termo" (texto do termo de responsabilidade).
 */
export async function gerarExcelConsignacao(m: ModeloConsignacao): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const logo = await carregarLogo();

  const wb = new ExcelJS.Workbook();
  wb.creator = "Presente de Deus";
  wb.title = `Consignação #${m.id} - ${m.consignatario}`;

  const borda = {
    top: { style: "thin" as const },
    bottom: { style: "thin" as const },
    left: { style: "thin" as const },
    right: { style: "thin" as const },
  };
  const cinza = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFD9D9D9" } };
  const cinzaClaro = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF0F0F0" } };

  // ------------------------------- Relatório -------------------------------
  const ws = wb.addWorksheet("Relatório", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });
  const LARGURA_PRODUTO = 46;
  ws.columns = [{ width: 16 }, { width: LARGURA_PRODUTO }, { width: 11 }, { width: 14 }, { width: 14 }, { width: 11 }, { width: 16 }];

  // cabeçalho da loja (linhas 1 a 5) — logo à esquerda, textos ao lado
  const cabecalhoLinhas: [string, boolean, string?][] = [
    [LOJA.nome, true, "FFE8731A"],
    [LOJA.subtitulo, true, "FF1A7F8F"],
    [LOJA.endereco, true],
    [LOJA.telefone, true],
    [LOJA.contato, true],
  ];
  cabecalhoLinhas.forEach(([texto, negrito, cor], i) => {
    ws.mergeCells(i + 1, 3, i + 1, 7);
    const c = ws.getCell(i + 1, 3);
    c.value = texto;
    c.font = { bold: negrito, size: i === 0 ? 16 : i === 1 ? 11 : 9, color: cor ? { argb: cor } : undefined };
    c.alignment = { vertical: "middle", horizontal: "left" };
  });
  ws.getRow(1).height = 24;
  if (logo) {
    const id = wb.addImage({ base64: logo.dataUrl, extension: "jpeg" });
    const alt = 80; // px
    ws.addImage(id, { tl: { col: 0.2, row: 0.15 }, ext: { width: (logo.largura / logo.altura) * alt, height: alt } });
  }

  let linha = 7;
  ws.mergeCells(linha, 1, linha, 7);
  const titulo = ws.getCell(linha, 1);
  titulo.value = `RELATÓRIO DE MERCADORIAS EM CONSIGNAÇÃO\n${m.consignatario.toUpperCase()}`;
  titulo.font = { bold: true, size: 12 };
  titulo.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  titulo.fill = cinza;
  for (let c = 1; c <= 7; c++) ws.getCell(linha, c).border = borda;
  ws.getRow(linha).height = 34;

  linha++;
  ["COD.", "PRODUTO", "QTDE ENVIADA", "VLR UNITÁRIO", "VALOR TOTAL", "QTDE VENDIDA", "VLR TOTAL VENDIDO"].forEach((t, i) => {
    const c = ws.getCell(linha, i + 1);
    c.value = t;
    c.font = { bold: true, size: 9 };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = cinza;
    c.border = borda;
  });
  ws.getRow(linha).height = 28;
  const linhaCabecalhoTabela = linha;
  // ao imprimir em várias páginas, o título e o cabeçalho das colunas se repetem em todas
  ws.pageSetup.printTitlesRow = `${linhaCabecalhoTabela - 1}:${linhaCabecalhoTabela}`;

  for (const g of m.grupos) {
    linha++;
    ws.mergeCells(linha, 1, linha, 7);
    const gc = ws.getCell(linha, 1);
    gc.value = `${g.categoria}:`;
    gc.font = { bold: true, underline: true, size: 10 };
    for (let c = 1; c <= 7; c++) ws.getCell(linha, c).border = borda;

    for (const l of g.linhas) {
      linha++;
      const r = ws.getRow(linha);
      r.getCell(1).value = l.cod;
      r.getCell(2).value = l.produto;
      // nome longo quebra em mais de uma linha (com a altura da linha ajustada) em vez de ser cortado
      const linhasNome = Math.max(1, Math.ceil(l.produto.length / (LARGURA_PRODUTO - 6)));
      if (linhasNome > 1) r.height = linhasNome * 14;
      r.getCell(3).value = l.qtdEnviada;
      r.getCell(4).value = l.vlrUnitario;
      r.getCell(5).value = { formula: `C${linha}*D${linha}`, result: l.vlrTotal };
      r.getCell(6).value = l.qtdVendida;
      r.getCell(7).value =
        l.qtdVendida === null ? null : { formula: `F${linha}*D${linha}`, result: l.vlrVendido ?? 0 };
      for (let c = 1; c <= 7; c++) {
        const cell = r.getCell(c);
        cell.border = borda;
        cell.font = { size: 10 };
        cell.alignment = { vertical: "middle", wrapText: c === 2 };
        if (c === 3 || c === 6) cell.alignment = { vertical: "middle", horizontal: "center" };
        if (c === 4 || c === 5 || c === 7) {
          cell.numFmt = MOEDA;
          cell.alignment = { vertical: "middle", horizontal: "right" };
        }
      }
    }
  }

  const primeira = linhaCabecalhoTabela + 1;
  const ultima = linha;
  linha++;
  const t = ws.getRow(linha);
  ws.mergeCells(linha, 1, linha, 2);
  t.getCell(1).value = "TOTAL";
  t.getCell(3).value = { formula: `SUM(C${primeira}:C${ultima})`, result: m.totais.qtdEnviada };
  t.getCell(5).value = { formula: `SUM(E${primeira}:E${ultima})`, result: m.totais.vlrEnviado };
  if (m.totais.qtdVendida !== null) {
    t.getCell(6).value = { formula: `SUM(F${primeira}:F${ultima})`, result: m.totais.qtdVendida };
    t.getCell(7).value = { formula: `SUM(G${primeira}:G${ultima})`, result: m.totais.vlrVendido ?? 0 };
  }
  for (let c = 1; c <= 7; c++) {
    const cell = t.getCell(c);
    cell.font = { bold: true, size: 10 };
    cell.fill = cinzaClaro;
    cell.border = borda;
    if (c === 3 || c === 6) cell.alignment = { horizontal: "center" };
    if (c === 5 || c === 7) {
      cell.numFmt = MOEDA;
      cell.alignment = { horizontal: "right" };
    }
  }
  const linhaTotal = linha;

  if (m.acerto) {
    const a = m.acerto;
    linha += 2;
    ["ACERTO", "", "", "VENDIDO", "COMISSÃO"].forEach((tx, i) => {
      const c = ws.getCell(linha, i + 1);
      c.value = tx || null;
      c.font = { bold: true, size: 9 };
      c.fill = cinza;
      c.border = borda;
      if (i >= 3) c.alignment = { horizontal: "right" };
    });
    ws.mergeCells(linha, 1, linha, 3);

    const primeiraFaixa = linha + 1;
    for (const f of a.faixas) {
      linha++;
      ws.mergeCells(linha, 1, linha, 3);
      ws.getCell(linha, 1).value = f.rotulo;
      ws.getCell(linha, 4).value = f.vendido;
      ws.getCell(linha, 5).value = f.comissao;
      for (let c = 1; c <= 5; c++) {
        const cell = ws.getCell(linha, c);
        cell.border = borda;
        cell.font = { size: 10 };
        if (c >= 4) cell.numFmt = MOEDA;
      }
    }
    linha++;
    ws.mergeCells(linha, 1, linha, 3);
    ws.getCell(linha, 1).value = "Comissão a repassar ao consignatário";
    ws.getCell(linha, 4).value = { formula: `SUM(D${primeiraFaixa}:D${linha - 1})`, result: a.totalVendido };
    ws.getCell(linha, 5).value = { formula: `SUM(E${primeiraFaixa}:E${linha - 1})`, result: a.totalComissao };
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(linha, c);
      cell.border = borda;
      cell.font = { bold: true, size: 10 };
      cell.fill = cinzaClaro;
      if (c >= 4) cell.numFmt = MOEDA;
    }
    const linhaComissao = linha;
    linha++;
    ws.mergeCells(linha, 1, linha, 4);
    ws.getCell(linha, 1).value = "Valor líquido para a loja";
    ws.getCell(linha, 5).value = { formula: `D${linhaComissao}-E${linhaComissao}`, result: a.liquidoLoja };
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(linha, c);
      cell.border = borda;
      cell.font = { bold: true, size: 10 };
      if (c === 5) cell.numFmt = MOEDA;
    }
    void linhaTotal;
  }

  // --------------------------------- Termo ---------------------------------
  const wt = wb.addWorksheet("Termo", {
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
  });
  wt.columns = [{ width: 4 }, { width: 100 }];
  const escreve = (r: number, texto: string, opts: { negrito?: boolean; centro?: boolean; tam?: number; altura?: number } = {}) => {
    const c = wt.getCell(r, 2);
    c.value = texto;
    c.font = { bold: opts.negrito, size: opts.tam ?? 12 };
    c.alignment = { wrapText: true, vertical: "top", horizontal: opts.centro ? "center" : "left" };
    if (opts.altura) wt.getRow(r).height = opts.altura;
  };
  escreve(1, LOJA.nome, { negrito: true, tam: 18, centro: true });
  wt.getCell(1, 2).font = { bold: true, size: 18, color: { argb: "FFE8731A" } };
  escreve(2, LOJA.subtitulo, { negrito: true, centro: true });
  wt.getCell(2, 2).font = { bold: true, size: 12, color: { argb: "FF1A7F8F" } };
  escreve(3, LOJA.endereco, { negrito: true, centro: true, tam: 10 });
  escreve(4, LOJA.telefone, { negrito: true, centro: true, tam: 10 });
  escreve(5, LOJA.contato, { negrito: true, centro: true, tam: 10 });
  escreve(7, "TERMO DE RESPONSABILIDADE", { negrito: true, centro: true, tam: 14, altura: 26 });
  let r = 9;
  for (const p of m.paragrafos) {
    escreve(r, p, { altura: Math.max(34, Math.ceil(p.length / 95) * 20) });
    r += 2;
  }
  for (const item of m.porcentagens) {
    escreve(r, `•  ${item}`, { negrito: true });
    r++;
  }
  if (m.observacao) {
    r++;
    escreve(r, `Observação: ${m.observacao}`);
    r++;
  }
  r += 2;
  escreve(r, `Riacho Fundo I – DF, ${m.dataExtenso}`, { centro: true });
  r += 4;
  escreve(r, `______________________________          ______________________________`, { centro: true });
  r++;
  escreve(r, `${LOJA.responsavel} - PRESENTE DE DEUS          ${m.consignatario.toUpperCase()} - CONSIGNATÁRIO`, { centro: true, tam: 10 });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
