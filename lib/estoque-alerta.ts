import { useCallback, useEffect, useState } from "react";
import { Produto } from "@/lib/types";

/**
 * Regras de alerta de estoque.
 *
 * Os conceitos são os usados em gestão de estoque: estoque mínimo (de segurança),
 * ponto de reposição, ruptura (produto zerado), taxa de ruptura e sistema
 * mínimo/máximo para sugerir quanto comprar. Os PERCENTUAIS de corte (50%, 150%,
 * 20%...) são regras práticas comuns, mas variam de negócio pra negócio — por
 * isso todos podem ser ajustados na tela e ficam salvos neste navegador.
 */

export type NivelEstoque = "RUPTURA" | "CRITICO" | "BAIXO" | "ATENCAO" | "OK" | "SEM_MINIMO";

/** Filtro da tela: um nível específico, ou "ALERTA" = ruptura + crítico + abaixo do mínimo. */
export type FiltroEstoque = NivelEstoque | "ALERTA";

export interface ConfigAlertaEstoque {
  /** até quantos % do estoque mínimo o produto é considerado CRÍTICO */
  criticoPct: number;
  /** até quantos % do estoque mínimo o produto entra em ATENÇÃO (chegando perto do mínimo) */
  atencaoPct: number;
  /** alerta geral quando esta % do catálogo (ou mais) estiver abaixo do mínimo */
  alertaCatalogoPct: number;
  /** sistema mín./máx.: a sugestão de compra leva o estoque até (mínimo × este valor) */
  coberturaAlvo: number;
}

export const CONFIG_PADRAO: ConfigAlertaEstoque = {
  criticoPct: 50,
  atencaoPct: 150,
  alertaCatalogoPct: 20,
  coberturaAlvo: 2,
};

const CHAVE_STORAGE = "loja:estoque-alerta:v1";

function limitar(valor: unknown, min: number, max: number, padrao: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

export function sanearConfig(c: Partial<ConfigAlertaEstoque>): ConfigAlertaEstoque {
  return {
    criticoPct: limitar(c.criticoPct, 1, 99, CONFIG_PADRAO.criticoPct),
    atencaoPct: limitar(c.atencaoPct, 101, 500, CONFIG_PADRAO.atencaoPct),
    alertaCatalogoPct: limitar(c.alertaCatalogoPct, 1, 100, CONFIG_PADRAO.alertaCatalogoPct),
    coberturaAlvo: limitar(c.coberturaAlvo, 1.1, 10, CONFIG_PADRAO.coberturaAlvo),
  };
}

/** Parâmetros de alerta, salvos no navegador (localStorage). */
export function useConfigAlertaEstoque(): [ConfigAlertaEstoque, (c: Partial<ConfigAlertaEstoque>) => void, () => void] {
  const [config, setConfig] = useState<ConfigAlertaEstoque>(CONFIG_PADRAO);

  useEffect(() => {
    try {
      const bruto = window.localStorage.getItem(CHAVE_STORAGE);
      if (bruto) setConfig(sanearConfig(JSON.parse(bruto)));
    } catch {
      // storage indisponível: segue com o padrão
    }
  }, []);

  const salvar = useCallback((nova: Partial<ConfigAlertaEstoque>) => {
    const limpa = sanearConfig(nova);
    setConfig(limpa);
    try {
      window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(limpa));
    } catch {
      // sem storage, vale só nesta visita
    }
  }, []);

  const restaurar = useCallback(() => {
    setConfig(CONFIG_PADRAO);
    try {
      window.localStorage.removeItem(CHAVE_STORAGE);
    } catch {
      // ignora
    }
  }, []);

  return [config, salvar, restaurar];
}

export interface SituacaoEstoque {
  nivel: NivelEstoque;
  /** quantidade atual como % do mínimo (null quando não há mínimo definido) */
  pct: number | null;
  /** unidades a comprar para voltar ao nível-alvo (0 quando não precisa repor) */
  sugestao: number;
  /** custo estimado da reposição (null quando o produto não tem preço de custo) */
  custoSugestao: number | null;
}

export function situacaoEstoque(p: Produto, cfg: ConfigAlertaEstoque): SituacaoEstoque {
  const qtd = p.quantidadeEstoque ?? 0;
  const minimo = p.estoqueMinimo != null && p.estoqueMinimo > 0 ? p.estoqueMinimo : null;
  const pct = minimo ? (qtd / minimo) * 100 : null;

  let nivel: NivelEstoque;
  if (qtd <= 0) nivel = "RUPTURA";
  else if (minimo === null) nivel = "SEM_MINIMO";
  else if (pct! <= cfg.criticoPct) nivel = "CRITICO";
  else if (pct! <= 100) nivel = "BAIXO";
  else if (pct! <= cfg.atencaoPct) nivel = "ATENCAO";
  else nivel = "OK";

  const precisaRepor = nivel === "RUPTURA" || nivel === "CRITICO" || nivel === "BAIXO";
  const sugestao = precisaRepor && minimo ? Math.max(0, Math.ceil(minimo * cfg.coberturaAlvo) - Math.max(qtd, 0)) : 0;
  const custoSugestao = sugestao > 0 && p.precoCusto != null ? sugestao * p.precoCusto : null;

  return { nivel, pct, sugestao, custoSugestao };
}

