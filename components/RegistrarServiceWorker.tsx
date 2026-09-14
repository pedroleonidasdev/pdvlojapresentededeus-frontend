"use client";

import { useEffect } from "react";

/** Registra o service worker que habilita "Adicionar à tela inicial" no celular. */
export default function RegistrarServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // instalação como app é um extra; se falhar, o sistema continua
        // funcionando normalmente pelo navegador
      });
    }
  }, []);

  return null;
}
