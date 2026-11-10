# FATO REAL

> **Informação que importa.** Pesquise, descubra e participe.

Rede social de informação cívica: pesquise políticos com dados oficiais, pergunte ao **FatoBot**
(IA que responde só com base em fontes e mostra as referências) e participe de comunidades.

Projeto Integrador — Senac. Entrega final: **1º de dezembro de 2026**.

## Estrutura do repositório

| Pasta        | O que tem                                   | Responsáveis       |
|--------------|---------------------------------------------|--------------------|
| `frontend/`  | Telas em Angular                            | Luiz               |
| `backend/`   | API em Node (Express) e FatoBot             | João Vítor, Gustavo|
| `database/`  | Scripts SQL e políticas do Supabase         | Pablo, Guilherme   |
| `docs/`      | Documentação do projeto                     | Arlley, Raquel     |

## Stack

- **Angular** — telas
- **Node + Express** — API e FatoBot
- **Supabase** — banco de dados e login
- **Vercel** — hospedagem

## MVP

1. Busca e perfil de políticos (10 a 20 deputados, dados abertos da Câmara, com fonte e data).
2. FatoBot: responde só com base nas fontes, mostra referências e diz quando não encontrou evidência.
3. Cadastro, login e perfil de usuário (mínimo de dados — LGPD).
4. Comunidades: criar, entrar, mural, comentários, curtidas e denúncias.

## Regras do repositório

- **Nunca** coloque chaves de API, senhas ou tokens no código. Use o arquivo `.env`
  (que não vai para o GitHub). O modelo das variáveis fica em `.env.example`.
- Chaves secretas (Supabase `service_role`, IA etc.) ficam **só no backend**, nunca no Angular.
- Trabalhe em uma branch sua (ex.: `feat/busca-deputados`) e abra um Pull Request para a `main`.
- O andamento oficial está no Trello: quadro "PI Senac - FATO REAL".

## Identidade visual

Verde Real `#0B3D2E` · Dourado `#D4AF37` · Grafite `#1A1A1A`
Fontes: Montserrat (títulos) e Open Sans (textos).
