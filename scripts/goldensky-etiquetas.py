#!/usr/bin/env python3
"""
Uso manual/teste do agente de etiquetas Goldensky, via linha de comando.

Lê um JSON pela stdin no formato:
  {"etiquetas": [{"nome": "...", "precoVenda": 12.5, "codigoBarras": "789..."}],
   "largura": 60, "altura": 30, "espacamento": 4}
  largura/altura/espacamento (em mm) são opcionais — se omitidos, usa os
  padrões calibrados (60x30mm, 4mm de espaçamento).

Modo de teste (sem impressora):
  GOLDENSKY_DRY_RUN=1 ./goldensky-etiquetas.py < scripts/exemplo-etiquetas.json
  Gera /tmp/goldensky-etiquetas-teste.bin com os bytes RAW e não aciona o CUPS.

Para o uso em produção (acionado pelo navegador do PDV), veja goldensky-agente.py,
que expõe essa mesma lógica como um serviço HTTP local.

Dependências (Linux Mint / Ubuntu):
  sudo apt install -y cups-client python3 python3-pil python3-reportlab poppler-utils
"""

import json
import sys

from goldensky_core import EtiquetaError, imprimir_etiquetas, DRY_RUN, DRY_RUN_OUTPUT, CUPS_QUEUE


def erro(mensagem: str, codigo: int = 1) -> None:
    sys.stderr.write(mensagem.strip() + "\n")
    sys.exit(codigo)


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        erro("JSON inválido recebido na entrada padrão")
        return

    etiquetas = payload.get("etiquetas", [])

    try:
        quantidade = imprimir_etiquetas(
            etiquetas,
            largura_mm=payload.get("largura"),
            altura_mm=payload.get("altura"),
            espacamento_mm=payload.get("espacamento"),
        )
    except EtiquetaError as e:
        erro(str(e))
        return

    if DRY_RUN:
        sys.stdout.write(f"[dry-run] {quantidade} etiqueta(s) geradas em {DRY_RUN_OUTPUT}\n")
    else:
        sys.stdout.write(f"{quantidade} etiqueta(s) enviada(s) para {CUPS_QUEUE}\n")


if __name__ == "__main__":
    main()
