# Modelagem do banco de dados (Supabase / PostgreSQL)

O script para criar tudo está em [`supabase/schema.sql`](../supabase/schema.sql).
A tabela `itens` é genérica: renomeie e adapte as colunas ao tema do projeto.

## Diagrama entidade-relacionamento

```mermaid
erDiagram
    AUTH_USERS ||--|| PERFIS : "tem"
    PERFIS ||--o{ FAVORITOS : "marca"
    PERFIS ||--o{ AVALIACOES : "escreve"
    PERFIS ||--o{ CARRINHO : "possui"
    ITENS ||--o{ FAVORITOS : "aparece em"
    ITENS ||--o{ AVALIACOES : "recebe"
    ITENS ||--o{ CARRINHO : "aparece em"

    AUTH_USERS {
        uuid id PK
        text email
    }
    PERFIS {
        uuid id PK "FK auth.users"
        text nome
        text telefone
        text foto_url
        text cep
        text endereco
        boolean is_admin
        timestamptz criado_em
    }
    ITENS {
        bigint id PK
        text nome
        text descricao
        text categoria
        numeric preco
        text imagem_url
        timestamptz criado_em
    }
    FAVORITOS {
        uuid usuario_id PK "FK perfis"
        bigint item_id PK "FK itens"
        timestamptz criado_em
    }
    AVALIACOES {
        bigint id PK
        uuid usuario_id FK
        bigint item_id FK
        int nota "1 a 5"
        text comentario
        text midia_url
        timestamptz criado_em
    }
    CARRINHO {
        uuid usuario_id PK "FK perfis"
        bigint item_id PK "FK itens"
        int quantidade
    }
```

## Dicionário de dados

| Tabela | Para que serve |
|---|---|
| `auth.users` | Criada pelo próprio Supabase. Guarda e-mail e senha (criptografada). |
| `perfis` | Dados extras do usuário. É criada automaticamente no cadastro. `is_admin` define quem é administrador. |
| `itens` | O que o sistema exibe (produtos, serviços, etc.). As imagens ficam guardadas como URL. |
| `favoritos` | Liga usuário ↔ item (lista de favoritos). |
| `avaliacoes` | Nota, comentário e mídia (URL de imagem/vídeo). Uma avaliação por usuário e item. |
| `carrinho` | Itens que o usuário adicionou e a quantidade de cada um. |

## Segurança (RLS)
- Qualquer pessoa pode **ver** itens e avaliações.
- Cada usuário só **altera** o próprio perfil, favoritos, avaliações e carrinho.
- Só administradores (`is_admin = true`) podem **criar, editar e excluir** itens.
