package com.pdvgenerico.service;

import com.pdvgenerico.dto.ProdutoRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.Categoria;
import com.pdvgenerico.model.Produto;
import com.pdvgenerico.repository.CategoriaRepository;
import com.pdvgenerico.repository.ProdutoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final CategoriaRepository categoriaRepository;

    public List<Produto> listarTodos() {
        return produtoRepository.findByAtivoTrue();
    }

    public Produto buscarPorId(Long id) {
        return produtoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado: id " + id));
    }

    public List<Produto> buscarPorNome(String nome) {
        return produtoRepository.findByNomeContainingIgnoreCaseAndAtivoTrue(nome);
    }

    public Produto buscarPorCodigoBarras(String codigoBarras) {
        return produtoRepository.findByCodigoBarras(codigoBarras)
                .orElseThrow(() -> new ResourceNotFoundException("Produto não encontrado para o código: " + codigoBarras));
    }

    public List<Produto> listarComEstoqueBaixo() {
        return produtoRepository.findByAtivoTrue().stream()
                .filter(p -> p.getEstoqueMinimo() != null && p.getQuantidadeEstoque() <= p.getEstoqueMinimo())
                .toList();
    }

    @Transactional
    public Produto criar(ProdutoRequest request) {
        if (request.codigoBarras() != null && !request.codigoBarras().isBlank()
                && produtoRepository.findByCodigoBarras(request.codigoBarras()).isPresent()) {
            throw new BusinessException("Já existe um produto com este código de barras");
        }

        Categoria categoria = resolverCategoria(request.categoriaId());

        Produto produto = Produto.builder()
                .nome(request.nome())
                .codigoBarras(request.codigoBarras())
                .categoria(categoria)
                .precoVenda(request.precoVenda())
                .precoCusto(request.precoCusto())
                .quantidadeEstoque(request.quantidadeEstoque())
                .estoqueMinimo(request.estoqueMinimo())
                .ativo(true)
                .build();

        return produtoRepository.save(produto);
    }

    @Transactional
    public Produto atualizar(Long id, ProdutoRequest request) {
        Produto produto = buscarPorId(id);
        Categoria categoria = resolverCategoria(request.categoriaId());

        produto.setNome(request.nome());
        produto.setCodigoBarras(request.codigoBarras());
        produto.setCategoria(categoria);
        produto.setPrecoVenda(request.precoVenda());
        produto.setPrecoCusto(request.precoCusto());
        produto.setQuantidadeEstoque(request.quantidadeEstoque());
        produto.setEstoqueMinimo(request.estoqueMinimo());

        return produtoRepository.save(produto);
    }

    @Transactional
    public void excluir(Long id) {
        Produto produto = buscarPorId(id);
        produto.setAtivo(false);
        produtoRepository.save(produto);
    }

    private Categoria resolverCategoria(Long categoriaId) {
        if (categoriaId == null) {
            return null;
        }
        return categoriaRepository.findById(categoriaId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada: id " + categoriaId));
    }
}
