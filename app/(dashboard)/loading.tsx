import { CarregandoSecao } from "@/components/CarregamentoCatolico";

// Mostrado dentro do painel (ao lado do menu) enquanto uma página nova abre.
export default function Loading() {
  return <CarregandoSecao className="h-full min-h-[60vh]" mensagem="Abrindo página…" />;
}
