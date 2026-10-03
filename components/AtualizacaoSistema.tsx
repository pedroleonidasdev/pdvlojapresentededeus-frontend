"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

// Versão embutida neste JavaScript (definida em next.config.ts).
const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const CHAVE_ATUALIZADO = "pdv_versao_atualizada";
const INTERVALO_CHECAGEM_MS = 5 * 60_000;
const ADIAMENTO_MS = 10 * 60_000;

/**
 * Avisa, no meio da tela, quando existe uma versão nova do sistema publicada.
 * - Confere ao abrir o painel (logo após o login), ao voltar para a aba/app e
 *   a cada 5 minutos.
 * - "Reiniciar sistema" recarrega a página (o login é mantido) e, ao voltar,
 *   mostra "Sistema atualizado com sucesso".
 * - "Agora não" adia o aviso por 10 minutos, para não atrapalhar uma venda.
 */
export default function AtualizacaoSistema() {
  const [novaVersao, setNovaVersao] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const adiadoAte = useRef(0);

  // Voltou de um "Reiniciar sistema"? Então confirma que a versão nova subiu.
  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE_ATUALIZADO);
      if (salva) {
        localStorage.removeItem(CHAVE_ATUALIZADO);
        if (salva === VERSAO_ATUAL) setSucesso(true);
      }
    } catch {
      // sem acesso ao localStorage: só não mostra a confirmação
    }
  }, []);

  const verificar = useCallback(async () => {
    // em desenvolvimento a versão muda a todo momento — não avisa
    if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return;
    if (Date.now() < adiadoAte.current) return;
    try {
      const resp = await fetch("/api/versao", { cache: "no-store" });
      if (!resp.ok) return;
      const { versao } = (await resp.json()) as { versao?: string | null };
      if (versao && versao !== VERSAO_ATUAL) setNovaVersao(versao);
    } catch {
      // sem internet agora — tenta de novo na próxima checagem
    }
  }, []);

  useEffect(() => {
    verificar();
    const intervalo = setInterval(verificar, INTERVALO_CHECAGEM_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") verificar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [verificar]);

  function reiniciar() {
    if (!novaVersao) return;
    setReiniciando(true);
    try {
      localStorage.setItem(CHAVE_ATUALIZADO, novaVersao);
    } catch {
      // segue mesmo assim; só não aparece a confirmação depois
    }
    window.location.reload();
  }

  function adiar() {
    adiadoAte.current = Date.now() + ADIAMENTO_MS;
    setNovaVersao(null);
  }

  if (!novaVersao && !sucesso) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 text-center shadow-xl">
        {novaVersao ? (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
              <RefreshCw className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Nova atualização disponível</h2>
            <p className="mt-2 text-sm text-muted">
              Uma versão mais nova do sistema foi publicada. Reinicie para carregar as melhorias.
            </p>
            <button
              onClick={reiniciar}
              disabled={reiniciando}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-70"
            >
              {reiniciando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Reiniciando...
                </>
              ) : (
                "Reiniciar sistema"
              )}
            </button>
            <button
              onClick={adiar}
              disabled={reiniciando}
              className="mt-2 w-full rounded-xl px-4 py-2 text-sm text-muted transition hover:bg-primary-soft"
            >
              Agora não
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-light text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Sistema atualizado com sucesso!</h2>
            <p className="mt-2 text-sm text-muted">Você já está usando a versão mais recente.</p>
            <button
              onClick={() => setSucesso(false)}
              className="mt-5 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
            >
              Continuar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
