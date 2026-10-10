import { Consignacao } from "./types";
import { formatarDataExtenso, formatarDataISO } from "./format";

/** Dados fixos da loja que saem no cabeçalho dos documentos impressos. */
export const LOJA = {
  nome: "PRESENTE DE DEUS",
  subtitulo: "Livraria Católica e Presentes",
  endereco: "CLN 07 BLOCO B LOTE 01 LOJA 04 - Riacho Fundo I - DF",
  telefone: "(61) 3264-0087 (Whatsapp)",
  contato: "Contato: Emerson - (61) 98139-1833",
  responsavel: "EMERSON ALVES ROSA",
};

export interface LinhaModelo {
  cod: string;
  produto: string;
  qtdEnviada: number;
  vlrUnitario: number;
  vlrTotal: number;
  /** null enquanto a consignação está aberta (coluna sai em branco para preencher à mão) */
  qtdVendida: number | null;
  vlrVendido: number | null;
}

export interface GrupoModelo {
  categoria: string;
  linhas: LinhaModelo[];
}

export interface FaixaModelo {
  rotulo: string;
  vendido: number;
  comissao: number;
}

/**
 * Tudo que os documentos (visualização/PDF, Excel e Word) precisam, já calculado
 * uma única vez — assim os três formatos saem sempre com os mesmos números.
 */
export interface ModeloConsignacao {
  id: number;
  fechada: boolean;
  consignatario: string;
  paragrafos: string[];
  porcentagens: string[];
  observacao: string | null;
  dataExtenso: string;
  prazo: string;
  grupos: GrupoModelo[];
  totais: { qtdEnviada: number; vlrEnviado: number; qtdVendida: number | null; vlrVendido: number | null };
  /** Só existe depois do fechamento. */
  acerto: { faixas: FaixaModelo[]; totalVendido: number; totalComissao: number; liquidoLoja: number } | null;
  nomeArquivoBase: string;
}

export function montarModeloConsignacao(c: Consignacao): ModeloConsignacao {
  const fechada = c.status === "FECHADA";

  const porCategoria = new Map<string, Consignacao["itens"]>();
  for (const item of c.itens) {
    const chave = (item.categoriaNome ?? "Outros").toUpperCase();
    porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), item]);
  }

  // código = letra inicial da categoria + sequência (C001, C002...); se duas categorias
  // começarem com a mesma letra, a segunda ganha um número (C2001) para não repetir
  const letrasUsadas = new Map<string, number>();
  const grupos: GrupoModelo[] = [];
  for (const [categoria, itens] of porCategoria) {
    const base = categoria.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0) || "X";
    const n = (letrasUsadas.get(base) ?? 0) + 1;
    letrasUsadas.set(base, n);
    const prefixo = n === 1 ? base : `${base}${n}`;
    grupos.push({
      categoria,
      linhas: itens.map((i, idx) => ({
        cod: `${prefixo}${String(idx + 1).padStart(3, "0")}`,
        produto: i.produtoNome,
        qtdEnviada: i.quantidadeEnviada,
        vlrUnitario: i.precoUnitario,
        vlrTotal: i.valorEnviado,
        qtdVendida: fechada ? i.quantidadeVendida : null,
        vlrVendido: fechada ? i.valorVendido : null,
      })),
    });
  }

  const prazo = formatarDataISO(c.prazoDevolucao);
  const paragrafos = [
    `${c.consignatario}, responsabiliza-se pela guarda e conservação das mercadorias da relação em anexo, ` +
      `de propriedade da Loja Presente de Deus - Livraria Católica e Presentes, a contar da presente data, ` +
      `comprometendo-se a devolver o que não for vendido em perfeito estado${prazo ? ` até o dia ${prazo}` : ""}.`,
    "Das mercadorias que forem vendidas, será repassada a porcentagem para o consignatário, conforme abaixo:",
  ];

  const faixas: FaixaModelo[] = [15, 20].map((pct) => {
    const itens = c.itens.filter((i) => i.percentualComissao === pct);
    return {
      rotulo: pct === 15 ? "Livros e Bíblias (15%)" : "Demais artigos (20%)",
      vendido: itens.reduce((acc, i) => acc + i.valorVendido, 0),
      comissao: itens.reduce((acc, i) => acc + i.comissao, 0),
    };
  });

  const slug = c.consignatario
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return {
    id: c.id,
    fechada,
    consignatario: c.consignatario,
    paragrafos,
    porcentagens: [
      "15% do total vendido referente a Livros e Bíblias",
      "20% do total vendido referente aos demais Artigos Religiosos",
    ],
    observacao: c.observacao,
    dataExtenso: formatarDataExtenso(c.dataHora),
    prazo,
    grupos,
    totais: {
      qtdEnviada: c.itens.reduce((acc, i) => acc + i.quantidadeEnviada, 0),
      vlrEnviado: c.totalEnviado,
      qtdVendida: fechada ? c.itens.reduce((acc, i) => acc + i.quantidadeVendida, 0) : null,
      vlrVendido: fechada ? c.totalVendido : null,
    },
    acerto: fechada
      ? { faixas, totalVendido: c.totalVendido, totalComissao: c.totalComissao, liquidoLoja: c.totalLiquidoLoja }
      : null,
    nomeArquivoBase: `consignacao-${c.id}-${slug || "relatorio"}`,
  };
}

/** Baixa o logo da loja para embutir nos documentos; devolve null se não conseguir (sai sem logo). */
export async function carregarLogo(): Promise<{ bytes: ArrayBuffer; dataUrl: string; largura: number; altura: number } | null> {
  try {
    const resp = await fetch("/images/logo-loja.jpg");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bytes = await blob.arrayBuffer();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const dim = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { bytes, dataUrl, largura: dim.w, altura: dim.h };
  } catch {
    return null;
  }
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
