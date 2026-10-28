"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Download, Loader2, RotateCw } from "lucide-react";
import { BarraCarregamento, CruzIcone, OracaoRotativa } from "@/components/CarregamentoCatolico";
import { haTrabalhoEmAndamento } from "@/lib/trabalho-em-andamento";
import {
  buscarVersaoServidor,
  gravarServidorVisto,
  lerMostrarAtualizado,
  lerServidorVisto,
  limparMostrarAtualizado,
} from "@/lib/versao-servidor";

// Versão embutida neste JavaScript (definida em next.config.ts).
const VERSAO_ATUAL = process.env.NEXT_PUBLIC_APP_VERSION ?? "";
const CHAVE_VERSAO_VISTA = "pdv_versao_vista";
const INTERVALO_CHECAGEM_MS = 2 * 60_000;
// depois de "Mais tarde" o aviso só volta a aparecer depois deste tempo
const ADIAR_AVISO_MS = 30 * 60_000;
// sem venda em andamento, o sistema reinicia sozinho depois desta contagem
const SEGUNDOS_AUTOMATICO = 20;
// a confirmação "Sistema atualizado" fecha sozinha depois de alguns segundos
const SEGUNDOS_CONFIRMACAO = 8;

const PASSOS = ["Verificando a nova versão", "Baixando a atualização", "Preparando para reiniciar", "Reiniciando o sistema"];

type Fase = "aviso" | "atualizando" | "erro" | "sucesso";

/** true quando este navegador já tinha aberto uma versão diferente da atual. */
function versaoMudouDesdeUltimaVisita(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return false;
  try {
    const vista = localStorage.getItem(CHAVE_VERSAO_VISTA);
    return !!vista && vista !== VERSAO_ATUAL;
  } catch {
    return false;
  }
}

/** Hash curto (7 letras) quando a versão é um commit; senão não mostra nada. */
function versaoCurta(versao?: string | null): string | null {
  return versao && /^[0-9a-f]{40}$/i.test(versao) ? versao.slice(0, 7) : null;
}

/**
 * Fluxo de atualização do sistema (janela no meio da tela):
 *
 * 1. Quando existe uma versão nova publicada (conferido ao abrir o painel, ao voltar para a
 *    aba/app, ao reconectar e a cada 2 minutos) aparece o aviso. Se NÃO há venda em andamento,
 *    uma contagem de 20 s reinicia o sistema sozinho; com venda em andamento não há contagem —
 *    só o botão "Atualizar agora" — porque o carrinho se perderia. "Mais tarde" adia por 30 min.
 *    O foco inicial fica em "Mais tarde" para o Enter do leitor de código de barras não recarregar
 *    a página.
 * 2. Ao atualizar, uma barra de progresso acompanha as etapas reais: confere a versão, baixa os
 *    arquivos novos, prepara e reinicia (o login é mantido). Sem internet, mostra o erro e deixa
 *    tentar de novo.
 * 3. Ao abrir na versão nova aparece "Sistema atualizado!" (fecha sozinho). Na primeira vez que o
 *    navegador abre o sistema só registra a versão, sem mostrar nada.
 * 4. Atualização do SERVIDOR (backend) conta do mesmo jeito: se a versão do servidor muda com o sistema
 *    aberto, aparece o mesmo aviso (atualizar agora / mais tarde).
 * 5. "Mais tarde" não esconde o assunto: fica a caixinha "Atualização disponível" na tela até a pessoa
 *    atualizar, e o aviso completo volta depois de 30 min. Quem sai e entra de novo é atualizado antes de
 *    o sistema ser liberado (ver GuardaAtualizacao).
 */
