"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  ativarNotificacoes,
  desativarNotificacoes,
  estaInscrito,
  sincronizarInscricao,
  suportaNotificacaoPush,
  motivoSemSuporte,
} from "@/lib/push";

type Estado = "carregando" | "suportado" | "ativado" | "bloqueado" | "sem-suporte";

/**
 * Botão pra ativar/desativar notificação push (venda registrada, caixa
 * aberto/fechado) neste navegador/dispositivo. Só faz sentido pra ADMIN —
 * quem renderiza este componente decide isso (ver Sidebar).
 */
export default function NotificacoesPushButton() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function checar() {
      if (!suportaNotificacaoPush()) {
        setEstado("sem-suporte");
        return;
      }
      if (Notification.permission === "denied") {
        setEstado("bloqueado");
        return;
      }
      const inscrito = await estaInscrito();
      setEstado(inscrito ? "ativado" : "suportado");
      // reconfirma com o backend em segundo plano, sem travar a tela nem
      // mostrar erro — repara sozinho o caso do backend ter perdido o
      // registro desta inscrição (ver comentário em sincronizarInscricao)
      if (inscrito) sincronizarInscricao();
    }
    checar();
  }, []);

  async function alternar() {
    setErro(null);
    setProcessando(true);
    try {
      if (estado === "ativado") {
        await desativarNotificacoes();
        setEstado("suportado");
      } else {
        await ativarNotificacoes();
        setEstado("ativado");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível alterar as notificações.");
      if (Notification.permission === "denied") setEstado("bloqueado");
    } finally {
      setProcessando(false);
    }
  }

  if (estado === "carregando") return null;

  if (estado === "sem-suporte") {
    return (
      <div className="px-2.5 py-2">
        <p className="flex items-center gap-2 text-sm text-white/50">
          <BellOff className="w-4 h-4 shrink-0" />
          Notificações indisponíveis
        </p>
        <p className="mt-1 text-[11px] text-white/40 leading-relaxed">{motivoSemSuporte()}</p>
      </div>
    );
  }

  const Icone = estado === "ativado" ? BellRing : estado === "bloqueado" ? BellOff : Bell;

  return (
    <div>
      <button
        type="button"
        onClick={alternar}
        disabled={processando || estado === "bloqueado"}
        title={
          estado === "bloqueado"
            ? "Notificações bloqueadas nas permissões do navegador"
            : estado === "ativado"
              ? "Clique para desativar as notificações neste dispositivo"
              : "Receber um aviso no celular a cada venda ou abertura/fechamento de caixa"
        }
        className="group w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm transition-all duration-200 border-l-2 border-transparent text-white/70 hover:bg-white/10 hover:text-white hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 text-white/70 transition-all duration-300 ease-out group-hover:bg-white/10 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3">
          <Icone className="w-[19px] h-[19px]" />
        </span>
        {processando
          ? "Aguarde..."
          : estado === "ativado"
            ? "Notificações ativadas"
            : estado === "bloqueado"
              ? "Notificações bloqueadas"
              : "Ativar notificações"}
      </button>
      {erro && <p className="px-2.5 mt-1 text-[11px] text-red-300">{erro}</p>}
    </div>
  );
}
