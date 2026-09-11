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
import java.util.Map;

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
    @PreAuthorize("hasAnyRole('ADMIN', 'CAIXA')")
    public ResponseEntity<Produto> criar(@Valid @RequestBody ProdutoRequest request) {
        return ResponseEntity.ok(produtoService.criar(request));
    }

    // preenche o código de barras de produtos ativos que ainda não têm um — usado
    // uma vez para "colocar em dia" o catálogo, depois disso todo produto novo já
    // recebe o código automaticamente ao ser cadastrado (ver ProdutoService.criar)
    @PostMapping("/gerar-codigos-em-lote")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Integer>> gerarCodigosEmLote() {
        int gerados = produtoService.gerarCodigosEmLote();
        return ResponseEntity.ok(Map.of("produtosAtualizados", gerados));
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
