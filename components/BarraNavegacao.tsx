"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Fio dourado fixo no topo da tela que aparece quando a pessoa clica num link
 * para outra página e some quando a nova página abre (o mesmo efeito do
 * "nprogress", sem depender de biblioteca). Não precisa mexer nos <Link>:
 * ele escuta os cliques na página inteira.
 */
export default function BarraNavegacao() {
  const pathname = usePathname();
  const [visivel, setVisivel] = useState(false);
  const [largura, setLargura] = useState(0);
  const intervalo = useRef<ReturnType<typeof setInterval> | null>(null);
  const esconder = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limite = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ativa = useRef(false);

  const limpar = useCallback(() => {
    if (intervalo.current) clearInterval(intervalo.current);
    if (esconder.current) clearTimeout(esconder.current);
    if (limite.current) clearTimeout(limite.current);
  }, []);

  const terminar = useCallback(() => {
    if (!ativa.current) return;
    ativa.current = false;
    limpar();
    setLargura(100);
    esconder.current = setTimeout(() => {
      setVisivel(false);
      setLargura(0);
    }, 350);
  }, [limpar]);

  const iniciar = useCallback(() => {
    if (ativa.current) return;
    ativa.current = true;
    limpar();
    setVisivel(true);
    setLargura(8);
    // avança rápido e desacelera, sem nunca chegar a 100% sozinho
    intervalo.current = setInterval(() => {
      setLargura((atual) => atual + (92 - atual) * 0.08);
    }, 200);
    // trava de segurança: se a página não abrir, não deixa a barra presa
    limite.current = setTimeout(terminar, 15_000);
  }, [limpar, terminar]);

  // página nova abriu → conclui a barra
  useEffect(() => {
    terminar();
  }, [pathname, terminar]);

  useEffect(() => {
    function aoClicar(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a");
      if (!link || !link.href) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const destino = new URL(link.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname) return; // mesma página ou só #âncora/?busca
      iniciar();
    }
    const aoVoltar = () => iniciar();

    document.addEventListener("click", aoClicar, true);
    window.addEventListener("popstate", aoVoltar);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      window.removeEventListener("popstate", aoVoltar);
      limpar();
    };
  }, [iniciar, limpar]);

  if (!visivel) return null;

  return (
    <div
      role="progressbar"
      aria-label="Abrindo página"
      aria-valuenow={Math.round(largura)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="no-print pointer-events-none fixed inset-x-0 top-0 z-[200] h-1"
    >
      <div
        className="h-full rounded-r-full bg-gradient-to-r from-accent-dark via-accent to-accent-light shadow-[0_0_8px_rgba(224,151,47,0.7)] transition-[width] duration-200 ease-out"
        style={{ width: `${largura}%` }}
      />
    </div>
  );
}
