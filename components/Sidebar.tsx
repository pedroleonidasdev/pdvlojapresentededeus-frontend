"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { LogOut, UserCog, X } from "lucide-react";
import { NAV_ITEMS, LayoutGrid } from "@/lib/nav-items";
import TrocarUsuarioModal from "./TrocarUsuarioModal";
import CaixaStatusBadge from "./CaixaStatusBadge";
import NotificacoesPushButton from "./NotificacoesPushButton";

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

const LINHA_BASE =
  "group relative w-full flex items-center gap-3 pl-3 pr-2.5 py-1.5 rounded-xl text-[13.5px] leading-tight text-left transition-all duration-200";
const LINHA_INATIVA = "text-white/70 hover:bg-white/10 hover:text-white";
const ICONE_BASE =
  "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-all duration-300 ease-out";
const ICONE_INATIVO =
  "bg-white/5 text-white/70 group-hover:bg-white/15 group-hover:text-white group-hover:scale-110 group-hover:-rotate-3";

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const pathname = usePathname();
  const { usuario, logout } = useAuth();
  const [trocandoUsuario, setTrocandoUsuario] = useState(false);

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
        {/* ---------- Cabeçalho: logo, nome e status do caixa ---------- */}
        <div className="relative px-4 pt-5 pb-4 border-b border-white/10 shrink-0 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -left-10 w-36 h-36 rounded-full bg-accent/15 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden ring-2 ring-accent/50 shadow-lg shadow-black/30 shrink-0">
              <img src="/icon-192.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight text-[15px] tracking-tight">Sistema de Gestão</p>
              <p className="text-[11px] text-accent-light/80 mt-0.5 flex items-center gap-1">
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
          <CaixaStatusBadge variant="dark" className="relative mt-3" />
        </div>

        {/* ---------- Menu, com seções ---------- */}
        <nav className={`flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-0.5 ${ROLAGEM_FINA}`}>
          {itens.map((item) => {
            const ativo = pathname?.startsWith(item.href);
            const Icon = item.icon;
            const grupo = GRUPO_POR_ROTA[item.href];
            const mostrarTitulo = !!grupo && grupo !== grupoAnterior;
            if (grupo) grupoAnterior = grupo;
            return (
              <Fragment key={item.href}>
                {mostrarTitulo && (
                  <div className="flex items-center gap-2 px-3 pt-4 pb-1.5" aria-hidden="true">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{grupo}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                <Link
                  href={item.href}
                  onClick={onFechar}
                  aria-current={ativo ? "page" : undefined}
                  className={`${LINHA_BASE} ${
                    ativo ? "bg-gradient-to-r from-white/20 to-white/5 text-white font-semibold ring-1 ring-white/10 shadow-sm" : LINHA_INATIVA
                  }`}
                >
                  {/* barrinha de destaque do item atual */}
                  {ativo && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-accent shadow-[0_0_8px_rgba(224,151,47,0.7)]" />
                  )}
                  <span
                    className={`${ICONE_BASE} ${
                      ativo ? "bg-accent text-primary-dark shadow-md shadow-black/25" : ICONE_INATIVO
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px]" strokeWidth={ativo ? 2.4 : 2} />
                  </span>
                  {item.label}
                </Link>
              </Fragment>
            );
          })}
        </nav>

        {/* ---------- Usuário e ações ---------- */}
        <div
          className="px-3 pt-3 border-t border-white/10 shrink-0 space-y-1"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-3 rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-full bg-accent text-primary-dark font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-black/25">
              {iniciais(usuario.nome)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{usuario.nome}</p>
              <p className="text-[10px] text-white/50 mt-0.5 font-mono uppercase tracking-wider">
                {usuario.perfil === "ADMIN" ? "Administrador" : "Operador de caixa"}
              </p>
            </div>
          </div>

          {usuario.perfil === "ADMIN" && <NotificacoesPushButton />}

          <button onClick={() => setTrocandoUsuario(true)} className={`${LINHA_BASE} ${LINHA_INATIVA}`}>
            <span className={`${ICONE_BASE} ${ICONE_INATIVO}`}>
              <UserCog className="w-[17px] h-[17px]" />
            </span>
            Trocar usuário
          </button>
          <button
            onClick={logout}
            className={`${LINHA_BASE} text-white/70 hover:bg-red-500/15 hover:text-red-100`}
          >
            <span
              className={`${ICONE_BASE} bg-white/5 text-white/70 group-hover:bg-red-500/25 group-hover:text-red-100 group-hover:scale-110 group-hover:-rotate-3`}
            >
              <LogOut className="w-[17px] h-[17px]" />
            </span>
            Sair
          </button>
        </div>

        {trocandoUsuario && <TrocarUsuarioModal onFechar={() => setTrocandoUsuario(false)} />}
      </aside>
    </>
  );
}
