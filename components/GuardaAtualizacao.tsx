"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { TelaCarregamento } from "@/components/CarregamentoCatolico";
import { PainelAtualizacao } from "@/components/AtualizacaoSistema";
import {
  baixarArquivosEstaticos,
  buscarVersaoServidor,
  gravarServidorVisto,
  lerReinicioTentado,
  lerServidorVisto,
  marcarMostrarAtualizado,
  marcarReinicioTentado,
} from "@/lib/versao-servidor";

const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const EM_PRODUCAO = process.env.NODE_ENV === "production" && !!VERSAO_ATUAL;

const PASSOS = ["Verificando o servidor", "Baixando a atualização", "Aplicando a atualização", "Liberando o sistema"];

type Estado = "verificando" | "atualizando" | "liberado";

// o porteiro roda uma vez por carregamento da página: se o painel remontar (ex.: troca de rota), não confere de novo
let liberadoNestaPagina = false;

function esperar(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Versão do frontend que está publicada agora (a mesma rota usada pelo aviso de atualização). */
async function versaoDoFrontend(): Promise<string | null> {
  try {
    const controle = new AbortController();
    const t = setTimeout(() => controle.abort(), 4000);
    const resp = await fetch("/api/versao", { cache: "no-store", signal: controle.signal });
    clearTimeout(t);
    if (!resp.ok) return null;
    const { versao } = (await resp.json()) as { versao?: string | null };
    return versao ?? null;
  } catch {
    return null;
  }
}

/**
 * Porteiro do sistema: ao abrir (por exemplo, a pessoa saiu e entrou de novo) confere se há
 * atualização pendente ANTES de liberar a operação.
 *
 * - Se o sistema publicado é mais novo que o que está nesta página, ou se o servidor foi atualizado
 *   desde a última vez que este navegador o viu, aparece a tela "Atualizando o sistema…" com a barra
 *   de progresso; só depois o sistema é liberado (e aparece "Sistema atualizado!").
 * - Se está tudo em dia, libera na hora. Se o servidor não responde (reiniciando), NÃO trava a
 *   pessoa fora: libera e deixa o aviso "Atualizando o servidor…" cuidar do resto.
 * - Depois de liberado, atualizações que saírem com o sistema aberto são avisadas por
 *   AtualizacaoSistema (atualizar agora / mais tarde, com a caixinha "Atualização disponível").
 */
export default function GuardaAtualizacao({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>(EM_PRODUCAO && !liberadoNestaPagina ? "verificando" : "liberado");
  const [progresso, setProgresso] = useState(0);
  const [passo, setPasso] = useState(0);
  const progressoRef = useRef(0);
  const iniciouRef = useRef(false);

  useEffect(() => {
    if (!EM_PRODUCAO || liberadoNestaPagina || iniciouRef.current) return;
    iniciouRef.current = true;

    const animarAte = (alvo: number, ms: number) =>
      new Promise<void>((resolve) => {
        const de = progressoRef.current;
        const t0 = performance.now();
        const quadro = () => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          const v = de + (alvo - de) * (1 - Math.pow(1 - k, 2));
          progressoRef.current = v;
          setProgresso(v);
          if (k < 1) requestAnimationFrame(quadro);
          else resolve();
        };
        quadro();
      });

    async function rodar() {
      try {
        const [publicada, servidor] = await Promise.all([versaoDoFrontend(), buscarVersaoServidor(6000)]);

        const jaTentouReiniciar = !!publicada && lerReinicioTentado() === publicada;
        const frontDesatualizado = !!publicada && publicada !== VERSAO_ATUAL && !jaTentouReiniciar;
        const visto = lerServidorVisto();
        const servidorMudou = !!servidor?.versao && !!visto && visto !== servidor.versao;
        if (servidor?.versao && !visto) gravarServidorVisto(servidor.versao); // primeira visita: só registra

        if (!frontDesatualizado && !servidorMudou) {
          setEstado("liberado");
          return;
        }

        setEstado("atualizando");
        setPasso(0);
        await animarAte(15, 500);
        setPasso(1);
        const inicio = performance.now();
        await baixarArquivosEstaticos((fracao) => {
          const alvo = 15 + 60 * fracao;
          if (alvo > progressoRef.current) {
            progressoRef.current = alvo;
            setProgresso(alvo);
          }
        });
        await animarAte(75, Math.max(300, 1400 - (performance.now() - inicio)));
        setPasso(2);
        try {
          const registro = await navigator.serviceWorker?.getRegistration();
          await registro?.update();
        } catch {
          // sem service worker: tudo bem
        }
        await animarAte(92, 600);
        setPasso(3);
        await animarAte(100, 500);
        await esperar(500);

        if (servidor?.versao) gravarServidorVisto(servidor.versao);
        marcarMostrarAtualizado();
        if (frontDesatualizado && publicada) {
          marcarReinicioTentado(publicada);
          window.location.reload();
          return;
        }
        setEstado("liberado");
      } catch {
        // qualquer imprevisto: nunca deixa a pessoa trancada fora do sistema
        setEstado("liberado");
      }
    }

    void rodar();
  }, []);

  if (estado === "liberado") {
    liberadoNestaPagina = true;
    return <>{children}</>;
  }

  if (estado === "verificando") return <TelaCarregamento mensagem="Verificando atualizações…" />;

  return (
    <PainelAtualizacao
      fase="atualizando"
      versaoAtual={null}
      versaoNova={null}
      progresso={progresso}
      passo={passo}
      segundos={null}
      ocupado={false}
      passos={PASSOS}
      titulo="Atualizando antes de liberar o sistema…"
      rotulo="Atualização obrigatória"
      aviso="Estamos aplicando a versão mais recente. O sistema libera sozinho assim que terminar."
      onAtualizar={() => {}}
      onAdiar={() => {}}
      onFechar={() => {}}
    />
  );
}
