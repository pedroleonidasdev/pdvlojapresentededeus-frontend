#!/usr/bin/env bash
# Instala o agente de etiquetas Goldensky no computador da loja que tem a
# impressora térmica conectada via USB e a fila CUPS configurada.
#
# Instala:
#   - /usr/local/bin/goldensky_core.py     (lógica compartilhada)
#   - /usr/local/bin/goldensky-etiquetas.py (uso manual via CLI/teste)
#   - /usr/local/bin/goldensky-agente.py    (serviço HTTP em 127.0.0.1:9100,
#                                             chamado direto pelo navegador do PDV)
#   - serviço systemd goldensky-agente, ativo e iniciando com o sistema
#
# Uso (dentro da pasta loja-main, no computador com a impressora):
#   sudo ./scripts/install-goldensky-etiquetas.sh

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Este instalador precisa rodar como root (sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO_BIN="/usr/local/bin"

echo "Verificando dependências..."
FALTANDO=()
command -v python3 >/dev/null 2>&1 || FALTANDO+=("python3")
command -v pdftoppm >/dev/null 2>&1 || FALTANDO+=("poppler-utils")
command -v lp >/dev/null 2>&1 || FALTANDO+=("cups-client")
python3 -c "import PIL" >/dev/null 2>&1 || FALTANDO+=("python3-pil")
python3 -c "import reportlab" >/dev/null 2>&1 || FALTANDO+=("python3-reportlab")

if [ ${#FALTANDO[@]} -gt 0 ]; then
  echo "Faltando: ${FALTANDO[*]}"
  echo "Instale com: sudo apt update && sudo apt install -y cups-client python3 python3-pil python3-reportlab poppler-utils"
  exit 1
fi

echo "Copiando os scripts para ${DESTINO_BIN}..."
cp "${SCRIPT_DIR}/goldensky_core.py" "${DESTINO_BIN}/goldensky_core.py"
cp "${SCRIPT_DIR}/goldensky-etiquetas.py" "${DESTINO_BIN}/goldensky-etiquetas.py"
cp "${SCRIPT_DIR}/goldensky-agente.py" "${DESTINO_BIN}/goldensky-agente.py"
chmod 755 "${DESTINO_BIN}/goldensky-etiquetas.py" "${DESTINO_BIN}/goldensky-agente.py"
chmod 644 "${DESTINO_BIN}/goldensky_core.py"

echo "Criando usuário de sistema goldensky-agente (sem login, sem privilégios)..."
if ! id -u goldensky-agente >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin goldensky-agente
fi
usermod -aG lp,lpadmin goldensky-agente

echo "Instalando o serviço systemd..."
cp "${SCRIPT_DIR}/goldensky-agente.service" /etc/systemd/system/goldensky-agente.service
systemctl daemon-reload
systemctl enable goldensky-agente.service
systemctl restart goldensky-agente.service

sleep 1
if systemctl is-active --quiet goldensky-agente.service; then
  echo "Serviço goldensky-agente rodando em http://127.0.0.1:9100"
else
  echo "AVISO: o serviço não iniciou corretamente. Veja os logs com:"
  echo "  sudo journalctl -u goldensky-agente -n 50"
fi

echo "Verificando fila CUPS Goldensky-80..."
if lpstat -p Goldensky-80 >/dev/null 2>&1; then
  echo "Fila Goldensky-80 encontrada."
else
  echo "AVISO: a fila 'Goldensky-80' ainda não existe ou não está ativa."
  echo "Configure a impressora no CUPS (http://localhost:631) com esse nome exato antes de imprimir."
fi

echo ""
echo "Instalação concluída."
echo "Teste o serviço HTTP com:"
echo "  curl http://127.0.0.1:9100/status"
echo "Teste uma impressão sem gastar etiqueta (dry-run) com o CLI:"
echo "  sudo systemctl stop goldensky-agente"
echo "  GOLDENSKY_DRY_RUN=1 ${DESTINO_BIN}/goldensky-etiquetas.py < ${SCRIPT_DIR}/exemplo-etiquetas.json"
echo "  sudo systemctl start goldensky-agente"
