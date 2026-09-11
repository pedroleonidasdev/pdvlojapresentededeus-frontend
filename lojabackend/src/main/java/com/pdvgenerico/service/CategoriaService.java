package com.pdvgenerico.service;

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
        return categoriaRepository.save(categoria);
    }

    public Categoria atualizar(Long id, Categoria dados) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada: id " + id));
        categoria.setNome(dados.getNome());
        return categoriaRepository.save(categoria);
    }

    public void excluir(Long id) {
        if (!categoriaRepository.existsById(id)) {
            throw new ResourceNotFoundException("Categoria não encontrada: id " + id);
        }
        categoriaRepository.deleteById(id);
    }
}
