"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/** Renderiza um código de barras (EAN-13 por padrão; CODE128 para a pré-visualização da Elgin L42) como SVG. */
export default function BarcodeSvg({
  valor,
  altura = 40,
  largura = 1.6,
  fontSize = 12,
  formato = "EAN13",
  className,
}: {
  valor: string;
  altura?: number;
  largura?: number;
  fontSize?: number;
  formato?: "EAN13" | "CODE128";
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !valor) return;
    try {
      JsBarcode(ref.current, valor, {
        format: formato,
        height: altura,
        width: largura,
        fontSize,
        margin: 0,
        displayValue: true,
      });
    } catch {
      // código de barras inválido para o formato EAN-13 (ex: cadastrado manualmente
      // com outro padrão) — não quebra a tela, só não desenha as barras
    }
  }, [valor, altura, largura, fontSize, formato]);

  return <svg ref={ref} className={className} />;
}
