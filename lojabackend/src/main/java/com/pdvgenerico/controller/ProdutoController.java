package com.pdvgenerico.controller;

import com.pdvgenerico.dto.ProdutoRequest;
import com.pdvgenerico.model.Produto;
import com.pdvgenerico.service.ProdutoService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/produtos")
@RequiredArgsConstructor
public class ProdutoController {

    private final ProdutoService produtoService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public List<Produto> listar(@RequestParam(required = false) String nome) {
        if (nome != null && !nome.isBlank()) {
            return produtoService.buscarPorNome(nome);
        }
        return produtoService.listarTodos();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public Produto buscarPorId(@PathVariable Long id) {
        return produtoService.buscarPorId(id);
    }

    @GetMapping("/codigo-barras/{codigo}")
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public Produto buscarPorCodigoBarras(@PathVariable String codigo) {
        return produtoService.buscarPorCodigoBarras(codigo);
    }

    @GetMapping("/estoque-baixo")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Produto> listarEstoqueBaixo() {
        return produtoService.listarComEstoqueBaixo();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Produto> criar(@Valid @RequestBody ProdutoRequest request) {
        return ResponseEntity.ok(produtoService.criar(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Produto atualizar(@PathVariable Long id, @Valid @RequestBody ProdutoRequest request) {
        return produtoService.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        produtoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
