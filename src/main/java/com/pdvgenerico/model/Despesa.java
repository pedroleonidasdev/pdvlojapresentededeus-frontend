package com.pdvgenerico.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Registro de saída (DESPESA/SANGRIA) ou entrada (SUPRIMENTO) financeira fora
 * da venda normal. Serve tanto para o controle de custos do negócio (aluguel,
 * fornecedor, energia...) quanto para o que o caixa fisicamente ganhou/perdeu
 * em dinheiro durante o expediente (sangria/suprimento).
 *
 * Quando a saída/entrada é em DINHEIRO e existe caixa aberto no momento do
 * lançamento, ela é vinculada a esse caixa (campo `caixa`) — é esse vínculo
 * que permite ajustar a conferência de "esperado na gaveta" em Relatórios.
 * Despesas pagas em PIX/cartão não mexem na gaveta, então não são vinculadas.
 */
@Entity
@Table(name = "despesas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Despesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoDespesa tipo;

    @Column(length = 60)
    private String categoria;

    @Column(nullable = false, length = 255)
    private String descricao;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FormaPagamento formaPagamento;

    @Column(nullable = false)
    private LocalDateTime dataHora;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    // caixa aberto no momento do lançamento, só quando formaPagamento = DINHEIRO.
    // Nulo se pago em PIX/cartão, ou se não havia caixa aberto (só DESPESA permite isso).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caixa_id")
    private Caixa caixa;
}
