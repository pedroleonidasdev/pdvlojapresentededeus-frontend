"""
Lógica compartilhada de impressão de etiquetas para a impressora térmica
Goldensky 80mm. Não faz leitura de stdin nem HTTP — isso fica por conta de
quem importa este módulo (goldensky-etiquetas.py para uso manual via CLI,
goldensky-agente.py para o serviço HTTP local que o frontend chama).

Para cada etiqueta:
  1. Monta uma página de PDF no tamanho da etiqueta (nome + preço + código de barras) com reportlab.
  2. Rasteriza essa página em PNG a 203 dpi com pdftoppm (poppler-utils).
  3. Converte o raster em comandos RAW ESC/POS (GS v 0) para a Goldensky.

O resultado é enviado para a fila CUPS "Goldensky-80" via `lp -o raw`.

Dependências (Linux Mint / Ubuntu):
  sudo apt install -y cups-client python3 python3-pil python3-reportlab poppler-utils
"""

import io
import os
import subprocess
import tempfile

from PIL import Image
from reportlab.graphics.barcode import code128
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


class EtiquetaError(Exception):
    """Erro esperado (dados inválidos, impressora offline, etc) — mensagem é segura para mostrar ao usuário."""


# --- Configuração física da etiqueta -----------------------------------------
# Valores padrão — usados quando o pedido de impressão não informa dimensão
# própria. O lote original usado neste projeto é de etiquetas adesivas
# pré-cortadas de 60 x 30mm. O frontend permite ajustar isso por lote de
# etiquetas diferente, sem precisar mexer no código.
DEFAULT_LABEL_WIDTH_MM = 60
DEFAULT_LABEL_HEIGHT_MM = 30
DEFAULT_GAP_MM = 4  # espaçamento entre uma etiqueta e a próxima, medido fisicamente

DPI = 203  # resolução nativa da cabeça de impressão da Goldensky 80mm

# limites de sanidade — a cabeça de impressão da Goldensky-80 imprime no
# máximo ~80mm de largura; abaixo disso é só para evitar valor absurdo digitado
LARGURA_MIN_MM, LARGURA_MAX_MM = 20, 80
ALTURA_MIN_MM, ALTURA_MAX_MM = 10, 150
ESPACAMENTO_MIN_MM, ESPACAMENTO_MAX_MM = 0, 30

CUPS_QUEUE = os.environ.get("GOLDENSKY_CUPS_QUEUE", "Goldensky-80")
DRY_RUN = os.environ.get("GOLDENSKY_DRY_RUN") == "1"
DRY_RUN_OUTPUT = os.environ.get("GOLDENSKY_DRY_RUN_OUTPUT", "/tmp/goldensky-etiquetas-teste.bin")

MAX_ETIQUETAS_POR_LOTE = 100


def _validar_dimensoes(largura_mm: float, altura_mm: float, espacamento_mm: float) -> None:
    if not (LARGURA_MIN_MM <= largura_mm <= LARGURA_MAX_MM):
        raise EtiquetaError(
            f"Largura da etiqueta deve estar entre {LARGURA_MIN_MM}mm e {LARGURA_MAX_MM}mm "
            f"(a Goldensky-80 imprime no máximo {LARGURA_MAX_MM}mm de largura)"
        )
    if not (ALTURA_MIN_MM <= altura_mm <= ALTURA_MAX_MM):
        raise EtiquetaError(f"Altura da etiqueta deve estar entre {ALTURA_MIN_MM}mm e {ALTURA_MAX_MM}mm")
    if not (ESPACAMENTO_MIN_MM <= espacamento_mm <= ESPACAMENTO_MAX_MM):
        raise EtiquetaError(f"Espaçamento entre etiquetas deve estar entre {ESPACAMENTO_MIN_MM}mm e {ESPACAMENTO_MAX_MM}mm")


def formatar_preco(valor) -> str:
    try:
        valor = float(valor)
    except (TypeError, ValueError):
        return "R$ 0,00"
    texto = f"{valor:,.2f}"
    # 12,345.67 -> 12.345,67 (formato brasileiro)
    texto = texto.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {texto}"


