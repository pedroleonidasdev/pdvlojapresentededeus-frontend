package com.pdvgenerico.repository;

import com.pdvgenerico.model.Troca;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface TrocaRepository extends JpaRepository<Troca, Long> {

    List<Troca> findByDataHoraBetweenOrderByDataHoraDesc(LocalDateTime inicio, LocalDateTime fim);

    List<Troca> findAllByOrderByDataHoraDesc();
}
