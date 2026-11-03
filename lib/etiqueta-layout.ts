/**
 * Geometria da etiqueta da Elgin L42 Pro Full (ZPL), em "dots" (203 dpi).
 *
 * ATENÇÃO: espelha scripts/elgin_l42.py do backend (_montar_etiqueta). Se mudar
 * as proporções lá, mude aqui também — é isso que faz a pré-visualização ser
 * fiel ao que a impressora vai desenhar.
 */

export const DPI = 203;
export const DOTS_POR_MM = DPI / 25.4; // ~8 dots/mm

export const MAX_NOME_CHARS = 60; // mesmo corte do backend (MAX_NOME_CHARS)

export function mmParaDots(mm: number): number {
  return Math.max(1, Math.round(mm * DOTS_POR_MM));
}

/** Largura estimada do Code128 em módulos. Só dígitos → subconjunto C (modo A do ^BC). */
export function modulosCode128(codigo: string): number {
  const n = codigo.length;
  const somenteDigitos = /^\d+$/.test(codigo);
  const simbolos = somenteDigitos ? Math.floor(n / 2) + (n % 2 ? 2 : 0) : n;
  return 11 * (1 + simbolos + 1) + 13; // start + dados + check + stop
}

export interface LayoutEtiquetaZpl {
  larguraDots: number;
  alturaDots: number;
  margem: number;
  util: number; // largura útil (sem margens)
  moduloBarras: number; // largura da barra fina, em dots (2 = ~0,25mm)
  barrasLarguraDots: number;
  barrasX: number;
  cabe: boolean; // false = código longo demais, o backend vai recusar
  yNome: number;
  fonteNome: number;
  yPreco: number;
  fontePreco: number;
  yBarras: number;
  alturaBarras: number;
}

export function calcularLayoutZpl(larguraMm: number, alturaMm: number, codigo: string): LayoutEtiquetaZpl {
  const W = mmParaDots(larguraMm);
  const H = mmParaDots(alturaMm);
  const margem = Math.max(6, Math.round(W * 0.02));
  const util = W - 2 * margem;

  const modulos = modulosCode128(codigo);
  const moduloBarras = modulos * 2 <= util ? 2 : 1;
  const barrasLarguraDots = modulos * moduloBarras;

  return {
    larguraDots: W,
    alturaDots: H,
    margem,
    util,
    moduloBarras,
    barrasLarguraDots,
    barrasX: Math.max(margem, Math.floor((W - barrasLarguraDots) / 2)),
    cabe: barrasLarguraDots <= util,
    yNome: Math.round(H * 0.04),
    fonteNome: Math.max(18, Math.round(H * 0.11)),
    yPreco: Math.round(H * 0.34),
    fontePreco: Math.max(24, Math.round(H * 0.17)),
    yBarras: Math.round(H * 0.56),
    alturaBarras: Math.max(24, Math.round(H * 0.22)),
  };
}
