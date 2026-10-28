"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ServerCog } from "lucide-react";
import api from "@/lib/api";
import { BarraCarregamento } from "@/components/CarregamentoCatolico";
import { haTrabalhoEmAndamento } from "@/lib/trabalho-em-andamento";

const INTERVALO_NORMAL_MS = 10_000;
// com o servidor fora do ar, confere com mais frequência para avisar assim que ele volta
const INTERVALO_FORA_MS = 4_000;
const TIMEOUT_MS = 8_000;
// quantas falhas seguidas até avisar (evita alarme por uma oscilação de rede de 1 segundo)
const FALHAS_PARA_AVISAR = 2;
const SEGUNDOS_CONFIRMACAO = 8;

interface InfoServidor {
  versao: string;
  iniciadoEm: string;
}

type Fase = "ok" | "fora" | "voltou";

function versaoCurta(versao?: string | null): string | null {
  return versao && /^[0-9a-f]{40}$/i.test(versao) ? versao.slice(0, 7) : null;
}

/** Texto da etapa conforme há quanto tempo o servidor está fora do ar. */
function etapaDoReinicio(segundos: number): string {
  if (segundos < 15) return "Reiniciando o servidor…";
  if (segundos < 60) return "Subindo a nova versão…";
  return "Ainda iniciando — isso pode levar até 2 minutos…";
}

/**
 * Avisa quando o SERVIDOR (backend) está atualizando ou reiniciando, com barra de progresso:
 *
 * - Consulta /api/versao a cada 10 s. Se o servidor para de responder (reinício, deploy ou
 *   "acordando" depois de hibernar), mostra "Atualizando o servidor…" com uma barra que avança
 *   enquanto espera e passa a conferir a cada 4 s.
 * - Quando ele volta, a barra completa e aparece "Servidor atualizado!" (ou "de volta ao ar",
 *   se a versão não mudou). Se o servidor reiniciou entre duas conferências, o aviso de
 *   atualizado aparece do mesmo jeito.
 * - Sem internet no próprio aparelho, não avisa (o problema não é o servidor).
 * - Se existir venda em andamento, o aviso pede para esperar antes de finalizar.
 */
