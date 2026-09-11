package com.pdvgenerico.repository;

import com.pdvgenerico.model.Produto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProdutoRepository extends JpaRepository<Produto, Long> {

    // "left join fetch" traz a categoria já na mesma consulta (evita N+1 e evita
    // que a categoria venha null na resposta por causa do lazy loading do Hibernate)
    @Query("SELECT p FROM Produto p LEFT JOIN FETCH p.categoria WHERE p.id = :id")
    Optional<Produto> findById(@Param("id") Long id);

    @Query("SELECT p FROM Produto p LEFT JOIN FETCH p.categoria WHERE p.codigoBarras = :codigoBarras")
    Optional<Produto> findByCodigoBarras(@Param("codigoBarras") String codigoBarras);

    @Query("SELECT p FROM Produto p LEFT JOIN FETCH p.categoria " +
            "WHERE p.ativo = true AND LOWER(p.nome) LIKE LOWER(CONCAT('%', :nome, '%'))")
    List<Produto> findByNomeContainingIgnoreCaseAndAtivoTrue(@Param("nome") String nome);

    @Query("SELECT p FROM Produto p LEFT JOIN FETCH p.categoria WHERE p.ativo = true")
    List<Produto> findByAtivoTrue();

    @Query("SELECT p FROM Produto p LEFT JOIN FETCH p.categoria " +
            "WHERE p.quantidadeEstoque <= :estoqueMinimo AND p.ativo = true")
    List<Produto> findByQuantidadeEstoqueLessThanEqualAndAtivoTrue(@Param("estoqueMinimo") Integer estoqueMinimo);
}
