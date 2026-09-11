package com.pdvgenerico.repository;

import com.pdvgenerico.model.Produto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProdutoRepository extends JpaRepository<Produto, Long> {

    Optional<Produto> findByCodigoBarras(String codigoBarras);

    List<Produto> findByNomeContainingIgnoreCaseAndAtivoTrue(String nome);

    List<Produto> findByAtivoTrue();

    List<Produto> findByQuantidadeEstoqueLessThanEqualAndAtivoTrue(Integer estoqueMinimo);
}
