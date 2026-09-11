package com.pdvgenerico.repository;

import com.pdvgenerico.model.Despesa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface DespesaRepository extends JpaRepository<Despesa, Long> {

    List<Despesa> findByDataHoraBetweenOrderByDataHoraDesc(LocalDateTime inicio, LocalDateTime fim);

    List<Despesa> findAllByOrderByDataHoraDesc();

    // usado na conferência de caixa (Relatórios): sangria/suprimento/despesa em
    // dinheiro lançados durante o expediente de um caixa específico
    List<Despesa> findByCaixaIdOrderByDataHoraDesc(Long caixaId);
}
