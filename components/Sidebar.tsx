"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ChevronRight, LogOut, MessageCircle, Sparkles, UserCog, X } from "lucide-react";
import { NAV_ITEMS, LayoutGrid } from "@/lib/nav-items";
import TrocarUsuarioModal from "./TrocarUsuarioModal";
import CaixaStatusBadge from "./CaixaStatusBadge";
import NotificacoesPushButton from "./NotificacoesPushButton";
import {
  BRILHO_ICONE,
  ICONE_ATIVO,
  ICONE_INATIVO,
  ICONE_PERIGO,
  LINHA_ATIVA,
  LINHA_INATIVA,
  LINHA_PERIGO,
} from "@/lib/sidebar-estilos";
import { ESTADO_CHAT_SERVIDOR, alternarChat, assinarEstadoChat, lerEstadoChat } from "@/lib/chat-eventos";
import { EVENTO_ABRIR_NOVIDADES, EVENTO_NOVIDADES_VISTAS, temNovidadeNaoVista } from "@/lib/novidades";

// Tamanhos COMPACTOS do menu (definidos aqui para o menu caber na tela sem barra de
// rolagem). As cores/brilhos continuam vindo de @/lib/sidebar-estilos.
//  - linha do menu: ícone de 28px (era ~40px) e pouco espaço vertical
//  - ação do rodapé: ícone em cima, rótulo minúsculo embaixo, quatro lado a lado
const LINHA = "group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1 text-left text-[13px] font-medium transition";
const ICONE = "relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg transition";
const ACAO_RODAPE =
  "group relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-none transition";

