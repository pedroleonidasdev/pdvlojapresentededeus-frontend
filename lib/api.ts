import axios, { InternalAxiosRequestConfig } from "axios";
import { lerToken, limparSessao } from "./sessao";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api",
});

// Enquanto o servidor troca o token de quem pediu (ex.: "encerrar sessões"), as
// requisições automáticas do app (chat, presença...) que saem com o token velho
// recebem 401. Em vez de derrubar a pessoa, elas esperam a troca e tentam de novo.
let trocaDeTokenPendente: Promise<void> | null = null;

/** Chame antes de uma operação que devolve um token novo; execute a função devolvida ao terminar. */
export function iniciarTrocaDeToken(): () => void {
  let concluir: () => void = () => {};
  trocaDeTokenPendente = new Promise<void>((resolve) => {
    concluir = () => {
      trocaDeTokenPendente = null;
      resolve();
    };
  });
  return concluir;
}

type ConfigRepetivel = InternalAxiosRequestConfig & { _repetida?: boolean };

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = lerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isRequisicaoDeLogin = error.config?.url?.includes("/auth/login");
    if (typeof window !== "undefined" && error.response?.status === 401 && !isRequisicaoDeLogin) {
      const config = error.config as ConfigRepetivel | undefined;

      // o token pode ter sido trocado enquanto esta requisição estava no ar: tenta uma vez com o novo
      if (config && !config._repetida) {
        if (trocaDeTokenPendente) await trocaDeTokenPendente;
        const atual = lerToken();
        if (atual && config.headers.Authorization !== `Bearer ${atual}`) {
          config._repetida = true;
          config.headers.Authorization = `Bearer ${atual}`;
          return api(config);
        }
      }

      limparSessao();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
