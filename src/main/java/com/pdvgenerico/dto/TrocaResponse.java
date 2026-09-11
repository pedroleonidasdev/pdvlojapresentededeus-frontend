package com.pdvgenerico.dto;

import com.pdvgenerico.model.TipoItemTroca;
import com.pdvgenerico.model.Troca;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record TrocaResponse(
        Long id,
        String usuarioNome,
        LocalDateTime dataHora,
        Long vendaOrigemId,
        String observacao,
        BigDecimal valorDevolvido,
        BigDecimal valorNovo,
        BigDecimal diferenca,
        String formaPagamentoDiferenca,
        List<ItemTrocaResponse> itensDevolvidos,
        List<ItemTrocaResponse> itensNovos
) {
    public static TrocaResponse fromEntity(Troca troca) {
        return new TrocaResponse(
                troca.getId(),
                troca.getUsuario().getNome(),
                troca.getDataHora(),
                troca.getVendaOrigem() != null ? troca.getVendaOrigem().getId() : null,
                troca.getObservacao(),
                troca.getValorDevolvido(),
                troca.getValorNovo(),
                troca.getDiferenca(),
                troca.getFormaPagamentoDiferenca() != null ? troca.getFormaPagamentoDiferenca().name() : null,
                troca.getItens().stream()
                        .filter(i -> i.getTipo() == TipoItemTroca.DEVOLVIDO)
                        .map(ItemTrocaResponse::fromEntity)
                        .toList(),
                troca.getItens().stream()
                        .filter(i -> i.getTipo() == TipoItemTroca.NOVO)
                        .map(ItemTrocaResponse::fromEntity)
                        .toList()
        );
    }
}
