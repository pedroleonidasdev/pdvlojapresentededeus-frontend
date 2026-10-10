"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Consignacao, ItemConsignacao } from "@/lib/types";
import { formatarMoeda, formatarDataISO, formatarDataExtenso } from "@/lib/format";

/**
 * Folha A4 da consignação, no layout dos documentos impressos pela loja:
 *   1ª página: Termo de Responsabilidade (com as porcentagens de comissão)
 *   2ª página em diante: Relatório de Mercadorias em Consignação
 *
 * Com a consignação ABERTA as colunas "Qtde vendida" e "Vlr total vendido"
 * saem em branco, para preencher à mão no acerto. Depois de FECHADA saem
 * preenchidas, junto com o resumo de comissão.
 *
 * Só é montada depois de um clique (nunca no render do servidor), então pode usar
 * document.body direto. É renderizada num portal direto no <body> (e não dentro do layout do
 * dashboard, que tem overflow escondido) para a impressão sair em várias
 * páginas sem cortar. O CSS de impressão (.a4-print, em globals.css) esconde
 * o resto da tela.
 */
export default function FolhaConsignacao({ consignacao }: { consignacao: Consignacao }) {
  // Enquanto a folha está montada, marca o body para o CSS de impressão (globals.css)
  // esconder o resto da tela e usar a página A4 com margem, em vez da bobina de 80mm.
  useEffect(() => {
    document.body.classList.add("imprimindo-a4-fluxo");
    return () => document.body.classList.remove("imprimindo-a4-fluxo");
  }, []);

  const fechada = consignacao.status === "FECHADA";

  // agrupa por categoria; cada grupo recebe a letra inicial + sequência (C001, C002...)
  const grupos = new Map<string, ItemConsignacao[]>();
  for (const item of consignacao.itens) {
    const chave = (item.categoriaNome ?? "Outros").toUpperCase();
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }
  // letras repetidas entre categorias (ex: duas começando com "C") ganham sufixo
  // para o código nunca se repetir no mesmo relatório
  const letrasUsadas = new Map<string, number>();
  const prefixoDe = (categoria: string): string => {
    const base = categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0) || "X";
    const n = (letrasUsadas.get(base) ?? 0) + 1;
    letrasUsadas.set(base, n);
    return n === 1 ? base : `${base}${n}`;
  };

  const linhas: React.ReactNode[] = [];
  let totalQtdEnviada = 0;
  for (const [categoria, itens] of grupos) {
    const prefixo = prefixoDe(categoria);
    linhas.push(
      <tr key={`cat-${categoria}`}>
        <td colSpan={7} style={estiloGrupo}>
          {categoria}:
        </td>
      </tr>
    );
    itens.forEach((item, idx) => {
      totalQtdEnviada += item.quantidadeEnviada;
      linhas.push(
        <tr key={item.id}>
          <td style={{ ...estiloCelula, whiteSpace: "nowrap" }}>{`${prefixo}${String(idx + 1).padStart(3, "0")}`}</td>
          <td style={estiloCelula}>{item.produtoNome}</td>
          <td style={{ ...estiloCelula, textAlign: "center" }}>{item.quantidadeEnviada}</td>
          <td style={{ ...estiloCelula, textAlign: "right", whiteSpace: "nowrap" }}>{formatarMoeda(item.precoUnitario)}</td>
          <td style={{ ...estiloCelula, textAlign: "right", whiteSpace: "nowrap" }}>{formatarMoeda(item.valorEnviado)}</td>
          <td style={{ ...estiloCelula, textAlign: "center" }}>{fechada ? item.quantidadeVendida : ""}</td>
          <td style={{ ...estiloCelula, textAlign: "right", whiteSpace: "nowrap" }}>{fechada ? formatarMoeda(item.valorVendido) : ""}</td>
        </tr>
      );
    });
  }

  // resumo de comissão por faixa (15% / 20%), só faz sentido depois do acerto
  const faixas = [15, 20].map((pct) => {
    const itens = consignacao.itens.filter((i) => i.percentualComissao === pct);
    return {
      pct,
      vendido: itens.reduce((acc, i) => acc + i.valorVendido, 0),
      comissao: itens.reduce((acc, i) => acc + i.comissao, 0),
    };
  });

  const prazo = formatarDataISO(consignacao.prazoDevolucao);

  const conteudo = (
    <div className="a4-print a4-flow hidden" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      {/* ---------- Página 1: Termo de Responsabilidade ---------- */}
      <section>
        <Cabecalho />

        <h1 style={{ textAlign: "center", fontSize: "16px", fontWeight: 700, margin: "28px 0 24px" }}>
          TERMO DE RESPONSABILIDADE
        </h1>

        <p style={estiloParagrafo}>
          {consignacao.consignatario}, responsabiliza-se pela guarda e conservação das mercadorias da relação em
          anexo, de propriedade da Loja Presente de Deus - Livraria Católica e Presentes, a contar da presente data,
          comprometendo-se a devolver o que não for vendido em perfeito estado
          {prazo ? (
            <>
              {" "}
              até o dia <strong>{prazo}</strong>
            </>
          ) : null}
          .
        </p>

        <p style={estiloParagrafo}>
          Das mercadorias que forem vendidas, será repassada a porcentagem para o consignatário, conforme abaixo:
        </p>

        <ul style={{ margin: "8px 0 0 28px", fontSize: "13px", lineHeight: 2 }}>
          <li>
            <strong>15% do total vendido referente a Livros e Bíblias</strong>
          </li>
          <li>
            <strong>20% do total vendido referente aos demais Artigos Religiosos</strong>
          </li>
        </ul>

        {consignacao.observacao && (
          <p style={{ ...estiloParagrafo, marginTop: "18px" }}>
            <strong>Observação:</strong> {consignacao.observacao}
          </p>
        )}

        <p style={{ textAlign: "center", fontSize: "13px", margin: "48px 0 64px" }}>
          Riacho Fundo I – DF, {formatarDataExtenso(consignacao.dataHora)}
        </p>

        <div style={{ display: "flex", gap: "32px", justifyContent: "space-between" }}>
          <Assinatura linha1="EMERSON ALVES ROSA" linha2="PRESENTE DE DEUS" />
          <Assinatura linha1={consignacao.consignatario.toUpperCase()} linha2="CONSIGNATÁRIO" />
        </div>
      </section>

      {/* ---------- Página 2+: Relatório de mercadorias ---------- */}
      <section style={{ breakBefore: "page", pageBreakBefore: "always" }}>
        <Cabecalho compacto />

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
          <thead>
            <tr>
              <th colSpan={7} style={{ ...estiloTitulo, fontSize: "13px" }}>
                RELATÓRIO DE MERCADORIAS EM CONSIGNAÇÃO
                <div style={{ fontSize: "12px", fontWeight: 700 }}>{consignacao.consignatario.toUpperCase()}</div>
              </th>
            </tr>
            <tr>
              <th style={estiloCabecalho}>COD.</th>
              <th style={estiloCabecalho}>PRODUTO</th>
              <th style={estiloCabecalho}>QTDE ENVIADA</th>
              <th style={estiloCabecalho}>VLR UNITÁRIO</th>
              <th style={estiloCabecalho}>VALOR TOTAL</th>
              <th style={estiloCabecalho}>QTDE VENDIDA</th>
              <th style={estiloCabecalho}>VLR TOTAL VENDIDO</th>
            </tr>
          </thead>
          <tbody>{linhas}</tbody>
          <tfoot>
            <tr>
              <td style={estiloTotal} colSpan={2}>
                TOTAL
              </td>
              <td style={{ ...estiloTotal, textAlign: "center" }}>{totalQtdEnviada}</td>
              <td style={estiloTotal} />
              <td style={{ ...estiloTotal, textAlign: "right" }}>{formatarMoeda(consignacao.totalEnviado)}</td>
              <td style={{ ...estiloTotal, textAlign: "center" }}>
                {fechada ? consignacao.itens.reduce((acc, i) => acc + i.quantidadeVendida, 0) : ""}
              </td>
              <td style={{ ...estiloTotal, textAlign: "right" }}>{fechada ? formatarMoeda(consignacao.totalVendido) : ""}</td>
            </tr>
          </tfoot>
        </table>

        {fechada && (
          <table style={{ width: "62%", marginTop: "18px", borderCollapse: "collapse", breakInside: "avoid" }}>
            <thead>
              <tr>
                <th style={{ ...estiloCabecalho, textAlign: "left" }}>ACERTO</th>
                <th style={estiloCabecalho}>VENDIDO</th>
                <th style={estiloCabecalho}>COMISSÃO</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f) => (
                <tr key={f.pct}>
                  <td style={estiloCelula}>{f.pct === 15 ? "Livros e Bíblias (15%)" : "Demais artigos (20%)"}</td>
                  <td style={{ ...estiloCelula, textAlign: "right" }}>{formatarMoeda(f.vendido)}</td>
                  <td style={{ ...estiloCelula, textAlign: "right" }}>{formatarMoeda(f.comissao)}</td>
                </tr>
              ))}
              <tr>
                <td style={estiloTotal}>Comissão a repassar ao consignatário</td>
                <td style={{ ...estiloTotal, textAlign: "right" }}>{formatarMoeda(consignacao.totalVendido)}</td>
                <td style={{ ...estiloTotal, textAlign: "right" }}>{formatarMoeda(consignacao.totalComissao)}</td>
              </tr>
              <tr>
                <td style={estiloCelula} colSpan={2}>
                  <strong>Valor líquido para a loja</strong>
                </td>
                <td style={{ ...estiloCelula, textAlign: "right" }}>
                  <strong>{formatarMoeda(consignacao.totalLiquidoLoja)}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
    </div>
  );

  return createPortal(conteudo, document.body);
}

