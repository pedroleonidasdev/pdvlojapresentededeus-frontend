"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Vault, X } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EVENTO_CAIXA_MUDOU } from "@/lib/caixa-eventos";
import { formatarMoeda } from "@/lib/format";
import { sincronizarInscricao } from "@/lib/push";
import { Caixa } from "@/lib/types";

const INTERVALO_MS = 15_000;
const DURACAO_AVISO_MS = 8_000;
// Se o aparelho ficou sem consultar por mais tempo que isso (app fechado,
// celular dormindo), a diferença encontrada ao voltar é história antiga —
// só sincroniza o estado, sem anunciar como se tivesse acabado de acontecer.
const VALIDADE_ESTADO_MS = 30 * 60_000;
// Fica no localStorage SEM ligação com o usuário logado: trocar de usuário,
// sair e entrar de novo ou ter várias abas abertas não repete nem perde aviso.
const CHAVE_ESTADO = "pdv_caixa_estado";

type TipoEvento = "aberto" | "fechado";
interface Aviso {
  id: number;
  tipo: TipoEvento;
  titulo: string;
  corpo: string;
}
interface EstadoSalvo {
  chave: string; // "fechado" ou "aberto:<id do caixa>"
  em: number;
}

function lerEstado(): EstadoSalvo | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ESTADO);
    return bruto ? (JSON.parse(bruto) as EstadoSalvo) : null;
  } catch {
    return null;
  }
}

function salvarEstado(chave: string): void {
  try {
    localStorage.setItem(CHAVE_ESTADO, JSON.stringify({ chave, em: Date.now() }));
  } catch {
    // sem localStorage: só perde a deduplicação entre abas
  }
}

// Notificação do sistema operacional (aparece mesmo com a aba em segundo
// plano). A "tag" é a mesma que o service worker aplica nos pushes do
// backend — se os dois chegarem, um substitui o outro em vez de duplicar.
async function notificarSistema(titulo: string, corpo: string, tag: string): Promise<void> {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification(titulo, {
      body: corpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      renotify: true,
      data: { url: "/inicio" },
    } as NotificationOptions & { renotify?: boolean });
  } catch {
    // best-effort: o aviso dentro da tela continua funcionando
  }
}

/**
 * Observa o caixa e avisa quem tem perfil ADMIN quando ele for aberto,
 * fechado ou reaberto — não importa quem fez a ação (ADMIN ou CAIXA). Só é
 * montado para ADMIN (ver layout do dashboard).
 *
 * - Cada aparelho consulta GET /caixa/atual por conta própria, então vários
 *   ADMINs logados ao mesmo tempo recebem o aviso, cada um no seu.
 * - Mostra um aviso na tela e, se as notificações estiverem ativadas no
 *   aparelho, também uma notificação do sistema.
 * - Toda vez que um ADMIN entra (login ou "Trocar usuário"), reenvia a
 *   inscrição push ao backend com o token dele. Não roda para CAIXA: assim um
 *   CAIXA logado no mesmo aparelho não "rouba" a inscrição do ADMIN.
 */
export default function MonitorCaixa() {
  const { usuario } = useAuth();
  const login = usuario?.login;
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const verificando = useRef(false);
  const proximoId = useRef(1);

  const anunciar = useCallback((tipo: TipoEvento, caixa?: Caixa) => {
    const reaberto = tipo === "aberto" && !!caixa?.dataReabertura && !!caixa.usuarioReaberturaNome;
    const titulo = tipo === "aberto" ? (reaberto ? "Caixa reaberto" : "Caixa aberto") : "Caixa fechado";
    const corpo =
      tipo === "fechado"
        ? "O caixa foi fechado."
        : reaberto
          ? `${caixa!.usuarioReaberturaNome} reabriu o caixa.`
          : caixa
            ? `${caixa.usuarioAberturaNome} abriu o caixa com ${formatarMoeda(caixa.valorInicial)}.`
            : "O caixa foi aberto.";

    const id = proximoId.current++;
    setAvisos((atuais) => [...atuais, { id, tipo, titulo, corpo }]);
    setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== id)), DURACAO_AVISO_MS);

    void notificarSistema(titulo, corpo, tipo === "aberto" ? "caixa-aberto" : "caixa-fechado");
  }, []);

  const verificar = useCallback(async () => {
    if (verificando.current) return;
    verificando.current = true;
    try {
      let caixa: Caixa | null;
      try {
        const { data, status } = await api.get<Caixa>("/caixa/atual");
        caixa = status === 204 || !data || !("id" in data) ? null : data;
      } catch {
        return; // sem rede / servidor fora: não conclui nada, tenta no próximo ciclo
      }

      const chaveNova = caixa ? `aberto:${caixa.id}` : "fechado";
      const anterior = lerEstado();
      salvarEstado(chaveNova);

      if (!anterior || anterior.chave === chaveNova) return;
      if (Date.now() - anterior.em > VALIDADE_ESTADO_MS) return;

      // se estava aberto e agora é outro estado, um caixa foi fechado
      if (anterior.chave.startsWith("aberto:")) anunciar("fechado");
      // se agora há um caixa aberto diferente do que havia, um caixa foi aberto
      if (caixa) anunciar("aberto", caixa);
    } finally {
      verificando.current = false;
    }
  }, [anunciar]);

  // Reconfirma a inscrição push com o token do usuário atual (entrada e troca de usuário)
  useEffect(() => {
    void sincronizarInscricao();
  }, [login]);

  useEffect(() => {
    void verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void verificar();
    };
    const aoMudarAqui = () => void verificar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_CAIXA_MUDOU, aoMudarAqui);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_CAIXA_MUDOU, aoMudarAqui);
    };
  }, [verificar, login]);

  if (avisos.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
      style={{ top: "max(1rem, env(safe-area-inset-top))" }}
      role="status"
      aria-live="polite"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            aviso.tipo === "aberto"
              ? "bg-success-light border-success/30 text-success"
              : "bg-danger-light border-danger/30 text-danger"
          }`}
        >
          {aviso.tipo === "aberto" ? (
            <BellRing className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Vault className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">{aviso.titulo}</p>
            <p className="mt-0.5 text-xs leading-snug opacity-90">{aviso.corpo}</p>
          </div>
          <button
            type="button"
            onClick={() => setAvisos((atuais) => atuais.filter((a) => a.id !== aviso.id))}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