export function emAlerta(nivel: NivelEstoque): boolean {
  return nivel === "RUPTURA" || nivel === "CRITICO" || nivel === "BAIXO";
}

export function combinaFiltro(nivel: NivelEstoque, filtro: FiltroEstoque): boolean {
  return filtro === "ALERTA" ? emAlerta(nivel) : nivel === filtro;
}

export interface MetaNivel {
  rotulo: string;
  /** classes do selo (fundo + texto + borda) */
  selo: string;
  /** cor sólida (barras e legendas) */
  barra: string;
  texto: string;
  ordem: number;
}

export const META_NIVEL: Record<NivelEstoque, MetaNivel> = {
  RUPTURA: { rotulo: "Ruptura", selo: "bg-danger text-white border-danger", barra: "bg-danger", texto: "text-danger", ordem: 0 },
  CRITICO: { rotulo: "Crítico", selo: "bg-danger-light text-danger border-danger/40", barra: "bg-[#E0705F]", texto: "text-danger", ordem: 1 },
  BAIXO: { rotulo: "Abaixo do mínimo", selo: "bg-accent-light text-accent-dark border-accent/50", barra: "bg-accent", texto: "text-accent-dark", ordem: 2 },
  ATENCAO: { rotulo: "Atenção", selo: "bg-[#FFF4CC] text-[#8A6D00] border-[#E6CF73]", barra: "bg-[#E6CF73]", texto: "text-[#8A6D00]", ordem: 3 },
  OK: { rotulo: "Saudável", selo: "bg-success-light text-success border-success/40", barra: "bg-success", texto: "text-success", ordem: 4 },
  SEM_MINIMO: { rotulo: "Sem mínimo definido", selo: "bg-surface-alt text-muted border-border", barra: "bg-[#B9C6C3]", texto: "text-muted", ordem: 5 },
};

export function descricaoNivel(nivel: NivelEstoque, cfg: ConfigAlertaEstoque): string {
  switch (nivel) {
    case "RUPTURA":
      return "Estoque zerado: venda perdida";
    case "CRITICO":
      return `Até ${cfg.criticoPct}% do mínimo`;
    case "BAIXO":
      return `Entre ${cfg.criticoPct}% e 100% do mínimo`;
    case "ATENCAO":
      return `Entre 100% e ${cfg.atencaoPct}% do mínimo`;
    case "OK":
      return `Acima de ${cfg.atencaoPct}% do mínimo`;
    case "SEM_MINIMO":
      return "Cadastre o mínimo para monitorar";
  }
}

export interface ResumoEstoque {
  total: number;
  porNivel: Record<NivelEstoque, Produto[]>;
  emAlerta: number;
  pctEmAlerta: number; // 0..100
  taxaRuptura: number; // 0..100
  alertaGeral: boolean;
  unidades: number;
  valorCusto: number;
  valorVenda: number;
  semCusto: number;
  investimento: number;
  semCustoReposicao: number;
  prioridade: { produto: Produto; situacao: SituacaoEstoque }[];
}

export function resumirEstoque(produtos: Produto[], cfg: ConfigAlertaEstoque): ResumoEstoque {
  const porNivel: Record<NivelEstoque, Produto[]> = {
    RUPTURA: [],
    CRITICO: [],
    BAIXO: [],
    ATENCAO: [],
    OK: [],
    SEM_MINIMO: [],
  };
  let unidades = 0;
  let valorCusto = 0;
  let valorVenda = 0;
  let semCusto = 0;
  let investimento = 0;
  let semCustoReposicao = 0;
  const prioridade: ResumoEstoque["prioridade"] = [];

  for (const p of produtos) {
    const situacao = situacaoEstoque(p, cfg);
    porNivel[situacao.nivel].push(p);

    const qtd = Math.max(p.quantidadeEstoque ?? 0, 0);
    unidades += qtd;
    valorVenda += qtd * (p.precoVenda ?? 0);
    if (qtd > 0) {
      if (p.precoCusto != null) valorCusto += qtd * p.precoCusto;
      else semCusto++;
    }

    if (emAlerta(situacao.nivel)) {
      prioridade.push({ produto: p, situacao });
      if (situacao.sugestao > 0) {
        if (situacao.custoSugestao != null) investimento += situacao.custoSugestao;
        else semCustoReposicao++;
      }
    }
  }

  prioridade.sort((a, b) => {
    const o = META_NIVEL[a.situacao.nivel].ordem - META_NIVEL[b.situacao.nivel].ordem;
    if (o !== 0) return o;
    const pa = a.situacao.pct ?? -1;
    const pb = b.situacao.pct ?? -1;
    if (pa !== pb) return pa - pb;
    return (a.produto.nome ?? "").localeCompare(b.produto.nome ?? "", "pt-BR", { sensitivity: "base" });
  });

  const total = produtos.length;
  const qtdAlerta = prioridade.length;
  const pctEmAlerta = total > 0 ? (qtdAlerta / total) * 100 : 0;
  const taxaRuptura = total > 0 ? (porNivel.RUPTURA.length / total) * 100 : 0;

  return {
    total,
    porNivel,
    emAlerta: qtdAlerta,
    pctEmAlerta,
    taxaRuptura,
    alertaGeral: total > 0 && pctEmAlerta >= cfg.alertaCatalogoPct,
    unidades,
    valorCusto,
    valorVenda,
    semCusto,
    investimento,
    semCustoReposicao,
    prioridade,
  };
}
