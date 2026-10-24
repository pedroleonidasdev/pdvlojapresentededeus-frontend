"use client";

/**
 * Peças visuais compartilhadas pelas telas do painel (Estoque, Categorias, Usuários, ...).
 * Mantêm todas as abas com o mesmo visual: cartões de indicador, chips de filtro,
 * botões, tabela, estado vazio e janela (modal).
 */

import { Loader2, X } from "lucide-react";

/* ---------------- classes prontas ---------------- */

/** Botão principal (ação mais importante da tela). */
export const BOTAO_PRIMARIO =
  "inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-primary/30 ring-1 ring-white/10 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100";

/** Botão secundário (ferramentas, ações auxiliares). */
export const BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center gap-2 bg-surface border border-border hover:bg-primary-soft text-foreground text-sm font-medium px-3.5 py-2.5 rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50";

/** Botão de ícone na linha da tabela (editar e afins). */
export const BOTAO_ICONE =
  "p-2 rounded-lg text-muted hover:bg-primary-light hover:text-primary transition focus-visible:outline-2 focus-visible:outline-primary";

/** Botão de ícone que apaga/remove. */
export const BOTAO_ICONE_PERIGO =
  "p-2 rounded-lg text-muted hover:bg-danger-light hover:text-danger transition focus-visible:outline-2 focus-visible:outline-danger";

/** Cartão/tabela com a sombra suave padrão. */
export const CARTAO =
  "bg-surface border border-border/70 rounded-2xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(15,51,42,0.35)]";

/** Cabeçalho (thead) das tabelas. */
export const THEAD = "bg-primary-soft border-b border-border/70";
export const TH = "px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-muted";

/** Linha da tabela (hover suave). */
export const TR = "border-b border-border/50 last:border-0 transition-colors hover:bg-primary-soft/50";

/* ---------------- componentes ---------------- */

/** Cartão de indicador do topo da tela (mesmo estilo dos cartões da tela Início). */
export function CartaoIndicador({
  icone,
  titulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  icone: React.ReactNode;
  titulo: string;
  valor: string;
  detalhe: string;
  tom?: "neutro" | "info" | "alerta" | "perigo";
}) {
  const estilo = {
    neutro: { barra: "from-primary to-primary/30", icone: "from-primary to-primary-dark", brilho: "shadow-primary/40" },
    info: { barra: "from-info to-info/30", icone: "from-info to-info-dark", brilho: "shadow-info/40" },
    alerta: { barra: "from-accent to-accent/30", icone: "from-accent to-accent-dark", brilho: "shadow-accent/40" },
    perigo: { barra: "from-danger to-danger/30", icone: "from-danger to-danger", brilho: "shadow-danger/40" },
  }[tom];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface/95 border border-white/70 ring-1 ring-border/40 shadow-[0_10px_30px_-14px_rgba(15,51,42,0.45)] p-4 pt-5 flex items-center gap-3.5 min-w-0">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${estilo.barra}`} />
      <span
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${estilo.icone} text-white flex items-center justify-center shrink-0 shadow-lg ${estilo.brilho} ring-1 ring-white/30`}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{titulo}</p>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground leading-tight truncate">{valor}</p>
        <p className="text-xs text-muted truncate">{detalhe}</p>
      </div>
    </div>
  );
}

/** Botão-chip de filtro rápido, com a contagem do grupo. */
export function ChipFiltro({
  ativo,
  onClick,
  contagem,
  tom = "neutro",
  icone,
  dica,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  contagem?: number;
  tom?: "neutro" | "perigo" | "alerta";
  icone?: React.ReactNode;
  dica?: string;
  children: React.ReactNode;
}) {
  const cores = {
    neutro: {
      ativo: "bg-primary text-white border-primary shadow-md shadow-primary/25",
      inativo: "bg-surface text-foreground border-border hover:bg-primary-soft",
      numero: "bg-primary-light text-primary-dark",
    },
    perigo: {
      ativo: "bg-danger text-white border-danger shadow-md shadow-danger/25",
      inativo: "bg-danger-light text-danger border-danger/30 hover:bg-danger/10",
      numero: "bg-danger/15 text-danger",
    },
    alerta: {
      ativo: "bg-accent text-white border-accent shadow-md shadow-accent/25",
      inativo: "bg-accent-light text-accent-dark border-accent/40 hover:bg-accent/15",
      numero: "bg-accent/20 text-accent-dark",
    },
  }[tom];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={dica}
      className={`inline-flex items-center gap-1.5 rounded-full border py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        contagem === undefined ? "px-3.5" : "pl-3 pr-1.5"
      } ${ativo ? cores.ativo : cores.inativo}`}
    >
      {icone}
      {children}
      {contagem !== undefined && (
        <span
          className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums ${
            ativo ? "bg-white/25 text-white" : cores.numero
          }`}
        >
          {contagem}
        </span>
      )}
    </button>
  );
}

