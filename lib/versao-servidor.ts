import api from "@/lib/api";

/**
 * Versão do servidor (backend) que este navegador viu por último, guardada para comparar na próxima
 * visita: se mudou, o servidor foi atualizado enquanto a pessoa estava fora e o sistema se atualiza
 * antes de liberar a operação (ver GuardaAtualizacao).
 */
const CHAVE_SERVIDOR_VISTO = "pdv_servidor_visto";
// avisa (só nesta aba) que acabou de haver uma atualização e a confirmação "Sistema atualizado!" deve aparecer
const CHAVE_MOSTRAR_ATUALIZADO = "pdv_mostrar_atualizado";
// evita laço de reinícios se a versão publicada demorar a chegar a este navegador
const CHAVE_REINICIO_TENTADO = "pdv_gate_reinicio";

export interface InfoServidor {
  versao: string;
  iniciadoEm: string;
}

/** Pergunta ao servidor qual versão está rodando. Devolve null se não respondeu (fora do ar, lento ou rota inexistente). */
export async function buscarVersaoServidor(timeoutMs = 6000): Promise<InfoServidor | null> {
  try {
    const resp = await api.get<InfoServidor>("/versao", { timeout: timeoutMs, validateStatus: () => true });
    if (resp.status === 200 && resp.data && typeof resp.data.iniciadoEm === "string") {
      return { versao: resp.data.versao ?? "", iniciadoEm: resp.data.iniciadoEm };
    }
  } catch {
    // sem resposta
  }
  return null;
}

function ler(armazenamento: () => Storage, chave: string): string | null {
  try {
    return armazenamento().getItem(chave);
  } catch {
    return null;
  }
}

function gravar(armazenamento: () => Storage, chave: string, valor: string | null): void {
  try {
    if (valor === null) armazenamento().removeItem(chave);
    else armazenamento().setItem(chave, valor);
  } catch {
    // armazenamento bloqueado: segue sem guardar
  }
}

export const lerServidorVisto = () => ler(() => localStorage, CHAVE_SERVIDOR_VISTO);
export const gravarServidorVisto = (versao: string) => gravar(() => localStorage, CHAVE_SERVIDOR_VISTO, versao);

export const lerMostrarAtualizado = () => ler(() => sessionStorage, CHAVE_MOSTRAR_ATUALIZADO) === "1";
export const marcarMostrarAtualizado = () => gravar(() => sessionStorage, CHAVE_MOSTRAR_ATUALIZADO, "1");
export const limparMostrarAtualizado = () => gravar(() => sessionStorage, CHAVE_MOSTRAR_ATUALIZADO, null);

export const lerReinicioTentado = () => ler(() => sessionStorage, CHAVE_REINICIO_TENTADO);
export const marcarReinicioTentado = (versao: string) => gravar(() => sessionStorage, CHAVE_REINICIO_TENTADO, versao);

/** Baixa de verdade os arquivos (JS/CSS) da versão publicada, para a página já abrir com tudo no cache. */
export async function baixarArquivosEstaticos(aoProgredir: (fracao: number) => void): Promise<void> {
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
        aoProgredir(feitos / urls.length);
      })
    );
  } catch {
    // sem acesso à página agora: segue para a próxima etapa
  }
}
