package com.pdvgenerico.service;

import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.Categoria;
import com.pdvgenerico.repository.CategoriaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;

    public List<Categoria> listarTodas() {
        return categoriaRepository.findAll();
    }

    public Categoria criar(Categoria categoria) {
        String nome = normalizarNome(categoria.getNome());
        categoriaRepository.findByNomeIgnoreCase(nome)
                .ifPresent(existente -> {
                    throw new BusinessException("Já existe uma categoria com este nome");
                });
        categoria.setNome(nome);
        return categoriaRepository.save(categoria);
    }

    public Categoria atualizar(Long id, Categoria dados) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada: id " + id));

        String nome = normalizarNome(dados.getNome());
        categoriaRepository.findByNomeIgnoreCase(nome)
                .filter(existente -> !existente.getId().equals(id))
                .ifPresent(existente -> {
                    throw new BusinessException("Já existe uma categoria com este nome");
                });

        categoria.setNome(nome);
        return categoriaRepository.save(categoria);
    }

    private String normalizarNome(String nome) {
        if (nome == null || nome.isBlank()) {
            throw new BusinessException("O nome da categoria é obrigatório");
        }
        return nome.trim();
    }

    public void excluir(Long id) {
        if (!categoriaRepository.existsById(id)) {
            throw new ResourceNotFoundException("Categoria não encontrada: id " + id);
        }
        categoriaRepository.deleteById(id);
    }
}
