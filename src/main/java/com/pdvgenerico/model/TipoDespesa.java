package com.pdvgenerico.model;

public enum TipoDespesa {
    /** Custo do negócio (aluguel, fornecedor, energia, internet, salário, etc). Pode ser pago em qualquer forma de pagamento. */
    DESPESA,
    /** Retirada de dinheiro do caixa durante o expediente (ex: levar pro banco, pagar algo em dinheiro fora do sistema). Sempre em espécie. */
    SANGRIA,
    /** Reforço de troco: dinheiro colocado no caixa fora da abertura (não confundir com o valor inicial de abertura). Sempre em espécie. */
    SUPRIMENTO
}