function Cabecalho({ compacto = false }: { compacto?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/logo-loja.jpg" alt="Presente de Deus" style={{ height: compacto ? "64px" : "92px", objectFit: "contain" }} />
      <div style={{ textAlign: "left", lineHeight: 1.35 }}>
        <div style={{ fontSize: compacto ? "17px" : "22px", fontWeight: 800, color: "#e8731a", letterSpacing: "0.02em" }}>
          PRESENTE DE DEUS
        </div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#1a7f8f" }}>Livraria Católica e Presentes</div>
        <div style={{ fontSize: "10px", fontWeight: 700 }}>CLN 07 BLOCO B LOTE 01 LOJA 04 — Riacho Fundo I - DF</div>
        <div style={{ fontSize: "10px", fontWeight: 700 }}>(61) 3264-0087 (Whatsapp)</div>
        <div style={{ fontSize: "10px", fontWeight: 700 }}>Contato: Emerson - (61) 98139-1833</div>
      </div>
    </div>
  );
}

function Assinatura({ linha1, linha2 }: { linha1: string; linha2: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", fontSize: "12px" }}>
      <div style={{ borderTop: "1px solid #000", paddingTop: "4px" }}>{linha1}</div>
      <div>{linha2}</div>
    </div>
  );
}

const estiloParagrafo: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.9,
  textAlign: "justify",
  textIndent: "32px",
  margin: "0 0 12px",
};

const estiloTitulo: React.CSSProperties = {
  border: "1px solid #000",
  background: "#d9d9d9",
  padding: "5px 6px",
  textAlign: "center",
};

const estiloCabecalho: React.CSSProperties = {
  border: "1px solid #000",
  background: "#d9d9d9",
  padding: "4px 5px",
  fontSize: "9px",
  textAlign: "center",
};

const estiloGrupo: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 6px",
  fontSize: "10px",
  fontWeight: 700,
  textDecoration: "underline",
};

const estiloCelula: React.CSSProperties = {
  border: "1px solid #000",
  padding: "3px 6px",
  fontSize: "10px",
};

const estiloTotal: React.CSSProperties = {
  border: "1px solid #000",
  background: "#f0f0f0",
  padding: "4px 6px",
  fontSize: "10px",
  fontWeight: 700,
};
