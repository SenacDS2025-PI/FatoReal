# Contexto para o Claude (retomar o trabalho)

> Em uma conversa nova, peça: **"leia o arquivo docs/contexto-claude.md do repositório"**.
> Atualizado em 09/11/2026.

## O projeto
- **Fato Real**: rede social de informação cívica (PI do Senac). O que vale é o **Trello** "PI Senac - FATO REAL", que é o que o professor pediu.
- **Tecnologias:** Angular (pasta `frontend/`), Supabase (banco e login), API em Node (FatoBot com Gemini, verificação e Câmara, pasta `backend/`), hospedagem na Vercel.
- **Entrega final:** 1º/12/2026. Código congelado em 28/11.
- **Quem pede as mudanças:** Luiz Gustavo (GitHub `Liipez`), responsável pelo **front**. Coordenador: Guilherme. Vice: Pablo.

## O que já está pronto no front
- **Visual igual à apresentação:**
  - Barra superior com logo, busca, sino de notificações (abre painel), engrenagem (Configurações) e foto com menu (perfil, moderação, modo escuro, sair).
  - Menu lateral: Início, Notícias, Candidatos, Base da Política, Comunidades, IA FatoBot, Verificar Informação, Mensagens, Meu Perfil e Moderação (só moderador). Embaixo, os cards "Juntos por um Brasil" e "Seu progresso".
  - Celular: abas no topo, barra inferior com o robô no meio e botão "+".
- **Tema claro e escuro** mudando a tela inteira (tokens em `frontend/src/styles.scss`).
- **Imagens em SVG** (nítidas) em `frontend/public/img/`: Congresso, bandeira, multidão, ícones das comunidades e robô FatoBot.
- **Telas:**
  - Conta: entrar, cadastrar, recuperar e nova senha, perfil.
  - Conteúdo: início com feed, políticos (busca e perfil pela API da Câmara), FatoBot, comunidades (lista, criar, mural com curtir, comentar, compartilhar e denunciar).
  - Gestão: moderação.
  - Novas áreas: notícias (canais oficiais), base da política, verificar informação, mensagens, notificações, configurações.
  - Institucionais: sobre, regras, termos, privacidade e contato.
- **Modo demonstração:** sem Supabase configurado, tudo funciona com dados no navegador (localStorage).
- **Banco:** `supabase/schema.sql` com tabelas e RLS (perfis, políticos, comunidades, membros, publicações, comentários, curtidas, denúncias, mensagens). Testado em PostgreSQL.

## GitHub
- Repositório: `matheussss237/FatoReal`. Branch de trabalho: `claude/zen-volta-cccllf`.
- Pull Requests #2 e #3 já foram juntados. O **#4** (ícones no topo, tema completo e imagens SVG) estava aberto em 09/11.
- Regra do time: ninguém mexe direto na `main`; tudo vai por Pull Request.

## Como rodar no computador (Windows)
1. Node.js já instalado (v26). O PowerShell precisou de `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
2. `cd frontend`
3. `npm install` (só na primeira vez)
4. `npm start`
5. Abrir http://localhost:4200

Não usar o Live Server ("Go Live"): ele não monta o Angular.

## Link de teste
https://claude.ai/artifact/J1BvQb1JBHBEA62uR5vm2x (privado, versão com `#` nas rotas, gerada com `HASH_ROUTING=true`).

## Pendências (atualizado em 11/11/2026)
- Branch de trabalho do Matheus: `matheus` (repositório `SenacDS2025-PI/FatoReal`), com front do Luiz e backend do João juntos.
- Rodar de novo o `supabase/schema.sql` no projeto Supabase (acrescenta a coluna `bio` e as comunidades temáticas).
- Colocar as chaves: `SUPABASE_URL` e `SUPABASE_ANON_KEY` no front; `GEMINI_API_KEY` e `CORS_ORIGIN` no backend (`.env` local e Vercel).
- Deploy na Vercel: dois projetos (Root Directory `frontend` e `backend`); no front, `API_URL` = URL do backend + `/api`.
- Trocar o e-mail de contato provisório em `frontend/src/app/pages/institucional/institucional.ts`.
- Abrir o Pull Request da `matheus` para a `main`.
