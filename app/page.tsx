"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TelaCarregamento } from "@/components/CarregamentoCatolico";

export default function Home() {
  const { usuario, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    router.replace(usuario ? "/inicio" : "/login");
  }, [carregando, usuario, router]);

  return <TelaCarregamento />;
}
