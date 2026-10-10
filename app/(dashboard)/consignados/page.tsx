"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Consignacao, Produto } from "@/lib/types";
import {
  formatarMoeda,
  formatarDataHora,
  formatarDataISO,
  percentualComissaoConsignacao,
} from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import VisualizarConsignacao from "@/components/VisualizarConsignacao";
import {
  Search,
  Trash2,
  Plus,
  Minus,
  Handshake,
  Loader2,
  Printer,
  X,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";

function mensagemErro(e: unknown, padrao: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? padrao;
}

export default function ConsignadosPage() {
  const { usuario } = useAuth();
  const ehAdmin = usuario?.perfil === "ADMIN";

  const [lista, setLista] = useState<Consignacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [selecionada, setSelecionada] = useState<Consignacao | null>(null);
  const [visualizando, setVisualizando] = useState<Consignacao | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get<Consignacao[]>("/consignacoes");
      setLista(data);
      setErro(null);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível carregar as consignações."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="min-h-full bg-background">
      <div className="no-print">
        <PageHeader
          title="Consignados"
          subtitle="Mercadorias entregues em consignação, comissão do consignatário e baixa no estoque"
          action={
            <button
              onClick={() => setNovaAberta(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Nova consignação
            </button>
          }
        />

        <div className="p-4 sm:p-8 max-w-5xl">
          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-4">{erro}</p>}

          {carregando ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : lista.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Handshake className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma consignação registrada ainda.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {lista.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelecionada(c)}
                    className="w-full text-left bg-surface border border-border rounded-xl p-4 hover:border-primary transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{c.consignatario}</p>
                        <p className="text-xs text-muted mt-0.5">
                          #{c.id} · {formatarDataHora(c.dataHora)} · {c.usuarioNome}
                          {c.prazoDevolucao ? ` · devolução até ${formatarDataISO(c.prazoDevolucao)}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                      <Resumo rotulo="Enviado" valor={formatarMoeda(c.totalEnviado)} />
                      <Resumo
                        rotulo="Vendido"
                        valor={c.status === "FECHADA" ? formatarMoeda(c.totalVendido) : "—"}
                      />
                      <Resumo
                        rotulo="Comissão"
                        valor={c.status === "FECHADA" ? formatarMoeda(c.totalComissao) : "—"}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {novaAberta && (
        <ModalNovaConsignacao
          onClose={() => setNovaAberta(false)}
          onCriada={(c) => {
            setNovaAberta(false);
            carregar();
            setSelecionada(c);
          }}
        />
      )}

      {selecionada && (
        <ModalDetalhe
          consignacao={selecionada}
          ehAdmin={ehAdmin}
          onClose={() => setSelecionada(null)}
          onAtualizada={(c) => {
            setSelecionada(c);
            carregar();
          }}
          onExcluida={() => {
            setSelecionada(null);
            carregar();
          }}
          onImprimir={(c) => setVisualizando(c)}
        />
      )}

      {visualizando && <VisualizarConsignacao consignacao={visualizando} onFechar={() => setVisualizando(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: Consignacao["status"] }) {
  return status === "FECHADA" ? (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 rounded-full px-2.5 py-1">
      <Lock className="w-3 h-3" /> Fechada
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full px-2.5 py-1">
      <Clock className="w-3 h-3" /> Em aberto
    </span>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-muted">{rotulo}</p>
      <p className="font-medium text-sm">{valor}</p>
    </div>
  );
}

/* ------------------------------ Nova consignação ------------------------------ */

interface ItemNovo {
  produto: Produto;
  quantidade: number;
}

function ModalNovaConsignacao({
  onClose,
  onCriada,
}: {
  onClose: () => void;
  onCriada: (c: Consignacao) => void;
}) {
  const [consignatario, setConsignatario] = useState("");
  const [prazo, setPrazo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [itens, setItens] = useState<ItemNovo[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }
    const somenteNumeros = /^[0-9]+$/.test(termo);
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        if (somenteNumeros) {
          try {
            const { data } = await api.get<Produto>(`/produtos/codigo-barras/${termo}`);
            setResultados([data]);
          } catch {
            setResultados([]);
          }
        } else {
          const { data } = await api.get<Produto[]>("/produtos", { params: { nome: termo } });
          setResultados(data);
        }
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  function adicionar(produto: Produto) {
    setErro(null);
    setItens((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id);
      const qtd = (existente?.quantidade ?? 0) + 1;
      if (qtd > produto.quantidadeEstoque) {
        setErro(`Estoque insuficiente para ${produto.nome} (disponível: ${produto.quantidadeEstoque})`);
        return prev;
      }
      if (existente) return prev.map((i) => (i.produto.id === produto.id ? { ...i, quantidade: qtd } : i));
      return [...prev, { produto, quantidade: 1 }];
    });
    setBusca("");
    setResultados([]);
    buscaRef.current?.focus();
  }

  function alterar(produtoId: number, delta: number) {
    setItens((prev) =>
      prev
        .map((i) => {
          if (i.produto.id !== produtoId) return i;
          const nova = i.quantidade + delta;
          if (nova > i.produto.quantidadeEstoque) {
            setErro(`Estoque insuficiente para ${i.produto.nome} (disponível: ${i.produto.quantidadeEstoque})`);
            return i;
          }
          return { ...i, quantidade: nova };
        })
        .filter((i) => i.quantidade > 0)
    );
  }

  const total = itens.reduce((acc, i) => acc + i.produto.precoVenda * i.quantidade, 0);
  // itens cuja quantidade passa do estoque (o estoque pode ter mudado desde a busca)
  const itensSemEstoque = itens.filter((i) => i.quantidade > i.produto.quantidadeEstoque);
  const podeSalvar = consignatario.trim() !== "" && itens.length > 0 && itensSemEstoque.length === 0;

  function removerItem(produtoId: number) {
    setItens((prev) => prev.filter((x) => x.produto.id !== produtoId));
    setErro(null);
  }

  // Quando o servidor recusa por estoque, rebusca o estoque atual de cada item
  // para marcar exatamente quais precisam sair (ou ter a quantidade reduzida).
  async function atualizarEstoqueDosItens() {
    const atualizados = await Promise.all(
      itens.map(async (i) => {
        try {
          const { data } = await api.get<Produto>(`/produtos/${i.produto.id}`);
          return { ...i, produto: data };
        } catch {
          return i;
        }
      })
    );
    setItens(atualizados);
  }

  async function salvar() {
    if (!podeSalvar || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.post<Consignacao>("/consignacoes", {
        consignatario: consignatario.trim(),
        prazoDevolucao: prazo || undefined,
        observacao: observacao.trim() || undefined,
        itens: itens.map((i) => ({ produtoId: i.produto.id, quantidade: i.quantidade })),
      });
      onCriada(data);
    } catch (e) {
      const msg = mensagemErro(e, "Não foi possível registrar a consignação.");
      setErro(
        /estoque insuficiente/i.test(msg)
          ? `${msg}. Remova o item marcado em vermelho ou diminua a quantidade.`
          : msg
      );
      if (/estoque insuficiente/i.test(msg)) await atualizarEstoqueDosItens();
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-sm">Nova consignação</h2>
            <p className="text-xs text-muted mt-0.5">O estoque só dá baixa quando a consignação for fechada.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-background text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-muted block sm:col-span-2">
              Consignatário (quem recebe a mercadoria)
              <input
                className="input mt-1"
                placeholder="Ex: Cursilho Feminino - 2026"
                value={consignatario}
                onChange={(e) => setConsignatario(e.target.value)}
                maxLength={150}
              />
            </label>
            <label className="text-xs text-muted block">
              Devolver o que não vender até
              <input type="date" className="input mt-1" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <label className="text-xs text-muted block">
              Observação (opcional)
              <input
                className="input mt-1"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                maxLength={255}
              />
            </label>
          </div>

          <div>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={buscaRef}
                className="input pl-9"
                placeholder="Buscar produto por nome ou código de barras"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {buscando && <Loader2 className="w-4 h-4 animate-spin text-muted absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>
            {resultados.length > 0 && (
              <ul className="mt-2 border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => adicionar(p)}
                      disabled={p.quantidadeEstoque <= 0}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-background disabled:opacity-40 flex justify-between gap-3"
                    >
                      <span className="truncate">{p.nome}</span>
                      <span className="text-xs text-muted shrink-0">
                        {formatarMoeda(p.precoVenda)} · estoque {p.quantidadeEstoque} ·{" "}
                        {percentualComissaoConsignacao(p.categoria?.nome)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {itens.length > 0 && (
            <ul className="border border-border rounded-lg divide-y divide-border">
              {itens.map((i) => {
                const semEstoque = i.quantidade > i.produto.quantidadeEstoque;
                return (
                <li
                  key={i.produto.id}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${semEstoque ? "bg-danger/10" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{i.produto.nome}</p>
                    <p className="text-xs text-muted">
                      {i.produto.categoria?.nome ?? "Sem categoria"} · comissão{" "}
                      {percentualComissaoConsignacao(i.produto.categoria?.nome)}%
                    </p>
                    {semEstoque && (
                      <p className="text-xs text-danger font-medium mt-0.5">
                        {i.produto.quantidadeEstoque <= 0
                          ? "Sem estoque deste produto."
                          : `Estoque insuficiente (disponível: ${i.produto.quantidadeEstoque}).`}{" "}
                        Remova o item ou reduza a quantidade.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => alterar(i.produto.id, -1)} className="p-1 rounded hover:bg-background">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono">{i.quantidade}</span>
                    <button onClick={() => alterar(i.produto.id, 1)} className="p-1 rounded hover:bg-background">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="w-24 text-right font-mono">{formatarMoeda(i.produto.precoVenda * i.quantidade)}</span>
                  <button
                    onClick={() => removerItem(i.produto.id)}
                    title="Remover este item da consignação"
                    aria-label={`Remover ${i.produto.nome}`}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                </li>
                );
              })}
            </ul>
          )}

          {itensSemEstoque.length > 0 && (
            <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              {itensSemEstoque.length === 1
                ? "1 item está sem estoque suficiente."
                : `${itensSemEstoque.length} itens estão sem estoque suficiente.`}{" "}
              Remova-os (botão “Remover”) para poder registrar a consignação.
            </p>
          )}

          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
          <p className="text-sm">
            Total enviado: <strong>{formatarMoeda(total)}</strong>
          </p>
          <button
            onClick={salvar}
            disabled={!podeSalvar || salvando}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Registrar consignação
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Detalhe ---------------------------------- */

function ModalDetalhe({
  consignacao,
  ehAdmin,
  onClose,
  onAtualizada,
  onExcluida,
  onImprimir,
}: {
  consignacao: Consignacao;
  ehAdmin: boolean;
  onClose: () => void;
  onAtualizada: (c: Consignacao) => void;
  onExcluida: () => void;
  onImprimir: (c: Consignacao) => void;
}) {
  const aberta = consignacao.status === "ABERTA";
  const [vendidas, setVendidas] = useState<Record<number, number>>({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);

  const vendidaDe = (id: number, enviada: number, atual: number) =>
    aberta ? Math.min(Math.max(vendidas[id] ?? 0, 0), enviada) : atual;

  // prévia do acerto enquanto o operador digita as quantidades vendidas
  let totalVendido = 0;
  let totalComissao = 0;
  let totalUnidadesVendidas = 0;
  for (const i of consignacao.itens) {
    const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
    const valor = q * i.precoUnitario;
    totalUnidadesVendidas += q;
    totalVendido += valor;
    totalComissao += (valor * i.percentualComissao) / 100;
  }
  totalComissao = Math.round(totalComissao * 100) / 100;

  async function fechar() {
    if (enviandoRef.current) return;
    const msg =
      totalUnidadesVendidas > 0
        ? `Fechar a consignação e dar baixa de ${totalUnidadesVendidas} unidade(s) vendida(s) no estoque? Essa ação só pode ser desfeita por um administrador, excluindo a consignação.`
        : "Nenhuma unidade foi marcada como vendida. Fechar mesmo assim (sem baixa no estoque)?";
    if (!confirm(msg)) return;
    enviandoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const { data } = await api.post<Consignacao>(`/consignacoes/${consignacao.id}/fechar`, {
        itens: consignacao.itens.map((i) => ({
          itemId: i.id,
          quantidadeVendida: vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida),
        })),
      });
      onAtualizada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível fechar a consignação."));
    } finally {
      enviandoRef.current = false;
      setSalvando(false);
    }
  }

  async function removerItem(itemId: number, nome: string) {
    if (enviandoRef.current) return;
    if (!confirm(`Remover "${nome}" desta consignação? O estoque não foi alterado, então nada volta.`)) return;
    enviandoRef.current = true;
    setErro(null);
    try {
      const { data } = await api.delete<Consignacao>(`/consignacoes/${consignacao.id}/itens/${itemId}`);
      setVendidas((prev) => {
        const novo = { ...prev };
        delete novo[itemId];
        return novo;
      });
      onAtualizada(data);
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível remover o item."));
    } finally {
      enviandoRef.current = false;
    }
  }

  async function excluir() {
    const aviso = aberta
      ? "Excluir esta consignação? O estoque não foi alterado, então nada volta."
      : "Excluir esta consignação FECHADA? As unidades vendidas voltam para o estoque.";
    if (!confirm(aviso)) return;
    try {
      await api.delete(`/consignacoes/${consignacao.id}`);
      onExcluida();
    } catch (e) {
      setErro(mensagemErro(e, "Não foi possível excluir."));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 no-print">
      <div className="bg-surface rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-sm truncate">{consignacao.consignatario}</h2>
              <StatusBadge status={consignacao.status} />
            </div>
            <p className="text-xs text-muted mt-0.5">
              #{consignacao.id} · {formatarDataHora(consignacao.dataHora)} · {consignacao.usuarioNome}
              {consignacao.prazoDevolucao ? ` · devolução até ${formatarDataISO(consignacao.prazoDevolucao)}` : ""}
              {consignacao.dataFechamento ? ` · fechada em ${formatarDataHora(consignacao.dataFechamento)}` : ""}
            </p>
            {consignacao.observacao && <p className="text-xs text-muted mt-0.5">Obs: {consignacao.observacao}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-background text-muted shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {aberta && (
            <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 mb-3">
              Quando o consignatário prestar contas, informe quantas unidades de cada item foram <strong>vendidas</strong> e
              feche a consignação. Só a quantidade vendida dá baixa no estoque; o restante volta para a loja.
            </p>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                <th className="py-2 pr-2 font-medium">Produto</th>
                <th className="py-2 px-2 font-medium text-right">Enviada</th>
                <th className="py-2 px-2 font-medium text-right">Preço</th>
                <th className="py-2 px-2 font-medium text-right">Com.</th>
                <th className="py-2 px-2 font-medium text-right">Vendida</th>
                <th className="py-2 px-2 font-medium text-right">Devolvida</th>
                <th className="py-2 pl-2 font-medium text-right">Valor vendido</th>
                {aberta && consignacao.itens.length > 1 && <th className="py-2 pl-2 w-8" />}
              </tr>
            </thead>
            <tbody>
              {consignacao.itens.map((i) => {
                const q = vendidaDe(i.id, i.quantidadeEnviada, i.quantidadeVendida);
                return (
                  <tr key={i.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">
                      {i.produtoNome}
                      <span className="block text-muted">{i.categoriaNome ?? "Sem categoria"}</span>
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada}</td>
                    <td className="py-2 px-2 text-right font-mono">{formatarMoeda(i.precoUnitario)}</td>
                    <td className="py-2 px-2 text-right font-mono">{i.percentualComissao}%</td>
                    <td className="py-2 px-2 text-right">
                      {aberta ? (
                        <input
                          type="number"
                          min={0}
                          max={i.quantidadeEnviada}
                          value={vendidas[i.id] ?? 0}
                          onChange={(e) =>
                            setVendidas((prev) => ({ ...prev, [i.id]: Math.floor(Number(e.target.value) || 0) }))
                          }
                          className="input w-16 text-right py-1"
                        />
                      ) : (
                        <span className="font-mono">{i.quantidadeVendida}</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantidadeEnviada - q}</td>
                    <td className="py-2 pl-2 text-right font-mono">{formatarMoeda(q * i.precoUnitario)}</td>
                    {aberta && consignacao.itens.length > 1 && (
                      <td className="py-2 pl-2 text-right">
                        <button
                          onClick={() => removerItem(i.id, i.produtoNome)}
                          title="Remover este item da consignação"
                          aria-label={`Remover ${i.produtoNome}`}
                          className="p-1 rounded hover:bg-danger/10 text-danger"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted">
              <span>Total enviado</span>
              <span className="font-mono">{formatarMoeda(consignacao.totalEnviado)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total vendido</span>
              <span className="font-mono">{formatarMoeda(totalVendido)}</span>
            </div>
            <div className="flex justify-between">
              <span>Comissão do consignatário</span>
              <span className="font-mono">{formatarMoeda(totalComissao)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1">
              <span>Líquido para a loja</span>
              <span className="font-mono">{formatarMoeda(totalVendido - totalComissao)}</span>
            </div>
          </div>

          {erro && <p className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mt-4">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => onImprimir(consignacao)}
              className="flex items-center gap-2 border border-border hover:bg-background text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <Printer className="w-4 h-4" />
              Visualizar / imprimir / salvar
            </button>
            {ehAdmin && (
              <button
                onClick={excluir}
                className="flex items-center gap-2 text-danger hover:bg-danger/10 text-sm font-medium px-3 py-2 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>
          {aberta && (
            <button
              onClick={fechar}
              disabled={salvando}
              className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-medium text-sm px-5 py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Fechar e dar baixa no estoque
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
