package com.pdvgenerico.repository;

import com.pdvgenerico.model.Caixa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface CaixaRepository extends JpaRepository<Caixa, Long> {

    Optional<Caixa> findByAbertoTrue();

    List<Caixa> findByDataAberturaBetweenOrderByDataAberturaDesc(LocalDateTime inicio, LocalDateTime fim);

    // usado para restringir a reabertura ao caixa fechado mais recente, evitando
    // que se reabra um caixa antigo do histórico "fora de ordem"
    Optional<Caixa> findFirstByAbertoFalseOrderByDataFechamentoDesc();
}
