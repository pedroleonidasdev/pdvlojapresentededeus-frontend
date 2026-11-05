"use client";

import { useMemo } from "react";
import BarcodeSvg from "@/components/BarcodeSvg";
import { formatarMoeda } from "@/lib/format";
import { MAX_NOME_CHARS, calcularLayoutZpl } from "@/lib/etiqueta-layout";
import { AlertTriangle } from "lucide-react";

// largura, em pixels, em que a etiqueta é desenhada na tela
const LARGURA_TELA_PX = 300;

/**
 * Pré-visualização fiel da etiqueta da Elgin L42 Pro Full: usa a MESMA geometria
 * que o backend manda para a impressora (lib/etiqueta-layout.ts ↔ elgin_l42.py),
 * proporcional ao tamanho real largura × altura em mm.
 */
export default function PreviewEtiquetaZpl({
  nome,
  preco,
  codigo,
  larguraMm,
  alturaMm,
}: {
  nome: string;
  preco: number;
  codigo: string;
  larguraMm: number;
  alturaMm: number;
}) {
  const layout = useMemo(() => calcularLayoutZpl(larguraMm, alturaMm, codigo, nome), [larguraMm, alturaMm, codigo, nome]);

  const escala = LARGURA_TELA_PX / layout.larguraDots; // px por dot
  const px = (dots: number) => dots * escala;

  // a fonte escalável da impressora ocupa ~80% da "altura" informada em ZPL
  const tamanhoFonte = (dots: number) => Math.max(6, dots * escala * 0.8);

  return (
    <div className="flex flex-col items-center gap-2">
      {/* "liner" da bobina: a etiqueta branca sobre o fundo da cartela */}
      <div className="rounded-xl bg-surface-alt border border-border px-4 py-4">
        <div
          className="relative bg-white text-black overflow-hidden rounded-[6px] shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
          style={{ width: px(layout.larguraDots), height: px(layout.alturaDots) }}
        >
          {/* nome — até 2 linhas, centralizado (^FB) */}
          <div
            className="absolute text-center font-sans break-words overflow-hidden"
            style={{
              left: px(layout.margem),
              top: px(layout.yNome),
              width: px(layout.util),
              height: px(layout.fonteNome * 2),
              fontSize: tamanhoFonte(layout.fonteNome),
              lineHeight: `${px(layout.fonteNome)}px`,
            }}
          >
            {nome.slice(0, MAX_NOME_CHARS)}
          </div>

          {/* preço */}
          <div
            className="absolute text-center font-sans font-semibold whitespace-nowrap"
            style={{
              left: px(layout.margem),
              top: px(layout.yPreco),
              width: px(layout.util),
              fontSize: tamanhoFonte(layout.fontePreco),
              lineHeight: `${px(layout.fontePreco)}px`,
            }}
          >
            {formatarMoeda(preco)}
          </div>

          {/* código de barras Code128 + linha de interpretação */}
          <div
            className="absolute"
            style={{ left: px(layout.barrasX), top: px(layout.yBarras), width: px(layout.barrasLarguraDots) }}
          >
            <BarcodeSvg
              valor={codigo}
              formato="CODE128"
              altura={px(layout.alturaBarras)}
              largura={px(layout.moduloBarras)}
              fontSize={Math.max(7, 18 * escala)}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted">
        {larguraMm.toLocaleString("pt-BR")} × {alturaMm.toLocaleString("pt-BR")} mm · tamanho real em proporção
      </p>

      {!layout.cabe && (
        <div className="flex items-start gap-1.5 rounded-lg bg-danger-light text-danger text-xs px-3 py-2 max-w-[320px]">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          <span>
            Este código de barras é longo demais para {larguraMm.toLocaleString("pt-BR")} mm de largura e a
            impressão será recusada. Aumente a largura ou use um código mais curto.
          </span>
        </div>
      )}
    </div>
  );
}