/** Pílula de status (Ativo, Inativo, Aberto...). */
export function Selo({
  tom = "neutro",
  children,
}: {
  tom?: "neutro" | "sucesso" | "perigo" | "alerta" | "info";
  children: React.ReactNode;
}) {
  const cores = {
    neutro: "bg-background text-muted ring-border",
    sucesso: "bg-success-light text-success ring-success/20",
    perigo: "bg-danger-light text-danger ring-danger/20",
    alerta: "bg-accent-light text-accent-dark ring-accent/30",
    info: "bg-info-light text-info ring-info/20",
  }[tom];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cores}`}>
      {children}
    </span>
  );
}

/** Quadradinho com a inicial do nome (lista de usuários, categorias, produtos...). */
export function Inicial({ nome, tom = "neutro" }: { nome: string; tom?: "neutro" | "info" | "alerta" | "perigo" }) {
  const cores = {
    neutro: "bg-primary-light text-primary ring-primary/15",
    info: "bg-info-light text-info ring-info/20",
    alerta: "bg-accent-light text-accent-dark ring-accent/30",
    perigo: "bg-danger-light text-danger ring-danger/20",
  }[tom];
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset ${cores}`}
    >
      {(nome ?? "?").trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Estado vazio: ícone grande, mensagem e (opcional) uma ação. */
export function EstadoVazio({
  icone,
  mensagem,
  acao,
}: {
  icone: React.ReactNode;
  mensagem: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">{icone}</span>
      <p className="text-sm text-muted">{mensagem}</p>
      {acao}
    </div>
  );
}

/** Aviso de sucesso/erro no topo da tela. */
export function Aviso({ tipo, children }: { tipo: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={`rounded-xl border text-sm font-medium px-4 py-3 ${
        tipo === "ok"
          ? "border-success/25 bg-success-light text-success"
          : "border-danger/25 bg-danger-light text-danger"
      }`}
    >
      {children}
    </div>
  );
}

/** Janela (modal) padrão: fundo desfocado, cabeçalho com ícone e rodapé de ações. */
export function ModalBase({
  titulo,
  icone,
  onClose,
  larg = "max-w-sm",
  children,
  rodape,
}: {
  titulo: string;
  icone?: React.ReactNode;
  onClose: () => void;
  larg?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative bg-surface rounded-2xl w-full ${larg} overflow-hidden shadow-2xl ring-1 ring-white/40`}
      >
        <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <div className="px-6 pt-5 pb-4 border-b border-border/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icone && (
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/30">
                {icone}
              </span>
            )}
            <h3 className="font-semibold text-lg tracking-tight truncate">{titulo}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        {rodape && <div className="px-6 py-4 border-t border-border/60 bg-primary-soft/40 flex justify-end gap-2">{rodape}</div>}
      </div>
    </div>
  );
}

/** Botão "Salvar" do rodapé de modal, com ícone de carregando. */
export function BotaoSalvar({
  salvando,
  disabled,
  onClick,
  title,
  children = "Salvar",
}: {
  salvando: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={salvando || disabled} title={title} className={BOTAO_PRIMARIO}>
      {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/** Botão "Cancelar" do rodapé de modal. */
export function BotaoCancelar({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:bg-background transition">
      Cancelar
    </button>
  );
}