// Seção de cada item no menu. Fica aqui no próprio componente (sem depender de
// campo extra no NAV_ITEMS). O "Início" fica solto, no topo, sem título.
const GRUPO_POR_ROTA: Record<string, string> = {
  "/pdv": "Operação",
  "/trocas": "Operação",
  "/consignados": "Operação",
  "/vendas": "Caixa",
  "/fechar-caixa": "Caixa",
  "/reabrir-caixa": "Caixa",
  "/estoque": "Gestão",
  "/categorias": "Gestão",
  "/relatorios": "Gestão",
  "/financas": "Gestão",
  "/usuarios": "Gestão",
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

// barra de rolagem fina e discreta (a padrão do Windows fica clara e grossa em cima do verde escuro)
const ROLAGEM_FINA =
  "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.22)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20";

function assinarNovidades(aoMudar: () => void) {
  window.addEventListener(EVENTO_NOVIDADES_VISTAS, aoMudar);
  return () => window.removeEventListener(EVENTO_NOVIDADES_VISTAS, aoMudar);
}

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();
  const [trocandoUsuario, setTrocandoUsuario] = useState(false);
  // selo "NOVO" no botão Novidades enquanto existir novidade que este navegador ainda não viu
  const novidadeNova = useSyncExternalStore(assinarNovidades, temNovidadeNaoVista, () => false);

  // "Conversas": total de não lidas e se o chat está aberto (o painel fica no ChatSuporte)
  const chat = useSyncExternalStore(assinarEstadoChat, lerEstadoChat, () => ESTADO_CHAT_SERVIDOR);

  if (!usuario) return null;

  const itens = NAV_ITEMS.filter((item) => item.perfis.includes(usuario.perfil));
  let grupoAnterior: string | undefined;

  return (
    <>
      {/* fundo escurecido atrás do menu quando aberto no celular — clicar nele fecha */}
      {aberta && (
        <div
          onClick={onFechar}
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 md:w-60 shrink-0 bg-gradient-to-b from-primary via-primary to-primary-dark text-white flex flex-col h-dvh md:h-screen fixed md:sticky top-0 left-0 z-50 overflow-hidden transition-transform duration-300 ease-out ${
          aberta ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* fundo tech: grade fina e brilhos (atrás de todo o conteúdo) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-20 z-0 w-64 h-64 rounded-full bg-info/25 blur-3xl" />

        {/* ---------- Cabeçalho: logo, nome e status do caixa ---------- */}
        <div className="relative z-10 px-3 pt-3 pb-2.5 border-b border-white/10 shrink-0 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -left-10 w-40 h-40 rounded-full bg-accent/25 blur-2xl" />
          <div className="relative flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl overflow-hidden ring-2 ring-accent/60 shadow-[0_0_14px_-2px_rgba(224,151,47,0.6)] shrink-0">
              <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-sm tracking-tight">Sistema de Gestão</p>
              <p className="text-[10px] font-mono uppercase tracking-wider text-accent-light/80 mt-0.5 flex items-center gap-1">
                <LayoutGrid className="w-3 h-3" /> Painel de controle
              </p>
            </div>
            <button
              onClick={onFechar}
              aria-label="Fechar menu"
              className="md:hidden p-1.5 rounded-lg hover:bg-white/10 active:bg-white/20 transition shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <CaixaStatusBadge variant="dark" className="relative mt-2" />
        </div>

        {/* ---------- Menu, com seções ---------- */}
        <nav className={`relative z-10 flex-1 min-h-0 overflow-y-auto px-3 py-1 space-y-0 ${ROLAGEM_FINA}`}>
          {itens.map((item) => {
            const ativo = pathname?.startsWith(item.href);
            const Icon = item.icon;
            const grupo = GRUPO_POR_ROTA[item.href];
            const mostrarTitulo = !!grupo && grupo !== grupoAnterior;
            if (grupo) grupoAnterior = grupo;
            return (
              <Fragment key={item.href}>
                {mostrarTitulo && (
                  <div className="flex items-center gap-2 px-2 pt-2.5 pb-1" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rotate-45 rounded-[1px] bg-accent/80" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{grupo}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>
                )}
                <Link
                  href={item.href}
                  onClick={onFechar}
                  aria-current={ativo ? "page" : undefined}
                  className={`${LINHA} ${ativo ? LINHA_ATIVA : LINHA_INATIVA}`}
                >
                  {/* barrinha de destaque do item atual (com brilho neon) */}
                  {ativo && (
                    <span className="absolute -left-3 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-accent shadow-[0_0_10px_rgba(224,151,47,0.9)]" />
                  )}
                  <span className={`${ICONE} ${ativo ? ICONE_ATIVO : ICONE_INATIVO}`}>
                    <span aria-hidden="true" className={BRILHO_ICONE} />
                    <Icon className="relative w-4 h-4" strokeWidth={ativo ? 2.1 : 1.75} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {ativo ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(224,151,47,0.9)] shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/50 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
                  )}
                </Link>
              </Fragment>
            );
          })}
        </nav>

        {/* ---------- Usuário e ações ---------- */}
        <div
          className="relative z-10 px-3 pt-2 border-t border-white/10 shrink-0 space-y-1 bg-black/10 backdrop-blur-sm"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-2.5 rounded-xl bg-gradient-to-br from-white/[0.12] to-black/20 ring-1 ring-white/15 px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)]">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent to-accent-dark text-primary-dark font-bold text-xs flex items-center justify-center ring-2 ring-white/30 shadow-[0_0_12px_-2px_rgba(224,151,47,0.7)]">
                {iniciais(usuario.nome)}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-primary-dark" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-tight truncate">{usuario.nome}</p>
              <p className="mt-0.5 inline-block rounded-md bg-white/10 px-1.5 py-px text-[9px] text-accent-light font-mono uppercase tracking-wider">
                {usuario.perfil === "ADMIN" ? "Administrador" : "Operador de caixa"}
              </p>
            </div>
          </div>

          {usuario.perfil === "ADMIN" && <NotificacoesPushButton />}

          {/* Conversas, Novidades, Trocar usuário e Sair: quatro ações lado a lado numa única fileira */}
          <div className="grid grid-cols-4 gap-1">
            <button
              onClick={() => {
                alternarChat();
                onFechar();
              }}
              title={chat.naoLidas > 0 ? `Conversas (${chat.naoLidas} não lida${chat.naoLidas === 1 ? "" : "s"})` : "Conversas"}
              aria-pressed={chat.aberto}
              className={`${ACAO_RODAPE} ${chat.aberto ? LINHA_ATIVA : LINHA_INATIVA}`}
            >
              <span className={`${ICONE} ${chat.aberto ? ICONE_ATIVO : ICONE_INATIVO}`}>
                <span aria-hidden="true" className={BRILHO_ICONE} />
                <MessageCircle className={`relative w-4 h-4 ${chat.naoLidas > 0 ? "animate-pulse" : ""}`} strokeWidth={1.75} />
              </span>
              Conversas
              {chat.naoLidas > 0 && (
                <span className="absolute right-1 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(185,74,59,0.9)]">
                  {chat.naoLidas > 9 ? "9+" : chat.naoLidas}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new Event(EVENTO_ABRIR_NOVIDADES));
                onFechar();
              }}
              title={novidadeNova ? "Novidades (há novidade nova)" : "Novidades"}
              className={`${ACAO_RODAPE} ${LINHA_INATIVA}`}
            >
              <span className={`${ICONE} ${ICONE_INATIVO}`}>
                <span aria-hidden="true" className={BRILHO_ICONE} />
                <Sparkles className="relative w-4 h-4" strokeWidth={1.75} />
              </span>
              Novidades
              {novidadeNova && (
                <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_rgba(224,151,47,0.9)] animate-pulse">
                  <span className="sr-only">Novo</span>
                </span>
              )}
            </button>
            <button
              onClick={() => setTrocandoUsuario(true)}
              title="Trocar usuário"
              className={`${ACAO_RODAPE} ${LINHA_INATIVA}`}
            >
              <span className={`${ICONE} ${ICONE_INATIVO}`}>
                <span aria-hidden="true" className={BRILHO_ICONE} />
                <UserCog className="relative w-4 h-4" strokeWidth={1.75} />
              </span>
              Trocar
            </button>
            <button onClick={logout} title="Sair" className={`${ACAO_RODAPE} ${LINHA_PERIGO}`}>
              <span className={`${ICONE} ${ICONE_PERIGO}`}>
                <span aria-hidden="true" className={BRILHO_ICONE} />
                <LogOut className="relative w-4 h-4" strokeWidth={1.75} />
              </span>
              Sair
            </button>
          </div>
        </div>

        {trocandoUsuario && <TrocarUsuarioModal onFechar={() => setTrocandoUsuario(false)} />}
      </aside>
    </>
  );
}
