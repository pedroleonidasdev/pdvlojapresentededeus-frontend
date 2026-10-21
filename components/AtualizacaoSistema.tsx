"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { BarraCarregamento, CruzIcone, OracaoRotativa } from "@/components/CarregamentoCatolico";

// Versão embutida neste JavaScript (definida em next.config.ts).
const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const CHAVE_VERSAO_VISTA = "pdv_versao_vista";
const INTERVALO_CHECAGEM_MS = 5 * 60_000;
// depois de "Mais tarde" o aviso só volta a aparecer depois deste tempo
const ADIAR_AVISO_MS = 30 * 60_000;
// tempo da barra de carregamento entre o clique e o recarregamento da página
const DURACAO_ATUALIZACAO_MS = 5_000;

const ETAPAS = [
  { ate: 35, texto: "Preparando a atualização…" },
  { ate: 75, texto: "Carregando a nova versão…" },
  { ate: 100, texto: "Quase pronto…" },
];

/** true quando este navegador já tinha aberto uma versão diferente da atual. */
function versaoMudouDesdeUltimaVisita(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return false;
  try {
    const vista = localStorage.getItem(CHAVE_VERSAO_VISTA);
    return !!vista && vista !== VERSAO_ATUAL;
  } catch {
    return false;
  }
}

/**
 * Fluxo de atualização do sistema (tela cheia, no meio da tela):
 *
 * 1. Quando existe uma versão nova publicada (conferido ao abrir o painel, ao
 *    voltar para a aba/app e a cada 5 minutos) aparece o aviso com dois
 *    botões: "Atualizar agora" e "Mais tarde" (adia o aviso por 30 minutos). O foco inicial
 *    fica em "Mais tarde" para o Enter do leitor de código de barras não recarregar a página.
 * 2. Ao clicar, uma barra de carregamento (terço) enche em 5 segundos, com
 *    mensagens de etapa, e a página é recarregada (o login é mantido).
 * 3. Ao abrir na versão nova, aparece "Sistema Atualizado Com Sucesso!".
 *    Sempre que o painel abre numa versão diferente da última que este
 *    navegador viu a confirmação é mostrada; na primeira vez que o navegador
 *    abre o sistema só registra a versão, sem mostrar nada.
 */
export default function AtualizacaoSistema() {
  const [novaVersao, setNovaVersao] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(versaoMudouDesdeUltimaVisita);
  const [atualizando, setAtualizando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const intervaloProgresso = useRef<ReturnType<typeof setInterval> | null>(null);
  const atualizandoRef = useRef(false);
  // "Mais tarde": enquanto não chegar esse horário, o aviso não reaparece
  const adiadoAteRef = useRef(0);

  // registra a versão que este navegador está usando agora
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return;
    try {
      localStorage.setItem(CHAVE_VERSAO_VISTA, VERSAO_ATUAL);
    } catch {
      // sem acesso ao localStorage: só não mostra a confirmação
    }
  }, []);

  const verificar = useCallback(async () => {
    // em desenvolvimento a versão muda a todo momento — não avisa
    if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return;
    if (atualizandoRef.current) return;
    if (Date.now() < adiadoAteRef.current) return;
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
    const primeira = setTimeout(verificar, 0);
    const intervalo = setInterval(verificar, INTERVALO_CHECAGEM_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") verificar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [verificar]);

  // limpa o cronômetro da barra se o componente sair da tela
  useEffect(() => {
    return () => {
      if (intervaloProgresso.current) clearInterval(intervaloProgresso.current);
    };
  }, []);

  function adiar() {
    adiadoAteRef.current = Date.now() + ADIAR_AVISO_MS;
    setNovaVersao(null);
  }

  function atualizar() {
    if (atualizandoRef.current) return;
    atualizandoRef.current = true;
    setAtualizando(true);
    setProgresso(0);

    const inicio = Date.now();
    intervaloProgresso.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - inicio) / DURACAO_ATUALIZACAO_MS) * 100);
      setProgresso(p);
      if (p >= 100) {
        if (intervaloProgresso.current) clearInterval(intervaloProgresso.current);
        // deixa a barra cheia à vista por um instante antes de recarregar
        setTimeout(() => window.location.reload(), 500);
      }
    }, 50);
  }

  if (!novaVersao && !sucesso) return null;

  const etapa = ETAPAS.find((e) => progresso <= e.ate) ?? ETAPAS[ETAPAS.length - 1];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-dark/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-atualizacao"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface text-center shadow-2xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-secondary" />

        <div className="p-7 sm:p-9">
          {atualizando ? (
            <div role="status" aria-live="polite">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary animate-icon-glow">
                <RefreshCw className="h-8 w-8 animate-spin [animation-duration:2s]" />
              </div>
              <h2 id="titulo-atualizacao" className="text-xl font-semibold text-foreground">
                Atualizando o sistema…
              </h2>
              <p className="mt-1.5 text-sm text-muted">{etapa.texto}</p>

              <div className="mt-6">
                <BarraCarregamento progresso={progresso} />
                <p className="mt-2 font-mono text-sm font-semibold text-primary">{Math.floor(progresso)}%</p>
              </div>

              <OracaoRotativa className="mt-4" />
              <p className="mt-5 text-xs text-muted">Não feche esta janela. Leva só alguns segundos.</p>
            </div>
          ) : novaVersao ? (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
                <RefreshCw className="h-8 w-8" />
              </div>
              <h2 id="titulo-atualizacao" className="text-xl font-semibold text-foreground">
                Nova atualização disponível
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Uma versão mais nova do sistema foi publicada. Ao atualizar, a página é recarregada e seu login é mantido.
              </p>
              <p className="mt-3 rounded-lg bg-accent-light px-3 py-2 text-left text-xs leading-relaxed text-accent-dark">
                <strong>Atenção:</strong> se estiver no meio de uma venda, termine antes de atualizar. O carrinho em
                andamento não é guardado e se perde ao recarregar.
              </p>
              <p className="mt-3 text-xs text-muted">
                Se escolher “Mais tarde”, este aviso volta a aparecer daqui a 30 minutos.
              </p>
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
                {/* o foco inicial fica em "Mais tarde": o leitor de código de barras dá Enter ao ler um produto
                    e isso NÃO pode recarregar a página no meio de uma venda */}
                <button
                  onClick={adiar}
                  autoFocus
                  className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-foreground"
                >
                  Mais tarde
                </button>
                <button
                  onClick={atualizar}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:brightness-110 active:scale-[0.99]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar agora
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-success animate-icon-glow">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h2 id="titulo-atualizacao" className="text-xl font-semibold text-foreground">
                Sistema Atualizado Com Sucesso!
              </h2>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Você já está usando a versão mais recente do sistema.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-accent-dark">
                <span className="h-px w-10 bg-accent/60" />
                <CruzIcone className="h-4 w-4" />
                <span className="h-px w-10 bg-accent/60" />
              </div>
              <button
                onClick={() => setSucesso(false)}
                autoFocus
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/25 transition hover:brightness-110 active:scale-[0.99]"
              >
                Continuar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
