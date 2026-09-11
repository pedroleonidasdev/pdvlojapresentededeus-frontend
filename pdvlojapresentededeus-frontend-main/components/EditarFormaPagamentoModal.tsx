"use client";

import { useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Venda, FormaPagamento } from "@/lib/types";
import { LABEL_FORMA_PAGAMENTO } from "@/lib/format";
import { X, Loader2, ShieldCheck } from "lucide-react";

const FORMAS: FormaPagamento[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO", "CARTAO_DEBITO"];

/**
 * Corrige a forma de pagamento de uma venda já registrada.
 * ADMIN edita direto. Qualquer outro perfil (CAIXA) precisa informar login e
 * senha de um administrador para autorizar a correção — validado no backend.
 */
export default function EditarFormaPagamentoModal({
  venda,
  onFechar,
  onSalvo,
}: {
  venda: Venda;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const { usuario } = useAuth();
  const precisaAutorizacao = usuario?.perfil !== "ADMIN";

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(venda.formaPagamento);
  const [loginAdmin, setLoginAdmin] = useState("");
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await api.put(`/vendas/${venda.id}/forma-pagamento`, {
        formaPagamento,
        ...(precisaAutorizacao
          ? { usuarioAutorizacaoLogin: loginAdmin.trim(), senhaAutorizacao: senhaAdmin }
          : {}),
      });
      onSalvo();
      onFechar();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Não foi possível salvar a alteração.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  const nadaMudou = formaPagamento === venda.formaPagamento;
  const faltaAutorizacao = precisaAutorizacao && (!loginAdmin.trim() || !senhaAdmin);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Editar forma de pagamento — Venda #{venda.id}</h2>
          <button onClick={onFechar} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Forma de pagamento</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
              className="input w-full"
            >
              {FORMAS.map((f) => (
                <option key={f} value={f}>
                  {LABEL_FORMA_PAGAMENTO[f]}
                </option>
              ))}
            </select>
          </div>

          {precisaAutorizacao && (
            <div className="rounded-lg border border-border bg-background p-3.5 space-y-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <ShieldCheck className="w-3.5 h-3.5" />
                Autorização de um administrador é necessária
              </p>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Login do administrador</label>
                <input
                  type="text"
                  value={loginAdmin}
                  onChange={(e) => setLoginAdmin(e.target.value)}
                  className="input w-full"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Senha de autorização</label>
                <input
                  type="password"
                  value={senhaAdmin}
                  onChange={(e) => setSenhaAdmin(e.target.value)}
                  className="input w-full"
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {erro && <div className="rounded-lg bg-danger-light text-danger text-sm px-3 py-2">{erro}</div>}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <button
            onClick={onFechar}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-border hover:bg-background transition"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando || nadaMudou || faltaAutorizacao}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
