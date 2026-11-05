import { Venda } from "@/lib/types";

const AGENTE_CUPOM_URL =
  process.env.NEXT_PUBLIC_GOLDENSKY_CUPOM_URL ?? "http://localhost:9100/imprimir-cupom";

export async function imprimirCupom(venda: Venda): Promise<void> {
  const resposta = await fetch(AGENTE_CUPOM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: venda.id,
      usuarioNome: venda.usuarioNome,
      dataHora: venda.dataHora,
      formaPagamento: venda.formaPagamento,
      pagamentos: venda.pagamentos ?? [],
      subtotal: venda.subtotal,
      percentualDesconto: venda.percentualDesconto,
      valorDesconto: venda.valorDesconto,
      total: venda.total,
      itens: venda.itens.map((item) => ({
        id: item.id,
        produtoNome: item.produtoNome,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      })),
    }),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(
      dados?.mensagem ??
        "Não foi possível imprimir o cupom. Verifique se o agente Goldensky está em execução."
    );
  }
}

// --- Etiquetas de preço ------------------------------------------------------
// O agente local (backend/scripts/goldensky-agente.py) imprime etiquetas em duas
// impressoras, conforme ETIQUETA_DRIVER no computador da loja:
//   zpl    -> Elgin/Bematech L42 Pro Full (ZPL nativo, aceita "quantidade" por item) — padrão
//   escpos -> modo antigo (Goldensky 80mm); a loja agora usa a Goldensky só para o cupom
// A tela pergunta ao agente (GET /status) qual está em uso e se adapta.

export const AGENTE_ETIQUETAS_URL =
  process.env.NEXT_PUBLIC_GOLDENSKY_AGENTE_URL ?? "http://localhost:9100/imprimir-etiquetas";

const AGENTE_STATUS_URL = AGENTE_ETIQUETAS_URL.replace(/\/imprimir-etiquetas\/?$/, "/status");

export type DriverEtiquetas = "escpos" | "zpl";

export interface PerfilImpressoraEtiquetas {
  driver: DriverEtiquetas;
  nome: string;
  larguraMaxMm: number;
  /** true = o agente repete a etiqueta sozinho (campo "quantidade"); false = o front repete os itens */
  suportaQuantidade: boolean;
}

export const PERFIL_GOLDENSKY: PerfilImpressoraEtiquetas = {
  driver: "escpos",
  nome: "Goldensky 80mm",
  larguraMaxMm: 80,
  suportaQuantidade: false,
};

// Impressora de etiquetas da loja (a Goldensky imprime só o cupom não fiscal).
export const PERFIL_ELGIN: PerfilImpressoraEtiquetas = {
  driver: "zpl",
  nome: "Elgin L42 Pro Full",
  larguraMaxMm: 108,
  suportaQuantidade: true,
};

/**
 * Pergunta ao agente local qual impressora de etiquetas está em uso.
 * Retorna null se o agente não responde (desligado / outro computador).
 * Agente antigo (só devolve {status:"ok"}) cai no perfil da Goldensky.
 */
export async function consultarImpressoraEtiquetas(): Promise<PerfilImpressoraEtiquetas | null> {
  try {
    const resposta = await fetch(AGENTE_STATUS_URL, { signal: AbortSignal.timeout(3000) });
    if (!resposta.ok) return null;
    const dados = await resposta.json().catch(() => null);
    if (!dados || dados.driver !== "zpl") return PERFIL_GOLDENSKY;
    return {
      driver: "zpl",
      nome: typeof dados.impressora === "string" ? dados.impressora : "Elgin L42 Pro Full",
      larguraMaxMm: typeof dados.larguraMaxMm === "number" ? dados.larguraMaxMm : 108,
      suportaQuantidade: dados.suportaQuantidade !== false,
    };
  } catch {
    return null;
  }
}

export interface EtiquetaParaImprimir {
  nome: string;
  precoVenda: number;
  codigoBarras: string;
  /** só é respeitado quando o perfil tem suportaQuantidade (ZPL) */
  quantidade?: number;
}

export async function imprimirEtiquetas(payload: {
  etiquetas: EtiquetaParaImprimir[];
  largura: number;
  altura: number;
  espacamento?: number;
  /** etiquetas lado a lado na bobina (dupla = 2). Só a Elgin (ZPL) usa. */
  colunas?: number;
  /** espaço horizontal entre colunas, em mm */
  espacamentoColunas?: number;
}): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch(AGENTE_ETIQUETAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(
      "Não foi possível conectar ao agente de impressão neste computador. " +
        "Verifique se o serviço goldensky-agente está rodando " +
        "(sudo systemctl status goldensky-agente)."
    );
  }

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.mensagem ?? "Não foi possível imprimir as etiquetas.");
  }
}
