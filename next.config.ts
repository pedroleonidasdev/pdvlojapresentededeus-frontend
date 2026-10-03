import type { NextConfig } from "next";

// Identificador da versão publicada. Na Vercel é o hash do commit (muda a cada
// deploy); fora dela cai no horário do build. O mesmo valor fica embutido no
// JavaScript do navegador e na rota /api/versao — quando os dois divergem, é
// sinal de que saiu uma versão nova (ver components/AtualizacaoSistema.tsx).
const VERSAO_APP = process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now());

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: VERSAO_APP,
  },

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
        source: "/((?!_next/|api/|images/|.*\\..*).*)",
        headers: [
          { key: "Content-Type", value: "text/html; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
