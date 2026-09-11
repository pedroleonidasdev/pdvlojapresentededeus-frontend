import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Garante que todo HTML servido declare charset=utf-8 no header
  // Content-Type. Se o host/proxy de produção (nginx, CDN, etc.) não
  // enviar essa informação, o navegador pode tentar adivinhar a
  // codificação e exibir os acentos errados (ex.: "código" -> "cÃ³digo"),
  // mesmo com o código-fonte já em UTF-8 correto.
  async headers() {
    return [
      {
        // Só rotas de página (sem extensão de arquivo), pra não sobrescrever
        // o Content-Type de imagens, ícones, manifest.json, sw.js etc.
        // servidos em /public e pela pasta /_next.
        source: "/((?!_next/|images/|.*\\..*).*)",
        headers: [
          { key: "Content-Type", value: "text/html; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
