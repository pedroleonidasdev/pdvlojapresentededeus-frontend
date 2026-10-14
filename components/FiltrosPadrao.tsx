"use client";

import { CalendarDays, Filter } from "lucide-react";

/**
 * Peças de filtro com o mesmo visual da tela de Faturamento. Usar estas peças
 * em qualquer tela com filtro mantém o sistema inteiro igual:
 *
 * - <PainelFiltros>        cartão de consulta (período, busca, botão "Filtrar").
 * - <PainelFiltrosLocais>  cartão com o ícone "Filtros" para refinar o que já
 *                          está carregado (chips, vendedor, categoria...).
 * - <CampoFiltro>          rótulo pequeno + campo (input/select).
 * - <ChipFiltro>           botão de liga/desliga dos filtros (retangular).
 * - <AtalhosPeriodo>       linha "Período rápido" (Hoje, 7 dias, Este mês...).
 */

const CLASSE_CARTAO = "bg-surface border border-border rounded-xl p-4";

export function PainelFiltros({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-end gap-3 ${CLASSE_CARTAO} ${className}`}>{children}</div>;
}

export function PainelFiltrosLocais({
  children,
  titulo = "Filtros",
  className = "",
}: {
  children: React.ReactNode;
  titulo?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${CLASSE_CARTAO} ${className}`}>
      <div className="flex items-center gap-2 text-xs text-muted">
        <Filter className="w-3.5 h-3.5" />
        {titulo}
      </div>
      {children}
    </div>
  );
}

export function CampoFiltro({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function ChipFiltro({
  ativo,
  onClick,
  children,
  disabled,
  title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={ativo}
      className={`text-xs px-3 py-1.5 rounded-lg border transition disabled:opacity-60 ${
        ativo
          ? "border-primary bg-primary-light text-primary-dark font-medium"
          : "border-border text-muted hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

export interface AtalhoPeriodo {
  rotulo: string;
  inicio: string;
  fim: string;
}

export function AtalhosPeriodo({
  atalhos,
  inicio,
  fim,
  onSelecionar,
  desabilitado,
}: {
  atalhos: AtalhoPeriodo[];
  /** Período atualmente escolhido — o atalho correspondente fica destacado. */
  inicio: string;
  fim: string;
  onSelecionar: (atalho: AtalhoPeriodo) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="basis-full flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted mr-1">
        <CalendarDays className="w-3.5 h-3.5" />
        Período rápido
      </span>
      {atalhos.map((a) => {
        const ativo = a.inicio === inicio && a.fim === fim;
        return (
          <button
            key={a.rotulo}
            type="button"
            disabled={desabilitado}
            onClick={() => onSelecionar(a)}
            className={`text-xs px-3 py-1.5 rounded-full border transition disabled:opacity-60 ${
              ativo
                ? "border-info bg-info text-white font-medium"
                : "border-border text-foreground hover:border-info hover:bg-info-light"
            }`}
          >
            {a.rotulo}
          </button>
        );
      })}
    </div>
  );
}