def montar_pdf_etiqueta(
        nome: str,
        preco_formatado: str,
        codigo_barras: str,
        largura_mm: float = DEFAULT_LABEL_WIDTH_MM,
        altura_mm: float = DEFAULT_LABEL_HEIGHT_MM,
) -> bytes:
    """Gera um PDF de uma página no tamanho exato da etiqueta.
    O layout (posições, fontes, código de barras) foi calibrado para 60x30mm;
    para outras dimensões, tudo escala proporcionalmente a partir desse ponto."""
    buffer = io.BytesIO()
    largura = largura_mm * mm
    altura = altura_mm * mm
    c = canvas.Canvas(buffer, pagesize=(largura, altura))

    escala_v = altura_mm / DEFAULT_LABEL_HEIGHT_MM
    escala_h = largura_mm / DEFAULT_LABEL_WIDTH_MM

    fonte_nome = max(6, round(8 * escala_v))
    fonte_preco = max(7, round(9 * escala_v))
    fonte_codigo = max(5, round(6 * escala_v))

    # Nome do produto — quebra em até 2 linhas se for muito comprido
    c.setFont("Helvetica-Bold", fonte_nome)
    max_chars = max(10, round(30 * escala_h))
    linha1, linha2 = nome[:max_chars], nome[max_chars:max_chars * 2]
    c.drawCentredString(largura / 2, altura - 5 * mm * escala_v, linha1)
    if linha2:
        c.drawCentredString(largura / 2, altura - 8.5 * mm * escala_v, linha2)

    # Preço
    c.setFont("Helvetica-Bold", fonte_preco)
    c.drawCentredString(largura / 2, altura - 12.5 * mm * escala_v, preco_formatado)

    # Código de barras (Code128), centralizado na parte inferior da etiqueta
    barcode = code128.Code128(codigo_barras, barHeight=10 * mm * escala_v, barWidth=0.28 * mm * escala_h)
    barcode_largura = barcode.width
    barcode.drawOn(c, (largura - barcode_largura) / 2, 2.5 * mm * escala_v)

    c.setFont("Helvetica", fonte_codigo)
    c.drawCentredString(largura / 2, 1 * mm * escala_v, codigo_barras)

    c.showPage()
    c.save()
    return buffer.getvalue()


def rasterizar_pdf(pdf_bytes: bytes) -> Image.Image:
    """Converte a página única do PDF em um bitmap 1-bit via pdftoppm (poppler-utils)."""
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = os.path.join(tmp, "etiqueta.pdf")
        png_prefix = os.path.join(tmp, "etiqueta")
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)

        resultado = subprocess.run(
            ["pdftoppm", "-png", "-r", str(DPI), pdf_path, png_prefix],
            capture_output=True,
        )
        if resultado.returncode != 0:
            raise EtiquetaError(
                f"Falha ao rasterizar etiqueta (pdftoppm): {resultado.stderr.decode(errors='ignore')}"
            )

        png_path = f"{png_prefix}-1.png"
        if not os.path.exists(png_path):
            # em algumas versões o pdftoppm não usa o sufixo "-1" para página única
            candidatos = [f for f in os.listdir(tmp) if f.endswith(".png")]
            if not candidatos:
                raise EtiquetaError("pdftoppm não gerou nenhuma imagem para a etiqueta")
            png_path = os.path.join(tmp, candidatos[0])

        imagem = Image.open(png_path).convert("L")
        # limiar simples de preto/branco — nome, preço e código de barras são
        # traços sólidos, então um threshold fixo funciona bem aqui
        imagem = imagem.point(lambda p: 255 if p > 160 else 0, mode="1")
        return imagem


