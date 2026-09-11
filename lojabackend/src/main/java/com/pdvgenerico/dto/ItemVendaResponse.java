package com.pdvgenerico.dto;

import com.pdvgenerico.model.ItemVenda;

import java.math.BigDecimal;

public record ItemVendaResponse(
        Long id,
        Long produtoId,
        String produtoNome,
        Integer quantidade,
        BigDecimal precoUnitario,
        BigDecimal subtotal
) {
    public static ItemVendaResponse fromEntity(ItemVenda item) {
        return new ItemVendaResponse(
                item.getId(),
                item.getProduto().getId(),
                item.getProduto().getNome(),
                item.getQuantidade(),
                item.getPrecoUnitario(),
                item.getSubtotal()
        );
    }
}