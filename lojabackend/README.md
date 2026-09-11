# PDV Genérico - Backend

Sistema de PDV e gerenciamento de estoque genérico (Spring Boot 3 + Java 21 + MySQL).

## Pré-requisitos

- Java 21 (JDK)
- Maven (ou use o `mvnw` se preferir configurar o wrapper)
- MySQL Server rodando localmente

## Configuração

Edite `src/main/resources/application.properties` se necessário:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/pdv_generico?useSSL=false&serverTimezone=America/Sao_Paulo&createDatabaseIfNotExist=true
spring.datasource.username=root
spring.datasource.password=root
```

O banco `pdv_generico` é criado automaticamente na primeira conexão (`createDatabaseIfNotExist=true`), e as tabelas são geradas pelo Hibernate (`ddl-auto=update`).

## Como rodar

```bash
mvn spring-boot:run
```

A API sobe em `http://localhost:8080`.

## Usuários iniciais

Na primeira execução, o sistema cria automaticamente dois usuários:

- **admin** / senha `admin123` — perfil ADMIN (acesso total)
- **caixa** / senha `caixa123` — perfil CAIXA (venda e consulta de estoque)

> Troque essas senhas em produção pela tela de Usuários (só admin acessa).

## Principais endpoints

| Método | Rota | Quem acessa |
|---|---|---|
| POST | `/api/auth/login` | Público |
| GET/POST/PUT/DELETE | `/api/produtos` | ADMIN (escrita) / ADMIN+CAIXA (leitura) |
| GET/POST/PUT/DELETE | `/api/categorias` | ADMIN (escrita) / ADMIN+CAIXA (leitura) |
| POST/GET | `/api/vendas` | ADMIN+CAIXA |
| GET | `/api/relatorios/vendas?inicio=...&fim=...` | ADMIN |
| GET/POST/PUT/DELETE | `/api/usuarios` | ADMIN |

Autenticação via header `Authorization: Bearer <token>` obtido no login.
