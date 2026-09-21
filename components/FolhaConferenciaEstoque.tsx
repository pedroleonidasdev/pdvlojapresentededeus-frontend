"use client";

import { Produto } from "@/lib/types";
import { X, Printer } from "lucide-react";

/**
 * Folha para impressão em papel comum (A4), usada para conferir o estoque
 * físico da loja contra o que está cadastrado no sistema — por exemplo,
 * depois de alguém repor itens na prateleira sem lançar no sistema ainda.
 * Lista os produtos (respeitando o filtro/busca já aplicados na tela de
 * Estoque) com o saldo atual do sistema e uma coluna em branco para anotar
 * a contagem física à mão, item por item.
 */
export default function FolhaConferenciaEstoque({
  produtos,
  onFechar,
}: {
  produtos: Produto[];
  onFechar: () => void;
}) {
  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString("pt-BR");
  const horaFormatada = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const ordenados = [...produtos].sort((a, b) =>
    (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR", { sensitivity: "base" })
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Conferência de estoque</h2>
            <p className="text-xs text-muted mt-0.5">
              {ordenados.length} produto{ordenados.length === 1 ? "" : "s"} — imprime em folha A4 normal,
              com espaço para anotar a contagem física
            </p>
          </div>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* pré-visualização na tela — o que realmente sai na impressora é o
            bloco .a4-print logo abaixo, que só fica visível durante a impressão */}
        <div className="flex-1 overflow-y-auto p-5">
          {ordenados.length === 0 ? (
            <p className="text-sm text-muted text-center py-6">Nenhum produto para listar.</p>
          ) : (
            <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
              <thead className="bg-background">
                <tr className="text-left text-muted">
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium text-right">Sistema</th>
                  <th className="px-3 py-2 font-medium text-right">Contagem</th>
                </tr>
              </thead>
              <tbody>
                {ordenados.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2">{p.nome}</td>
                    <td className="px-3 py-2 text-muted">{p.categoria?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{p.quantidadeEstoque}</td>
                    <td className="px-3 py-2 text-right text-muted">____</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <button
            onClick={() => window.print()}
            disabled={ordenados.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            Imprimir folha de conferência
          </button>
        </div>
      </div>

      {/* conteúdo real da impressão — fica escondido na tela (via CSS,
          @media print isola isso e some com o resto) e só aparece no papel */}
      <div className="a4-print hidden">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold">Conferência de estoque</h1>
            <p className="text-xs text-gray-600 mt-0.5">
              Impresso em {dataFormatada} às {horaFormatada} — {ordenados.length} produto
              {ordenados.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={estiloCabecalho}>Produto</th>
              <th style={estiloCabecalho}>Categoria</th>
              <th style={{ ...estiloCabecalho, textAlign: "right" }}>Sistema</th>
              <th style={{ ...estiloCabecalho, textAlign: "right" }}>Contagem física</th>
              <th style={{ ...estiloCabecalho, textAlign: "right" }}>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((p) => (
              <tr key={p.id}>
                <td style={estiloCelula}>{p.nome}</td>
                <td style={estiloCelula}>{p.categoria?.nome ?? "—"}</td>
                <td style={{ ...estiloCelula, textAlign: "right" }}>{p.quantidadeEstoque}</td>
                <td style={{ ...estiloCelula, textAlign: "right" }}>&nbsp;</td>
                <td style={{ ...estiloCelula, textAlign: "right" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const estiloCabecalho: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1.5px solid #000",
  padding: "4px 6px",
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const estiloCelula: React.CSSProperties = {
  borderBottom: "1px solid #ccc",
  padding: "5px 6px",
  fontSize: "11px",
};
