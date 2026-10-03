import { NextResponse } from "next/server";

// Sempre responde na hora (sem cache) com a versão que está publicada agora.
// O navegador compara com a versão embutida no próprio JavaScript dele.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { versao: process.env.NEXT_PUBLIC_APP_VERSION ?? null },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
