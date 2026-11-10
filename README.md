# FatoReal: Projeto Integrador (PI)

> **Time:** claudinho · **Tema:** rede social de informação cívica: busca de políticos com fontes oficiais, FatoBot (IA com referências) e comunidades no estilo Orkut
> **Quadro oficial do andamento:** Trello "PI Senac - FATO REAL" · **Entrega final:** 1º/12/2026
> **Site hospedado:** _(link aqui quando estiver no ar)_

Repositório único do time. **Todos os 9 integrantes podem adicionar, editar e remover qualquer arquivo.**
Antes de mexer pela primeira vez, leia o **[Guia de Git da equipe](CONTRIBUTING.md)**.

---

## 👥 Equipe

| Integrante | Área (sugestão, pode trocar) |
|---|---|
| Matheus | Coordenação, revisão dos Pull Requests, hospedagem |
| Gustavo | Login, cadastro, verificar conta, recuperar senha (Supabase Auth) |
| Arley | Banco de dados Supabase (tabelas e CRUD) |
| João | Tela de administrador (CRUD) + dashboard |
| Pablo | Listagem de itens, filtro de busca em tempo real, carrinho, pop-up |
| Luiz | Editar perfil, favoritos, avaliações com comentários e mídia |
| Guilherme | CEP/endereço automático + preço, WhatsApp com formulário, vídeo trailer |
| Raquel | Design, responsividade, acessibilidade, tela de carregamento, slides no Canva |
| Kelly | Documentação (requisitos, casos de uso, modelagem, manual, relatório) |

Os detalhes de cada área estão em [docs/equipe-e-cronograma.md](docs/equipe-e-cronograma.md).

## 📅 Cronograma

| Data | Evento | Status |
|---|---|---|
| 03/11/2026 | 1ª apresentação | ✅ Concluída |
| 10/11/2026 | 2ª apresentação | ⏳ |
| 17/11/2026 | 3ª apresentação | ⏳ |
| 24/11/2026 | 4ª e última apresentação | ⏳ |
| **25/11/2026** | **Ensaio do PI + entrega da documentação (Google Docs/Drive)** | ⏳ |
| **26/11/2026** | **Apresentação do PI** (esporte fino ou casual) | ⏳ |

## 📁 Estrutura do repositório

```
├── frontend/          → app Angular (telas, serviços, estilos) → veja frontend/README.md
├── supabase/          → schema.sql: tabelas e regras de segurança (RLS)
├── docs/              → documentação (requisitos, casos de uso, banco, manual, relatório)
├── apresentacao/      → roteiro dos slides no Canva e do vídeo trailer
├── .github/           → modelos de tarefa (Issue) e de Pull Request
└── CONTRIBUTING.md    → guia de Git passo a passo
```

## ✅ Checklist de entrega

### Sistema web (funcionalidades obrigatórias)
- [ ] Sistema responsivo (celular, tablet, computador)
- [ ] Tela de carregamento
- [ ] Botão de WhatsApp com formulário funcional (API gratuita `wa.me`)
- [ ] Filtro de busca por letra em tempo real
- [ ] Pop-up de alerta ao adicionar item
- [ ] CEP funcional / endereço automático e preço (ViaCEP, gratuito)
- [ ] Se tiver venda: tela de carrinho + mini CRUD no Supabase
- [ ] Mínimo de 15 telas
- [ ] Sistema hospedado (Netlify/Vercel)

### Supabase
- [ ] Tela de login funcional
- [ ] Cadastro de login
- [ ] Verificar conta (e-mail de confirmação)
- [ ] Recuperar senha
- [ ] Imagens adicionadas via URL
- [ ] Editar perfil
- [ ] Lista de favoritos
- [ ] Avaliação com comentários e mídia
- [ ] Tela de administrador (CRUD) com dashboard funcional

### Apresentação
- [ ] Slides no Canva: nomes, logo, regras de negócio, objetivo, tecnologias, diferencial, público-alvo, 15+ telas → [roteiro](apresentacao/roteiro-canva.md)
- [ ] Vídeo trailer com IA de pelo menos 1 minuto (só ferramentas gratuitas) → [roteiro](apresentacao/roteiro-video.md)

### Documentação (entregar até 25/11 via Google Docs/Drive)
- [ ] [Problematização: problema, usuários, público-alvo, regras de negócio](docs/01-problematizacao.md)
- [ ] [Requisitos funcionais e não funcionais](docs/02-requisitos.md)
- [ ] [Diagrama de casos de uso](docs/03-casos-de-uso.md)
- [ ] [Modelagem do banco de dados](docs/04-modelagem-banco.md)
- [ ] [Manual do usuário](docs/05-manual-do-usuario.md)
- [ ] [Relatório reflexivo](docs/06-relatorio-reflexivo.md)

## 🛠️ Tecnologias

- [Angular](https://angular.dev) no front
- [Supabase](https://supabase.com): login (Auth), banco PostgreSQL e regras de segurança (RLS)
- API em Node para o FatoBot (a chave da IA fica só no servidor)
- [Dados Abertos da Câmara](https://dadosabertos.camara.leg.br/): fonte dos perfis de políticos
- GitHub para trabalhar em equipe e Vercel para hospedar

## ▶️ Como rodar no seu computador

Instale o [Node.js](https://nodejs.org) 20 ou mais novo, depois:

```bash
cd frontend
```

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:4200. Sem Supabase configurado, o site roda em **modo demonstração** (dados salvos só no navegador). Detalhes em [frontend/README.md](frontend/README.md).

## 📊 Critérios de avaliação

| Critério | Peso |
|---|---|
| Planejamento (problema, requisitos, modelagem) | 30% |
| Desenvolvimento técnico (funcionalidade, acessibilidade, segurança, usabilidade) | 40% |
| Documentação e apresentação | 20% |
| Trabalho em equipe | 10% |
