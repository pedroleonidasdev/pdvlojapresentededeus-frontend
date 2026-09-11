package com.pdvgenerico.dto;

import com.pdvgenerico.model.Caixa;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CaixaResponse(
        Long id,
        String usuarioAberturaNome,
        BigDecimal valorInicial,
        LocalDateTime dataAbertura,
        String usuarioFechamentoNome,
        BigDecimal valorFinal,
        LocalDateTime dataFechamento,
        boolean aberto,
        String usuarioReaberturaNome,
        LocalDateTime dataReabertura
) {
    public static CaixaResponse fromEntity(Caixa caixa) {
        return new CaixaResponse(
                caixa.getId(),
                caixa.getUsuarioAbertura() != null ? caixa.getUsuarioAbertura().getNome() : null,
                caixa.getValorInicial(),
                caixa.getDataAbertura(),
                caixa.getUsuarioFechamento() != null ? caixa.getUsuarioFechamento().getNome() : null,
                caixa.getValorFinal(),
                caixa.getDataFechamento(),
                caixa.isAberto(),
                caixa.getUsuarioReabertura() != null ? caixa.getUsuarioReabertura().getNome() : null,
                caixa.getDataReabertura()
        );
    }
}
