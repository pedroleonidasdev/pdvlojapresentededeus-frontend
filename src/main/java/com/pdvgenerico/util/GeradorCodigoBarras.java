package com.pdvgenerico.util;

/**
 * Gera códigos de barras EAN-13 para uso interno da loja.
 * <p>
 * Usa o prefixo "20", reservado pelo GS1 para circulação restrita / uso interno
 * (não é um código global único como os de produtos industrializados — mas é
 * perfeitamente válido para etiquetas impressas e lidas só dentro da própria loja,
 * que é o caso aqui).
 * <p>
 * Formato: "20" + id do produto com 10 dígitos (zero à esquerda) + 1 dígito verificador
 * (checksum padrão EAN-13) = 13 dígitos no total.
 */
public final class GeradorCodigoBarras {

    private static final String PREFIXO_USO_INTERNO = "20";

    private GeradorCodigoBarras() {
    }

    public static String gerarEan13(long produtoId) {
        String corpo = PREFIXO_USO_INTERNO + String.format("%010d", produtoId);
        return corpo + calcularDigitoVerificador(corpo);
    }

    private static int calcularDigitoVerificador(String doze) {
        int soma = 0;
        for (int i = 0; i < 12; i++) {
            int digito = doze.charAt(i) - '0';
            soma += (i % 2 == 0) ? digito : digito * 3;
        }
        return (10 - (soma % 10)) % 10;
    }
}
