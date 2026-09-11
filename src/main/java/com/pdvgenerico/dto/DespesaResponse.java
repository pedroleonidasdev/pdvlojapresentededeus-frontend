package com.pdvgenerico.dto;

import com.pdvgenerico.model.Despesa;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DespesaResponse(
        Long id,
        String tipo,
        String categoria,
        String descricao,
        BigDecimal valor,
        String formaPagamento,
        LocalDateTime dataHora,
        String usuarioNome,
        Long caixaId
) {
    public static DespesaResponse fromEntity(Despesa despesa) {
        return new DespesaResponse(
                despesa.getId(),
                despesa.getTipo().name(),
                despesa.getCategoria(),
                despesa.getDescricao(),
                despesa.getValor(),
                despesa.getFormaPagamento().name(),
                despesa.getDataHora(),
                despesa.getUsuario().getNome(),
                despesa.getCaixa() != null ? despesa.getCaixa().getId() : null
        );
    }
}
