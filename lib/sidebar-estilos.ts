// Estilos compartilhados pelos botões do menu lateral (Sidebar e NotificacoesPushButton),
// para todos terem o mesmo visual "tech": vidro, brilho dourado e ícone em azulejo.

export const LINHA_BASE =
  "group relative w-full flex items-center gap-3 pl-2.5 pr-2.5 py-1.5 rounded-xl text-[13.5px] leading-tight text-left transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

export const LINHA_INATIVA =
  "text-white/75 hover:bg-white/[0.08] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]";

export const LINHA_ATIVA =
  "bg-gradient-to-r from-accent/25 via-white/10 to-transparent text-white font-semibold ring-1 ring-white/15 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]";

export const ICONE_BASE =
  "relative flex items-center justify-center w-9 h-9 rounded-xl shrink-0 transition-all duration-300 ease-out";

export const ICONE_INATIVO =
  "bg-gradient-to-br from-white/[0.14] to-white/[0.03] text-white/85 ring-1 ring-white/10 group-hover:from-accent/35 group-hover:to-accent/5 group-hover:text-accent-light group-hover:ring-accent/40 group-hover:scale-105 group-hover:shadow-[0_0_14px_-2px_rgba(224,151,47,0.55)]";

export const ICONE_ATIVO =
  "bg-gradient-to-br from-accent to-accent-dark text-primary-dark ring-1 ring-white/40 shadow-[0_0_16px_-2px_rgba(224,151,47,0.75)]";

// Variação vermelha, usada no botão "Sair"
export const LINHA_PERIGO =
  "text-white/75 hover:bg-red-500/15 hover:text-red-100 hover:shadow-[inset_0_0_0_1px_rgba(252,165,165,0.18)]";
export const ICONE_PERIGO =
  "bg-gradient-to-br from-white/[0.14] to-white/[0.03] text-white/85 ring-1 ring-white/10 group-hover:from-red-500/45 group-hover:to-red-500/10 group-hover:text-red-100 group-hover:ring-red-300/40 group-hover:scale-105 group-hover:shadow-[0_0_14px_-2px_rgba(248,113,113,0.55)]";

// Reflexo de vidro no topo do azulejo do ícone
export const BRILHO_ICONE = "pointer-events-none absolute inset-x-1.5 top-1 h-1/3 rounded-full bg-white/25 blur-[2px]";
