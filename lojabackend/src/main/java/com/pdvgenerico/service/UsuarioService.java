package com.pdvgenerico.service;

import com.pdvgenerico.dto.UsuarioRequest;
import com.pdvgenerico.exception.BusinessException;
import com.pdvgenerico.exception.ResourceNotFoundException;
import com.pdvgenerico.model.Usuario;
import com.pdvgenerico.repository.UsuarioRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public List<Usuario> listarTodos() {
        return usuarioRepository.findAll();
    }

    public Usuario criar(UsuarioRequest request) {
        if (usuarioRepository.findByLogin(request.login()).isPresent()) {
            throw new BusinessException("Já existe um usuário com este login");
        }
        if (request.senha() == null || request.senha().isBlank()) {
            throw new BusinessException("Senha é obrigatória para novo usuário");
        }

        Usuario usuario = Usuario.builder()
                .login(request.login())
                .senha(passwordEncoder.encode(request.senha()))
                .nome(request.nome())
                .perfil(request.perfil())
                .ativo(request.ativo() == null || request.ativo())
                .build();

        return usuarioRepository.save(usuario);
    }

    public Usuario atualizar(Long id, UsuarioRequest request) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: id " + id));

        usuario.setNome(request.nome());
        usuario.setPerfil(request.perfil());
        if (request.ativo() != null) {
            usuario.setAtivo(request.ativo());
        }
        if (request.senha() != null && !request.senha().isBlank()) {
            usuario.setSenha(passwordEncoder.encode(request.senha()));
        }

        return usuarioRepository.save(usuario);
    }

    public void excluir(Long id) {
        Usuario usuario = usuarioRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: id " + id));
        usuario.setAtivo(false);
        usuarioRepository.save(usuario);
    }
}