export default function AtualizacaoSistema() {
  const [novaVersao, setNovaVersao] = useState<string | null>(null);
  const [fase, setFase] = useState<Fase>(() => (versaoMudouDesdeUltimaVisita() || lerMostrarAtualizado() ? "sucesso" : "aviso"));
  const [progresso, setProgresso] = useState(0);
  const [passo, setPasso] = useState(0);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // "Mais tarde": o aviso completo some, mas a caixinha "Atualização disponível" fica na tela
  const [adiado, setAdiado] = useState(false);

  const progressoRef = useRef(0);
  const quadroRef = useRef<number | null>(null);
  const atualizandoRef = useRef(false);
  // versão do servidor que gerou o aviso (para registrar como "vista" quando a pessoa atualizar)
  const servidorNovoRef = useRef<string | null>(null);

  // a confirmação "Sistema atualizado!" (se pedida pelo porteiro) já foi lida; não repete no próximo carregamento
  useEffect(() => {
    limparMostrarAtualizado();
  }, []);

  // registra a versão que este navegador está usando agora
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return;
    try {
      localStorage.setItem(CHAVE_VERSAO_VISTA, VERSAO_ATUAL);
    } catch {
      // sem acesso ao localStorage: só não mostra a confirmação
    }
  }, []);

  const verificar = useCallback(async () => {
    // em desenvolvimento a versão muda a todo momento — não avisa
    if (process.env.NODE_ENV !== "production" || !VERSAO_ATUAL) return;
    if (atualizandoRef.current) return;

    // 1) versão do sistema (frontend) publicada
    try {
      const resp = await fetch("/api/versao", { cache: "no-store" });
      if (resp.ok) {
        const { versao } = (await resp.json()) as { versao?: string | null };
        if (versao && versao !== VERSAO_ATUAL) setNovaVersao(versao);
      }
    } catch {
      // sem internet agora — tenta de novo na próxima checagem
    }

    // 2) versão do servidor (backend): mudou desde que este navegador a viu pela última vez?
    const servidor = await buscarVersaoServidor(8000);
    if (servidor?.versao) {
      const vista = lerServidorVisto();
      if (!vista) {
        gravarServidorVisto(servidor.versao);
      } else if (vista !== servidor.versao) {
        servidorNovoRef.current = servidor.versao;
        setNovaVersao((atual) => atual ?? servidor.versao);
      }
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(verificar, 0);
    const intervalo = setInterval(verificar, INTERVALO_CHECAGEM_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") verificar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", verificar);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", verificar);
    };
  }, [verificar]);

  // anima a barra suavemente até o valor indicado
  const animarAte = useCallback(
    (alvo: number, ms: number) =>
      new Promise<void>((resolve) => {
        const de = progressoRef.current;
        const t0 = performance.now();
        const quadro = () => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          const v = de + (alvo - de) * (1 - Math.pow(1 - k, 2));
          progressoRef.current = v;
          setProgresso(v);
          if (k < 1) quadroRef.current = requestAnimationFrame(quadro);
          else resolve();
        };
        quadro();
      }),
    []
  );

  // baixa de verdade os arquivos da versão nova (melhor esforço): a página reinicia já com tudo no cache
  const baixarArquivos = useCallback(async () => {
    const inicio = performance.now();
    try {
      const html = await (await fetch("/", { cache: "reload" })).text();
      const urls = Array.from(new Set(html.match(/\/_next\/static\/[^"'\\\s)]+\.(?:js|css)/g) ?? [])).slice(0, 40);
      let feitos = 0;
      await Promise.all(
        urls.map(async (url) => {
          try {
            await fetch(url);
          } catch {
            // um arquivo que falhar não impede a atualização
          }
          feitos += 1;
          const alvo = 15 + (60 * feitos) / urls.length;
          if (alvo > progressoRef.current) {
            progressoRef.current = alvo;
            setProgresso(alvo);
          }
        })
      );
    } catch {
      // sem acesso à página agora: segue para a próxima etapa
    }
    // garante um tempo mínimo visível nesta etapa, para a barra não "pular"
    const gasto = performance.now() - inicio;
    await animarAte(75, Math.max(300, 1400 - gasto));
  }, [animarAte]);

  const atualizar = useCallback(async () => {
    if (atualizandoRef.current) return;
    atualizandoRef.current = true;
    setFase("atualizando");
    setPasso(0);
    progressoRef.current = 0;
    setProgresso(0);
    try {
      const resp = await fetch("/api/versao", { cache: "no-store" });
      if (!resp.ok) throw new Error("versão indisponível");
      await animarAte(15, 600);
      setPasso(1);
      await baixarArquivos();
      setPasso(2);
      await animarAte(92, 700);
      setPasso(3);
      await animarAte(100, 500);
      // deixa a barra cheia à vista por um instante antes de reiniciar
      await new Promise((r) => setTimeout(r, 600));
      if (servidorNovoRef.current) gravarServidorVisto(servidorNovoRef.current);
      window.location.reload();
    } catch {
      atualizandoRef.current = false;
      setFase("erro");
    }
  }, [animarAte, baixarArquivos]);

  // contagem para reiniciar sozinho (só quando não há venda em andamento)
  const atualizarRef = useRef(atualizar);
  useEffect(() => {
    atualizarRef.current = atualizar;
  }, [atualizar]);

  useEffect(() => {
    if (fase !== "aviso" || !novaVersao || adiado) return;
    let restante = SEGUNDOS_AUTOMATICO;
    const tick = () => {
      const emAndamento = haTrabalhoEmAndamento();
      setOcupado(emAndamento);
      if (emAndamento) {
        restante = SEGUNDOS_AUTOMATICO;
        setSegundos(null);
        return;
      }
      setSegundos(restante);
      if (restante <= 0) {
        clearInterval(intervalo);
        void atualizarRef.current();
        return;
      }
      restante -= 1;
    };
    const primeiro = setTimeout(tick, 0);
    const intervalo = setInterval(tick, 1000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [fase, novaVersao, adiado]);

  // limpa a animação se o componente sair da tela
  useEffect(() => {
    return () => {
      if (quadroRef.current) cancelAnimationFrame(quadroRef.current);
    };
  }, []);

  // depois de "Mais tarde", o aviso completo volta sozinho passado um tempo
  useEffect(() => {
    if (!adiado) return;
    const t = setTimeout(() => setAdiado(false), ADIAR_AVISO_MS);
    return () => clearTimeout(t);
  }, [adiado]);

  function adiar() {
    setAdiado(true);
    setSegundos(null);
    setFase("aviso");
  }

  if (fase === "aviso" && !novaVersao) return null;

  // "Mais tarde": só a caixinha, que lembra que há atualização e deixa atualizar quando quiser
  if (fase === "aviso" && adiado) {
    return <CaixaAtualizacaoPendente onClick={() => setAdiado(false)} />;
  }

  return (
    <PainelAtualizacao
      fase={fase}
      versaoAtual={versaoCurta(VERSAO_ATUAL)}
      versaoNova={versaoCurta(novaVersao)}
      progresso={progresso}
      passo={passo}
      segundos={segundos}
      ocupado={ocupado}
      onAtualizar={() => void atualizar()}
      onAdiar={adiar}
      onFechar={() => setFase("aviso")}
    />
  );
}

/** Parte visual do fluxo (sem lógica), separada para ficar fácil de ajustar e de testar. */
export function PainelAtualizacao({
  fase,
  versaoAtual,
  versaoNova,
  progresso,
  passo,
  segundos,
  ocupado,
  onAtualizar,
  onAdiar,
  onFechar,
  passos = PASSOS,
  titulo = "Atualizando o sistema…",
  rotulo = "Atualizando",
  aviso = "Não feche esta janela. O sistema reinicia sozinho.",
}: {
  fase: Fase;
  versaoAtual: string | null;
  versaoNova: string | null;
  progresso: number;
  passo: number;
  segundos: number | null;
  ocupado: boolean;
  onAtualizar: () => void;
  onAdiar: () => void;
  onFechar: () => void;
  /** Etapas mostradas na fase "atualizando" (padrão: as da atualização com reinício). */
  passos?: string[];
  titulo?: string;
  rotulo?: string;
  aviso?: string;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const aoEscRef = useRef<() => void>(() => {});
  // Esc = "Mais tarde" / "Fechar" (nunca durante a atualização, nem atualiza sem querer)
  useEffect(() => {
    aoEscRef.current = fase === "aviso" || fase === "erro" ? onAdiar : fase === "sucesso" ? onFechar : () => {};
  });

  // mantém o Tab dentro da janela enquanto ela está aberta (aria-modal)
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        aoEscRef.current();
        return;
      }
      if (e.key !== "Tab" || !caixaRef.current) return;
      const focaveis = caixaRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (focaveis.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      const ativo = document.activeElement;
      if (!caixaRef.current.contains(ativo)) {
        e.preventDefault();
        primeiro.focus();
      } else if (e.shiftKey && ativo === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && ativo === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  // a confirmação "Sistema atualizado!" fecha sozinha (não depende da animação do CSS, que pode estar desligada)
  useEffect(() => {
    if (fase !== "sucesso") return;
    const t = setTimeout(() => aoEscRef.current(), SEGUNDOS_CONFIRMACAO * 1000);
    return () => clearTimeout(t);
  }, [fase]);

  const semInternet = typeof navigator !== "undefined" && navigator.onLine === false;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-primary-dark/60 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-atualizacao"
    >
      <div ref={caixaRef} className="login-entra relative w-full max-w-md overflow-hidden rounded-3xl bg-surface text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/5">
        <div aria-hidden className="h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="px-7 py-8 sm:px-9 sm:py-10">
          {fase === "aviso" && (
            <>
              <IconeFase tom="primario" brilho>
                <Download className="h-7 w-7" strokeWidth={1.75} />
              </IconeFase>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-dark">
                Atualização disponível
              </p>
              <h2 id="titulo-atualizacao" className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                Há uma nova versão do sistema
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Ao atualizar, o sistema reinicia em poucos segundos e o seu login é mantido.
              </p>

              {(versaoAtual || versaoNova) && (
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1.5 font-mono text-xs text-muted">
                  {versaoAtual && <span>v{versaoAtual}</span>}
                  {versaoAtual && versaoNova && <span aria-hidden>→</span>}
                  {versaoNova && <span className="font-semibold text-primary">v{versaoNova}</span>}
                </p>
              )}

              {ocupado ? (
                <div
                  role="alert"
                  className="mt-5 flex gap-2.5 rounded-xl border border-accent/30 bg-accent-light px-3.5 py-3 text-left text-xs leading-relaxed text-accent-dark"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <strong>Venda em andamento.</strong> Termine a venda antes de atualizar: o carrinho não é guardado e
                    se perde ao reiniciar.
                  </p>
                </div>
              ) : (
                segundos !== null && (
                  <div className="mt-5 text-left" aria-live="off">
                    <p className="text-xs font-medium text-muted">
                      Reiniciando automaticamente em{" "}
                      <strong className="font-mono tabular-nums text-foreground">{Math.max(0, segundos)} s</strong>
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-[width] duration-1000 ease-linear"
                        style={{ width: `${((SEGUNDOS_AUTOMATICO - Math.max(0, segundos)) / SEGUNDOS_AUTOMATICO) * 100}%` }}
                      />
                    </div>
                  </div>
                )
              )}

              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
                {/* o foco inicial fica em "Mais tarde": o leitor de código de barras dá Enter ao ler um produto
                    e isso NÃO pode recarregar a página no meio de uma venda */}
                <button
                  onClick={onAdiar}
                  autoFocus
                  className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-foreground"
                >
                  Mais tarde
                </button>
                <button
                  onClick={onAtualizar}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/30 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0"
                >
                  <RotateCw className="h-4 w-4" />
                  Atualizar agora
                </button>
              </div>
              <p className="mt-3 text-[11px] text-muted">
                “Mais tarde” (ou Esc) adia este aviso por 30 minutos.
              </p>
            </>
          )}

          {fase === "atualizando" && (
            <div role="status" aria-live="polite">
              <IconeFase tom="primario" brilho>
                <RotateCw className="h-7 w-7 animate-spin [animation-duration:2s]" strokeWidth={1.75} />
              </IconeFase>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-dark">
                {rotulo}
              </p>
              <h2 id="titulo-atualizacao" className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                {titulo}
              </h2>

              <div
                className="mt-6"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(progresso)}
                aria-label="Progresso da atualização"
              >
                <BarraCarregamento progresso={progresso} />
                <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-primary">{Math.floor(progresso)}%</p>
              </div>

              <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
                {passos.map((texto, i) => {
                  const feito = i < passo;
                  const atual = i === passo;
                  return (
                    <li
                      key={texto}
                      className={`flex items-center gap-2.5 text-sm transition-colors ${
                        feito ? "text-foreground" : atual ? "font-medium text-primary" : "text-muted/60"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          feito
                            ? "bg-success text-white"
                            : atual
                              ? "bg-primary-light text-primary"
                              : "border border-border"
                        }`}
                      >
                        {feito ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : atual ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                      </span>
                      {texto}
                    </li>
                  );
                })}
              </ol>

              <OracaoRotativa className="mt-5" />
              <p className="mt-4 text-xs text-muted">{aviso}</p>
            </div>
          )}

          {fase === "erro" && (
            <>
              <IconeFase tom="perigo">
                <AlertTriangle className="h-7 w-7" strokeWidth={1.75} />
              </IconeFase>
              <h2 id="titulo-atualizacao" className="text-xl font-semibold tracking-tight text-foreground">
                Não foi possível atualizar
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {semInternet
                  ? "Este aparelho está sem internet. Reconecte e tente de novo."
                  : "Não conseguimos baixar a nova versão agora. Verifique a conexão e tente de novo."}{" "}
                Nada foi perdido: o sistema continua funcionando na versão atual.
              </p>
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  onClick={onAdiar}
                  className="flex w-full items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted transition hover:bg-background hover:text-foreground"
                >
                  Fechar
                </button>
                <button
                  onClick={onAtualizar}
                  autoFocus
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/30 ring-1 ring-white/10 transition hover:brightness-110"
                >
                  <RotateCw className="h-4 w-4" />
                  Tentar novamente
                </button>
              </div>
            </>
          )}

          {fase === "sucesso" && (
            <>
              <IconeFase tom="sucesso" brilho>
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
              </IconeFase>
              <h2 id="titulo-atualizacao" className="text-xl font-semibold tracking-tight text-foreground">
                Sistema atualizado!
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Você já está usando a versão mais recente do sistema.
              </p>
              {versaoAtual && (
                <p className="mt-3 inline-flex rounded-full bg-primary-soft px-3 py-1 font-mono text-xs text-primary">
                  v{versaoAtual}
                </p>
              )}
              <div aria-hidden className="mt-4 flex items-center justify-center gap-2 text-accent-dark">
                <span className="h-px w-10 bg-accent/60" />
                <CruzIcone className="h-4 w-4" />
                <span className="h-px w-10 bg-accent/60" />
              </div>
              <button
                onClick={onFechar}
                autoFocus
                className="mt-6 w-full rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-3 text-sm font-semibold text-white shadow-md shadow-primary/30 ring-1 ring-white/10 transition hover:brightness-110"
              >
                Continuar
              </button>
            </>
          )}
        </div>

        {fase === "sucesso" && (
          // fecha sozinho: a barra é o cronômetro
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-border/40">
            <span
              className="block h-full origin-left bg-gradient-to-r from-accent to-primary"
              style={{ animation: `aviso-chat-barra ${SEGUNDOS_CONFIRMACAO}s linear forwards` }}
            />
          </span>
        )}
      </div>
    </div>
  );
}

function IconeFase({
  tom,
  brilho = false,
  children,
}: {
  tom: "primario" | "sucesso" | "perigo";
  brilho?: boolean;
  children: React.ReactNode;
}) {
  const cores = {
    primario: "bg-gradient-to-br from-primary to-primary-dark text-white shadow-primary/30",
    sucesso: "bg-gradient-to-br from-success to-success text-white shadow-success/30",
    perigo: "bg-gradient-to-br from-danger to-danger text-white shadow-danger/30",
  }[tom];
  return (
    <span
      className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ring-1 ring-white/30 ${cores} ${
        brilho ? "animate-icon-glow" : ""
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Caixinha fixa que lembra que existe atualização nova (depois de "Mais tarde"). Fica visível em
 * qualquer tela até a pessoa atualizar; clicar nela abre o aviso para atualizar agora.
 */
function CaixaAtualizacaoPendente({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="aviso-chat fixed left-1/2 z-[35] flex -translate-x-1/2 items-center gap-2.5 rounded-full border-2 border-accent bg-accent-light px-4 py-2.5 text-sm font-semibold text-accent-dark shadow-[0_12px_30px_-10px_rgba(15,51,42,0.55)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      aria-label="Há uma atualização nova do sistema. Clique para atualizar."
    >
      <span aria-hidden className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-dark" />
      </span>
      Atualização disponível
      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
        <Download className="h-3.5 w-3.5" />
        Atualizar
      </span>
    </button>
  );
}