export default function AtualizacaoServidor() {
  const [fase, setFase] = useState<Fase>("ok");
  const [progresso, setProgresso] = useState(0);
  const [segundosFora, setSegundosFora] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ mudouVersao: boolean; versao: string | null } | null>(null);

  const baseRef = useRef<InfoServidor | null>(null);
  const falhasRef = useRef(0);
  const caiuEmRef = useRef<number | null>(null);
  const foraRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checarRef = useRef<() => Promise<void>>(async () => {});

  const agendar = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void checarRef.current(), ms);
  }, []);

  const checar = useCallback(async () => {
    // aba escondida ou aparelho sem internet: não é problema do servidor — confere de novo depois
    if (document.hidden || navigator.onLine === false) {
      agendar(INTERVALO_NORMAL_MS);
      return;
    }

    let info: InfoServidor | null = null;
    let status = 0;
    try {
      const resp = await api.get<InfoServidor>("/versao", { timeout: TIMEOUT_MS, validateStatus: () => true });
      status = resp.status;
      if (status === 200 && resp.data && typeof resp.data.iniciadoEm === "string") info = resp.data;
    } catch {
      // sem resposta (servidor fora do ar ou demorando): conta como falha
    }

    if (info) {
      const base = baseRef.current;
      const reiniciou = !!base && base.iniciadoEm !== info.iniciadoEm;
      // com a versão (commit) conhecida, "atualizado" = commit diferente; sem ela, qualquer reinício conta
      const mudouVersao = !!base && (info.versao ? base.versao !== info.versao : reiniciou);
      baseRef.current = info;
      falhasRef.current = 0;

      if (foraRef.current || reiniciou) {
        foraRef.current = false;
        caiuEmRef.current = null;
        setResultado({ mudouVersao, versao: versaoCurta(info.versao) });
        setProgresso(100);
        setFase("voltou");
      }
      agendar(INTERVALO_NORMAL_MS);
      return;
    }

    // 401/403/404: este servidor ainda não tem a rota /api/versao (versão antiga) — ignora em silêncio
    if (status >= 400 && status < 500) {
      agendar(INTERVALO_NORMAL_MS * 3);
      return;
    }

    // sem resposta, timeout ou erro 5xx (502/503/504 aparecem durante o deploy)
    falhasRef.current += 1;
    if (falhasRef.current >= FALHAS_PARA_AVISAR && !foraRef.current) {
      foraRef.current = true;
      caiuEmRef.current = Date.now();
      setProgresso(2);
      setSegundosFora(0);
      setFase("fora");
    }
    agendar(INTERVALO_FORA_MS);
  }, [agendar]);

  useEffect(() => {
    checarRef.current = checar;
  }, [checar]);

  // primeira conferência + quando a aba volta a ficar visível ou a internet volta
  useEffect(() => {
    agendar(0);
    const agora = () => {
      if (document.visibilityState === "visible") agendar(0);
    };
    document.addEventListener("visibilitychange", agora);
    window.addEventListener("online", agora);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", agora);
      window.removeEventListener("online", agora);
    };
  }, [agendar]);

  // enquanto o servidor está fora: a barra avança aos poucos (nunca chega a 100% sozinha)
  useEffect(() => {
    if (fase !== "fora") return;
    const intervalo = setInterval(() => {
      const caiuEm = caiuEmRef.current;
      if (caiuEm === null) return;
      const segundos = (Date.now() - caiuEm) / 1000;
      setSegundosFora(Math.floor(segundos));
      setProgresso(Math.max(2, 94 * (1 - Math.exp(-segundos / 40))));
      setOcupado(haTrabalhoEmAndamento());
    }, 500);
    return () => clearInterval(intervalo);
  }, [fase]);

  if (fase === "ok") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center p-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <div className="aviso-chat pointer-events-auto relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-[0_24px_60px_-18px_rgba(15,51,42,0.6)] ring-1 ring-black/5">
        <div aria-hidden className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

        {fase === "fora" ? (
          <div className="px-5 py-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30">
                <ServerCog className="h-6 w-6 animate-pulse" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-dark">
                  Servidor em atualização
                </p>
                <h2 className="mt-0.5 text-base font-semibold leading-tight text-foreground">Atualizando o servidor…</h2>
                <p className="mt-1 text-sm text-muted">{etapaDoReinicio(segundosFora)}</p>
              </div>
              <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-primary">
                {Math.floor(progresso)}%
              </span>
            </div>

            <BarraCarregamento progresso={progresso} className="mt-3.5" />

            <p className="mt-2.5 text-xs text-muted">
              Aguarde alguns instantes — o sistema volta sozinho. Há {segundosFora} s esperando.
            </p>

            {ocupado && (
              <div
                role="alert"
                className="mt-3 flex gap-2.5 rounded-xl border border-accent/30 bg-accent-light px-3.5 py-2.5 text-xs leading-relaxed text-accent-dark"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  <strong>Venda em andamento.</strong> Espere o servidor voltar antes de finalizar a venda, para ela ser
                  registrada.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="relative px-5 py-4">
            <div className="flex items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-success to-success text-white shadow-lg shadow-success/30">
                <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-tight text-foreground">
                  {resultado?.mudouVersao ? "Servidor atualizado!" : "Servidor de volta ao ar"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {resultado?.mudouVersao
                    ? "O servidor já está na versão mais recente. Pode continuar as vendas."
                    : "A conexão foi restabelecida. Pode continuar as vendas."}
                </p>
                {resultado?.versao && (
                  <p className="mt-2 inline-flex rounded-full bg-primary-soft px-3 py-0.5 font-mono text-xs text-primary">
                    v{resultado.versao}
                  </p>
                )}
              </div>
              <button
                onClick={() => setFase("ok")}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-muted transition hover:bg-background hover:text-foreground"
              >
                Fechar
              </button>
            </div>
            <BarraCarregamento progresso={100} className="mt-3.5" />
            {/* fecha sozinho: a barra fina é o cronômetro */}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border/40">
              <span
                className="block h-full origin-left bg-gradient-to-r from-accent to-primary"
                style={{ animation: `aviso-chat-barra ${SEGUNDOS_CONFIRMACAO}s linear forwards` }}
                onAnimationEnd={() => setFase("ok")}
              />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
