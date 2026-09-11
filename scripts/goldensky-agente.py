#!/usr/bin/env python3
"""
Agente HTTP local para a impressora térmica Goldensky 80mm.

Roda como serviço no computador da loja que tem a impressora conectada via USB.
O navegador do PDV (rodando NESSE MESMO computador) chama esse agente
diretamente em http://localhost:9100/imprimir-etiquetas — sem passar pelo
backend na nuvem, que não tem como acessar uma impressora USB local.

Escuta só em 127.0.0.1 (loopback): não fica exposto para o resto da rede.
Navegadores tratam http://localhost como "contexto seguro" mesmo quando a
página em si está em HTTPS, então dá para chamar esse agente a partir do
site em produção (Vercel) sem erro de "conteúdo misto".

Uso:
  python3 goldensky-agente.py
  (ou, em produção, via o serviço systemd — veja install-goldensky-etiquetas.sh)

Endpoints:
  POST /imprimir-etiquetas   body: {"etiquetas": [{"nome","precoVenda","codigoBarras"}],
                                     "largura": 60, "altura": 30, "espacamento": 4}
                              largura/altura/espacamento em mm são opcionais — se
                              omitidos, usa os padrões calibrados (60x30mm, 4mm).
  GET  /status                healthcheck simples

Dependências (Linux Mint / Ubuntu):
  sudo apt install -y cups-client python3 python3-pil python3-reportlab poppler-utils
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from goldensky_core import EtiquetaError, imprimir_etiquetas

HOST = os.environ.get("GOLDENSKY_AGENTE_HOST", "127.0.0.1")
PORT = int(os.environ.get("GOLDENSKY_AGENTE_PORT", "9100"))

# Origens autorizadas a chamar este agente (CORS). Ajuste se o domínio do
# frontend mudar, ou defina GOLDENSKY_AGENTE_ORIGENS com uma lista separada
# por vírgula para sobrescrever.
ORIGENS_PADRAO = "https://presentededeus.vercel.app,http://localhost:3000"
ORIGENS_PERMITIDAS = os.environ.get("GOLDENSKY_AGENTE_ORIGENS", ORIGENS_PADRAO).split(",")


class Handler(BaseHTTPRequestHandler):
    def _origem_permitida(self):
        origem = self.headers.get("Origin", "")
        return origem if origem in ORIGENS_PERMITIDAS else None

    def _cabecalhos_cors(self):
        origem = self._origem_permitida()
        if origem:
            self.send_header("Access-Control-Allow-Origin", origem)
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _responder_json(self, status: int, corpo: dict):
        payload = json.dumps(corpo).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cabecalhos_cors()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cabecalhos_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            self._responder_json(200, {"status": "ok"})
        else:
            self._responder_json(404, {"mensagem": "Rota não encontrada"})

    def do_POST(self):
        if self.path != "/imprimir-etiquetas":
            self._responder_json(404, {"mensagem": "Rota não encontrada"})
            return

        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            corpo_bruto = self.rfile.read(tamanho) if tamanho > 0 else b""
            payload = json.loads(corpo_bruto or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._responder_json(400, {"mensagem": "JSON inválido"})
            return

        etiquetas = payload.get("etiquetas", [])

        def _numero_opcional(chave):
            valor = payload.get(chave)
            if valor in (None, ""):
                return None
            try:
                return float(valor)
            except (TypeError, ValueError):
                raise ValueError(chave)

        try:
            largura_mm = _numero_opcional("largura")
            altura_mm = _numero_opcional("altura")
            espacamento_mm = _numero_opcional("espacamento")
        except ValueError as campo:
            self._responder_json(400, {"mensagem": f"Valor inválido para '{campo}'"})
            return

        try:
            quantidade = imprimir_etiquetas(
                etiquetas,
                largura_mm=largura_mm,
                altura_mm=altura_mm,
                espacamento_mm=espacamento_mm,
            )
        except EtiquetaError as e:
            self._responder_json(422, {"mensagem": str(e)})
            return
        except Exception as e:  # falha inesperada — não vaza detalhe interno pro navegador
            sys.stderr.write(f"Erro inesperado ao imprimir etiquetas: {e}\n")
            self._responder_json(500, {"mensagem": "Erro inesperado ao acionar a impressora"})
            return

        self._responder_json(200, {"mensagem": f"{quantidade} etiqueta(s) enviada(s) para a Goldensky."})

    def log_message(self, format, *args):
        sys.stderr.write(f"[goldensky-agente] {self.address_string()} - {format % args}\n")


def main():
    servidor = ThreadingHTTPServer((HOST, PORT), Handler)
    sys.stdout.write(f"Agente Goldensky ouvindo em http://{HOST}:{PORT}\n")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        servidor.shutdown()


if __name__ == "__main__":
    main()
