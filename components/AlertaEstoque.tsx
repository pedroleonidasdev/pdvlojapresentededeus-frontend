"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Produto } from "@/lib/types";
import { formatarMoeda } from "@/lib/format";
import {
  ConfigAlertaEstoque,
  CONFIG_PADRAO,
  FiltroEstoque,
  META_NIVEL,
  NivelEstoque,
  descricaoNivel,
  resumirEstoque,
  sanearConfig,
} from "@/lib/estoque-alerta";

const ORDEM_CARTOES: NivelEstoque[] = ["RUPTURA", "CRITICO", "BAIXO", "ATENCAO", "OK", "SEM_MINIMO"];

interface Props {
  produtos: Produto[];
  config: ConfigAlertaEstoque;
  onSalvarConfig: (c: Partial<ConfigAlertaEstoque>) => void;
  onRestaurarConfig: () => void;
  filtro: FiltroEstoque | null;
  onFiltrar: (f: FiltroEstoque | null) => void;
}

function pct(v: number): string {
  return `${Math.round(v)}%`;
}

/**
 * Painel de alertas da aba Estoque: semáforo por nível (frente ao estoque
 * mínimo), indicadores do estoque e lista de prioridade de reposição.
 */
export default function AlertaEstoque({ produtos, config, onSalvarConfig, onRestaurarConfig, filtro, onFiltrar }: Props) {
  const [aberto, setAberto] = useState(true);
  const [configAberta, setConfigAberta] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  const resumo = useMemo(() => resumirEstoque(produtos, config), [produtos, config]);
  const total = resumo.total;
  const linhas = mostrarTodos ? resumo.prioridade : resumo.prioridade.slice(0, 8);

  // banner principal
  let banner: { tom: "perigo" | "aviso" | "ok"; titulo: string; texto: string } | null = null;
  if (total > 0) {
    if (resumo.alertaGeral) {
      banner = {
        tom: "perigo",
        titulo: `Alerta geral: ${pct(resumo.pctEmAlerta)} dos produtos precisam de reposição`,
        texto: `${resumo.emAlerta} de ${total} produtos estão em ruptura ou abaixo do estoque mínimo (limite configurado: ${config.alertaCatalogoPct}%).`,
      };
    } else if (resumo.porNivel.RUPTURA.length > 0) {
      const n = resumo.porNivel.RUPTURA.length;
      banner = {
        tom: "perigo",
        titulo: `${n} ${n === 1 ? "produto em ruptura" : "produtos em ruptura"}`,
        texto: `Estoque zerado = venda perdida. No total, ${resumo.emAlerta} ${resumo.emAlerta === 1 ? "produto precisa" : "produtos precisam"} de reposição (${pct(resumo.pctEmAlerta)} do catálogo).`,
      };
    } else if (resumo.emAlerta > 0) {
      banner = {
        tom: "aviso",
        titulo: `${resumo.emAlerta} ${resumo.emAlerta === 1 ? "produto abaixo" : "produtos abaixo"} do estoque mínimo`,
        texto: `Equivale a ${pct(resumo.pctEmAlerta)} do catálogo, dentro do limite de ${config.alertaCatalogoPct}%. Vale programar a compra.`,
      };
    } else {
      const sem = resumo.porNivel.SEM_MINIMO.length;
      banner = {
        tom: "ok",
        titulo: "Estoque dentro do esperado",
        texto:
          sem > 0
            ? `Nenhum produto abaixo do mínimo. ${sem} ${sem === 1 ? "produto ainda não tem" : "produtos ainda não têm"} estoque mínimo e não ${sem === 1 ? "é monitorado" : "são monitorados"}.`
            : "Nenhum produto abaixo do estoque mínimo.",
      };
    }
  }

  const estilosBanner = {
    perigo: "bg-danger-light border-danger/40 text-danger",
    aviso: "bg-accent-light border-accent/50 text-accent-dark",
    ok: "bg-success-light border-success/40 text-success",
  } as const;

  const kpis: { rotulo: string; valor: string; nota?: string; cor?: string }[] = [
    { rotulo: "Produtos cadastrados", valor: String(total) },
    { rotulo: "Unidades em estoque", valor: resumo.unidades.toLocaleString("pt-BR") },
    {
      rotulo: "Valor em estoque (custo)",
      valor: formatarMoeda(resumo.valorCusto),
      nota: resumo.semCusto > 0 ? `${resumo.semCusto} sem preço de custo` : undefined,
    },
    { rotulo: "Valor a preço de venda", valor: formatarMoeda(resumo.valorVenda) },
    {
      rotulo: "Taxa de ruptura",
      valor: pct(resumo.taxaRuptura),
      nota: `${resumo.porNivel.RUPTURA.length} de ${total} zerados`,
      cor: resumo.porNivel.RUPTURA.length > 0 ? "text-danger" : undefined,
    },
    {
      rotulo: "Investimento p/ repor",
      valor: formatarMoeda(resumo.investimento),
      nota:
        resumo.semCustoReposicao > 0
          ? `estimado · ${resumo.semCustoReposicao} sem custo`
          : `estimado · até ${config.coberturaAlvo.toLocaleString("pt-BR")}× o mínimo`,
    },
  ];

  return (
    <section className="mb-6 bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-primary-light border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-primary-dark flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertas de estoque
          </h2>
          <p className="text-xs text-primary-dark/80">
            Cada produto é comparado com o estoque mínimo dele. Clique num nível para filtrar a lista.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfigAberta((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 border transition ${
              configAberta ? "bg-primary text-white border-primary" : "bg-white/70 hover:bg-white text-primary-dark border-border"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Parâmetros
          </button>
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-primary-dark bg-white/70 hover:bg-white border border-border rounded-lg px-2.5 py-1.5 transition"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? "" : "-rotate-90"}`} />
            {aberto ? "Recolher" : "Expandir"}
          </button>
        </div>
      </div>

      {configAberta && (
        <ParametrosAlerta
          config={config}
          onSalvar={(c) => {
            onSalvarConfig(c);
            setConfigAberta(false);
          }}
          onRestaurar={() => {
            onRestaurarConfig();
            setConfigAberta(false);
          }}
        />
      )}

      {/* banner: sempre visível, mesmo recolhido */}
      {banner && (
        <div className={`m-4 mb-0 rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3 ${estilosBanner[banner.tom]}`}>
          {banner.tom === "ok" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{banner.titulo}</p>
            <p className="text-xs opacity-90">{banner.texto}</p>
          </div>
          {banner.tom !== "ok" && (
            <button
              type="button"
              onClick={() => onFiltrar(filtro === "ALERTA" ? null : "ALERTA")}
              className="shrink-0 text-xs font-semibold rounded-lg px-3 py-1.5 bg-white/80 hover:bg-white border border-current/30 transition"
            >
              {filtro === "ALERTA" ? "Mostrar todos" : "Ver produtos em alerta"}
            </button>
          )}
        </div>
      )}

      {aberto && total > 0 && (
        <>
          {/* distribuição do catálogo por nível */}
          <div className="px-4 pt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-background border border-border">
              {ORDEM_CARTOES.map((nivel) => {
                const n = resumo.porNivel[nivel].length;
                if (n === 0) return null;
                return (
                  <div
                    key={nivel}
                    className={META_NIVEL[nivel].barra}
                    style={{ width: `${(n / total) * 100}%` }}
                    title={`${META_NIVEL[nivel].rotulo}: ${n} (${pct((n / total) * 100)})`}
                  />
                );
              })}
            </div>
          </div>

          {/* semáforo: cartões que também filtram a tabela */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 p-4">
            {ORDEM_CARTOES.map((nivel) => {
              const meta = META_NIVEL[nivel];
              const n = resumo.porNivel[nivel].length;
              const ativo = filtro === nivel;
              return (
                <button
                  key={nivel}
                  type="button"
                  onClick={() => onFiltrar(ativo ? null : nivel)}
                  className={`text-left rounded-xl border p-3 transition bg-white ${
                    ativo ? "ring-2 ring-primary border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.barra}`} />
                    <span className="text-xs font-semibold text-foreground">{meta.rotulo}</span>
                  </div>
                  <p className={`text-2xl font-semibold font-mono mt-1 ${n > 0 ? meta.texto : "text-muted"}`}>{n}</p>
                  <p className="text-[11px] text-muted">
                    {pct((n / total) * 100)} do catálogo
                  </p>
                  <p className="text-[10px] text-muted/90 mt-0.5 leading-snug">{descricaoNivel(nivel, config)}</p>
                </button>
              );
            })}
          </div>

          {/* indicadores */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 px-4 pb-4">
            {kpis.map((k) => (
              <div key={k.rotulo} className="rounded-lg border border-border bg-background px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k.rotulo}</p>
                <p className={`text-base font-semibold font-mono ${k.cor ?? "text-foreground"}`}>{k.valor}</p>
                {k.nota && <p className="text-[10px] text-muted">{k.nota}</p>}
              </div>
            ))}
          </div>

          {/* prioridade de reposição */}
          {resumo.prioridade.length > 0 && (
            <div className="border-t border-border">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surface-alt">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> Prioridade de reposição
                  <span className="font-normal normal-case text-muted">· do mais crítico para o menos</span>
                </h3>
                <span className="text-[11px] text-muted">
                  Sugestão = repor até {config.coberturaAlvo.toLocaleString("pt-BR")}× o estoque mínimo
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-border">
                      <th className="px-4 py-2 font-semibold">Produto</th>
                      <th className="px-3 py-2 font-semibold text-right">Estoque</th>
                      <th className="px-3 py-2 font-semibold text-right">Mínimo</th>
                      <th className="px-3 py-2 font-semibold w-44">Nível</th>
                      <th className="px-3 py-2 font-semibold text-right">Comprar</th>
                      <th className="px-4 py-2 font-semibold text-right">Custo estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map(({ produto, situacao }) => {
                      const meta = META_NIVEL[situacao.nivel];
                      const preenchido = Math.min(Math.max(situacao.pct ?? 0, 0), 100);
                      return (
                        <tr key={produto.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2">
                            <p className="font-medium text-foreground">{produto.nome}</p>
                            <p className="text-[11px] text-muted">{produto.categoria?.nome ?? "Sem categoria"}</p>
                          </td>
                          <td className={`px-3 py-2 text-right font-mono font-semibold ${meta.texto}`}>{produto.quantidadeEstoque}</td>
                          <td className="px-3 py-2 text-right font-mono text-muted">{produto.estoqueMinimo ?? "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-background border border-border overflow-hidden">
                                <div className={`h-full ${meta.barra}`} style={{ width: `${preenchido}%` }} />
                              </div>
                              <span className="w-9 text-right text-[11px] font-mono text-muted">
                                {situacao.pct != null ? pct(situacao.pct) : "—"}
                              </span>
                            </div>
                            <span className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.selo}`}>
                              {meta.rotulo}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {situacao.sugestao > 0 ? `${situacao.sugestao} un.` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-muted">
                            {situacao.custoSugestao != null ? formatarMoeda(situacao.custoSugestao) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {resumo.prioridade.length > 8 && (
                <div className="px-4 py-2.5 border-t border-border bg-surface-alt/60 text-center">
                  <button
                    type="button"
                    onClick={() => setMostrarTodos((v) => !v)}
                    className="text-xs font-semibold text-primary hover:text-primary-dark"
                  >
                    {mostrarTodos ? "Mostrar só os 8 mais críticos" : `Mostrar todos os ${resumo.prioridade.length} produtos em alerta`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ParametrosAlerta({
  config,
  onSalvar,
  onRestaurar,
}: {
  config: ConfigAlertaEstoque;
  onSalvar: (c: ConfigAlertaEstoque) => void;
  onRestaurar: () => void;
}) {
  const [rascunho, setRascunho] = useState({
    criticoPct: String(config.criticoPct),
    atencaoPct: String(config.atencaoPct),
    alertaCatalogoPct: String(config.alertaCatalogoPct),
    coberturaAlvo: String(config.coberturaAlvo),
  });

  function campo(chave: keyof typeof rascunho, titulo: string, ajuda: string, sufixo: string, passo = "1") {
    return (
      <label className="block">
        <span className="block text-xs font-semibold text-foreground mb-1">{titulo}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step={passo}
            value={rascunho[chave]}
            onChange={(e) => setRascunho((r) => ({ ...r, [chave]: e.target.value }))}
            className="input w-24"
          />
          <span className="text-xs text-muted">{sufixo}</span>
        </div>
        <span className="block text-[11px] text-muted mt-1 leading-snug">{ajuda}</span>
      </label>
    );
  }

  return (
    <div className="px-4 py-4 border-b border-border bg-background">
      <p className="text-xs text-muted mb-3">
        Os percentuais abaixo são regras práticas comuns de gestão de estoque, e cada negócio ajusta os seus. Ficam salvos
        neste navegador.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {campo("criticoPct", "Nível crítico", "Até quantos % do estoque mínimo o produto é crítico (ex.: mínimo 10, crítico com 5 ou menos).", "% do mínimo")}
        {campo("atencaoPct", "Nível de atenção", "Acima do mínimo, mas chegando perto: aparece em amarelo até este % do mínimo.", "% do mínimo")}
        {campo("alertaCatalogoPct", "Alerta geral do catálogo", "Dispara o alerta vermelho quando esta % dos produtos (ou mais) estiver em ruptura ou abaixo do mínimo.", "% dos produtos")}
        {campo("coberturaAlvo", "Meta de reposição", "A sugestão de compra leva o estoque até o mínimo multiplicado por este valor (sistema mínimo/máximo).", "× o mínimo", "0.1")}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            onSalvar(
              sanearConfig({
                criticoPct: Number(rascunho.criticoPct),
                atencaoPct: Number(rascunho.atencaoPct),
                alertaCatalogoPct: Number(rascunho.alertaCatalogoPct),
                coberturaAlvo: Number(rascunho.coberturaAlvo),
              })
            )
          }
          className="bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          Salvar parâmetros
        </button>
        <button
          type="button"
          onClick={onRestaurar}
          className="text-sm text-muted hover:text-foreground px-3 py-2 transition"
        >
          Restaurar padrão ({CONFIG_PADRAO.criticoPct}% · {CONFIG_PADRAO.atencaoPct}% · {CONFIG_PADRAO.alertaCatalogoPct}% · {CONFIG_PADRAO.coberturaAlvo}×)
        </button>
      </div>
    </div>
  );
}
