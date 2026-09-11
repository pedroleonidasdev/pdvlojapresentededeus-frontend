package com.pdvgenerico.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Representa uma troca de mercadoria: o cliente devolve um ou mais produtos
 * (que voltam para o estoque) e leva um ou mais produtos novos (que saem do
 * estoque). A diferença de valor entre o que foi devolvido e o que foi levado
 * é acertada em dinheiro/pix/cartão na hora (positiva = cliente paga a mais,
 * negativa = loja devolve troco ao cliente).
 *
 * A troca não exige referência a uma venda original — pode ser avulsa,
 * conforme o fluxo relatado pela loja (cliente aparece só com o produto).
 */
@Entity
@Table(name = "trocas")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Troca {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime dataHora = LocalDateTime.now();

    /**
     * Referência opcional à venda original, caso o operador informe.
     * Nula quando a troca é avulsa (sem vínculo com uma venda).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venda_origem_id")
    private Venda vendaOrigem;

    @Column(length = 255)
    private String observacao;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valorDevolvido;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal valorNovo;

    /**
     * valorNovo - valorDevolvido.
     * Positivo: cliente paga a diferença. Negativo: loja devolve troco.
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal diferenca;

    /**
     * Forma de pagamento/estorno da diferença. Nula quando diferenca == 0.
     */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private FormaPagamento formaPagamentoDiferenca;

    @OneToMany(mappedBy = "troca", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ItemTroca> itens = new ArrayList<>();

}