def imagem_para_escpos(imagem: Image.Image) -> bytes:
    """Converte um bitmap 1-bit em comandos RAW ESC/POS (GS v 0 - raster bit image)."""
    largura, altura = imagem.size
    bytes_por_linha = (largura + 7) // 8

    dados = bytearray()
    pixels = imagem.load()
    for y in range(altura):
        linha = bytearray(bytes_por_linha)
        for x in range(largura):
            # 0 = preto no modo "1" do Pillow após o threshold acima
            if pixels[x, y] == 0:
                linha[x // 8] |= 0x80 >> (x % 8)
        dados.extend(linha)

    xl = bytes_por_linha & 0xFF
    xh = (bytes_por_linha >> 8) & 0xFF
    yl = altura & 0xFF
    yh = (altura >> 8) & 0xFF

    comando = bytearray()
    comando += b"\x1d\x76\x30\x00"  # GS v 0 m=0 (modo normal)
    comando += bytes([xl, xh, yl, yh])
    comando += dados
    return bytes(comando)


def montar_stream_escpos(
        etiquetas: list,
        largura_mm: float = DEFAULT_LABEL_WIDTH_MM,
        altura_mm: float = DEFAULT_LABEL_HEIGHT_MM,
        espacamento_mm: float = DEFAULT_GAP_MM,
) -> bytes:
    if not etiquetas:
        raise EtiquetaError("Nenhuma etiqueta informada")
    if len(etiquetas) > MAX_ETIQUETAS_POR_LOTE:
        raise EtiquetaError(f"O lote aceita no máximo {MAX_ETIQUETAS_POR_LOTE} etiquetas por requisição")

    gap_dots = round(espacamento_mm * DPI / 25.4)

    stream = bytearray()
    stream += b"\x1b\x40"  # ESC @ — inicializa a impressora

    for i, item in enumerate(etiquetas):
        nome = str(item.get("nome", "")).strip()
        codigo_barras = str(item.get("codigoBarras", "")).strip()
        preco_formatado = formatar_preco(item.get("precoVenda"))

        if not nome or not codigo_barras:
            raise EtiquetaError(f"Etiqueta {i + 1}: nome e código de barras são obrigatórios")

        pdf_bytes = montar_pdf_etiqueta(nome, preco_formatado, codigo_barras, largura_mm, altura_mm)
        imagem = rasterizar_pdf(pdf_bytes)
        stream += imagem_para_escpos(imagem)

        # avanço de papel entre etiquetas (não aplica depois da última)
        if i < len(etiquetas) - 1:
            linhas_de_avanco = max(1, gap_dots // 24)
            stream += bytes([0x1b, 0x64, linhas_de_avanco])  # ESC d n — feed n linhas

    stream += bytes([0x1b, 0x64, 3])  # folga final antes do corte manual
    return bytes(stream)


def enviar_para_cups(dados: bytes) -> None:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as tmp:
        tmp.write(dados)
        tmp_path = tmp.name

    try:
        resultado = subprocess.run(
            ["lp", "-d", CUPS_QUEUE, "-o", "raw", tmp_path],
            capture_output=True,
        )
        if resultado.returncode != 0:
            raise EtiquetaError(
                f"Falha ao enviar para a fila CUPS '{CUPS_QUEUE}': "
                f"{resultado.stderr.decode(errors='ignore')}"
            )
    finally:
        os.unlink(tmp_path)


def imprimir_etiquetas(
        etiquetas: list,
        largura_mm: float = None,
        altura_mm: float = None,
        espacamento_mm: float = None,
) -> int:
    """Monta e envia o lote de etiquetas. Retorna a quantidade impressa.
    Lança EtiquetaError com uma mensagem segura para mostrar ao usuário."""
    largura_mm = largura_mm if largura_mm is not None else DEFAULT_LABEL_WIDTH_MM
    altura_mm = altura_mm if altura_mm is not None else DEFAULT_LABEL_HEIGHT_MM
    espacamento_mm = espacamento_mm if espacamento_mm is not None else DEFAULT_GAP_MM

    _validar_dimensoes(largura_mm, altura_mm, espacamento_mm)

    dados = montar_stream_escpos(etiquetas, largura_mm, altura_mm, espacamento_mm)

    if DRY_RUN:
        with open(DRY_RUN_OUTPUT, "wb") as f:
            f.write(dados)
        return len(etiquetas)

    enviar_para_cups(dados)
    return len(etiquetas)
