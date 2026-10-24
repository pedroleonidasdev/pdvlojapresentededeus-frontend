"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Send } from "lucide-react";
import api from "@/lib/api";
import { BRILHO_ICONE, ICONE_BASE, ICONE_INATIVO, LINHA_BASE, LINHA_INATIVA } from "@/lib/sidebar-estilos";
import {
  ativarNotificacoes,
  desativarNotificacoes,
  estaInscrito,
  sincronizarInscricao,
  suportaNotificacaoPush,
  motivoSemSuporte,
} from "@/lib/push";

type Estado = "carregando" | "suportado" | "ativado" | "bloqueado" | "sem-suporte";

// Resposta de POST /notificacoes/teste: o que aconteceu com cada aparelho de ADMIN inscrito
interface ResultadoTeste {
  configurado: boolean;
  totalInscricoes: number;
  enviadas: number;
  removidas: number;
  falhas: number;
  detalhes: string[];
}

/**
 * Botão pra ativar/desativar notificação push (venda registrada, caixa
 * aberto/fechado) neste navegador/dispositivo. Só faz sentido pra ADMIN —
 * quem renderiza este componente decide isso (ver Sidebar).
 */
export default function NotificacoesPushButton() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [testando, setTestando] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<ResultadoTeste | null>(null);

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

  async function enviarTeste() {
    setErro(null);
    setResultadoTeste(null);
    setTestando(true);
    try {
      const { data } = await api.post<ResultadoTeste>("/notificacoes/teste");
      setResultadoTeste(data);
    } catch {
      setErro("Não foi possível enviar o teste (servidor indisponível?).");
    } finally {
      setTestando(false);
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
              : "Receber um aviso neste aparelho a cada venda ou abertura/fechamento de caixa"
        }
        className={`${LINHA_BASE} ${LINHA_INATIVA} disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span
          className={`${ICONE_BASE} ${
            estado === "ativado"
              ? "bg-gradient-to-br from-success/60 to-success/20 text-success-light ring-1 ring-emerald-300/40 shadow-[0_0_14px_-2px_rgba(52,211,153,0.55)] group-hover:scale-105"
              : ICONE_INATIVO
          }`}
        >
          <span aria-hidden="true" className={BRILHO_ICONE} />
          <Icone className="relative w-[18px] h-[18px]" strokeWidth={1.75} />
        </span>
        {processando
          ? "Aguarde..."
          : estado === "ativado"
            ? "Notificações ativadas"
            : estado === "bloqueado"
              ? "Notificações bloqueadas"
              : "Ativar notificações"}
      </button>
      {estado === "ativado" && (
        <button
          type="button"
          onClick={enviarTeste}
          disabled={testando}
          className="w-full flex items-center gap-2 pl-[58px] pr-2.5 py-1 text-[11px] text-white/50 hover:text-white transition disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
          {testando ? "Enviando teste..." : "Enviar notificação de teste"}
        </button>
      )}
      {resultadoTeste && (
        <div className="pl-[58px] pr-2.5 mt-1 text-[11px] leading-relaxed text-white/60">
          {resultadoTeste.enviadas > 0 && (
            <p className="text-white/80">
              Teste enviado para {resultadoTeste.enviadas} aparelho(s) de ADMIN:
            </p>
          )}
          {resultadoTeste.detalhes.map((detalhe, i) => (
            <p key={i}>• {detalhe}</p>
          ))}
          {(resultadoTeste.removidas > 0 || resultadoTeste.falhas > 0) && (
            <p className="mt-1">
              {resultadoTeste.removidas} expirada(s), {resultadoTeste.falhas} falha(s).
            </p>
          )}
        </div>
      )}
      {erro && <p className="px-2.5 mt-1 text-[11px] text-red-300">{erro}</p>}
    </div>
  );
}
