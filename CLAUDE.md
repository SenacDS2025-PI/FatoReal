# Fato Real — memória do projeto para o Claude

Rede social cívica do PI do Senac (turma DS 2025): informação política verificada, perfis de candidatos, comunidades e o assistente FatoBot.

## Como trabalhar aqui
- **Repositório oficial:** `SenacDS2025-PI/FatoReal`. O antigo (`matheussss237/FatoReal`) não recebe mais trabalho. Resumo do que já foi feito e das pendências: `docs/contexto-claude.md`.
- **Não fazer sem pedido do Luiz:** force-push, mexer na `main` ou nas branches dos outros (`joao/backend` etc.), abrir Pull Request.
- **Prazos e Trello:** o quadro oficial é o "FATO - PI" (https://trello.com/b/PrP5J55T/fato-pi). **Apresentação e entrega final: terça-feira, 1º/12/2026** (o ensaio de 27/11 deixou de ser prazo). Código congelado em 28/11/2026, salvo o que o Luiz pedir.
- **Idioma:** tudo em português do Brasil, simples e direto (o público vai de jovens a idosos). Código, comentários, commits e textos da interface.
- **Branch do front-end:** `luiz/frontend`. Não fazer push em outras branches nem abrir PR sem pedido explícito.
- **Commits:** mensagem em português, título curto + lista do que mudou.
- **Visual:** cores, fontes, componentes e regras de tela estão em `DESIGN.md` (raiz). Siga-o ao criar ou mudar telas.
- **Antes de dizer que terminou:** `npx ng build` sem erros e capturas das telas mexidas (ver skills abaixo).

## Stack
- Front-end: **Angular 22 + TypeScript** (componentes standalone, signals, `@if/@for`), em `frontend/`. Estilos globais em `frontend/src/styles.scss`.
- Banco/autenticação: **Supabase** (`frontend/src/app/core/supabase.ts`). Sem Supabase configurado o site roda em **modo demonstração** (dados no localStorage).
- Dados públicos: API de Dados Abertos da **Câmara** (`dadosabertos.camara.leg.br/api/v2`) e do **Senado** (`legis.senado.leg.br/dadosabertos`). Elas bloqueiam acesso de fora do Brasil: em servidores na nuvem, testar com `--mock`.
- Rodar: `cd frontend && npm start` (porta 4200). Para testes: `npx ng serve --port 4300`.

## Regras de conteúdo (importantes)
- **Nunca inventar dados** sobre políticos, notícias, números ou checagens. Só fonte oficial ou registro verificado com link. Sem fonte, mostrar "sem dados" / "Em análise".
- Polêmicas e processos de políticos: só com fonte oficial (STF, TSE, CNJ, Agência Brasil...). Processo não é condenação.
- Pessoas e mensagens de exemplo do modo demonstração levam "(exemplo)" no nome.
- O FatoBot é neutro: não opina, não elogia nem critica políticos e não recomenda voto. Fato e dado só com fonte; sem fonte, diz que não encontrou evidência (decisão do grupo, 23 nov. 2026).

## Visual (decisões do Luiz)
- **Mudança de visual = só aparência:** manter todo o conteúdo e todas as funções que já existem (perfil, stories, publicar, feed, memes, enquetes, lateral etc.). Nada some sem o Luiz pedir. O Fato Real é uma **rede social**: o visual tem que lembrar isso.
- **Computador e celular** (pedido do Luiz em 25 nov. 2026): o site no navegador do celular também precisa ficar bonito e alinhado. Sem rolagem para o lado em 360, 390 e 430 px; margem lateral de 16 px; botões com 44 px de toque; no celular a barra de cima segue a "Opção A" (aprovada em 25 nov. 2026): linha 1 com logo + "FATO REAL", botão amarelo VERIFICAR, sino e foto/Entrar; linha 2 com a busca em largura total. O nome "FATO REAL" fica à mostra em todos os celulares (escolha do Luiz em 26 nov. 2026: a versão de 430 px); em 360 px só "Entrar" vira ícone de pessoa. A engrenagem fica no menu da conta e nas abas. Conferir prints nos dois tamanhos.
- **Modo claro:** verde do Fato Real. **Modo escuro:** preto e grafite (`#09090b`, `#121316`, bordas `#33363b`, texto suave `#a3a8ae`; nada de preto puro `#000`), contraste definido e destaques discretos em **verde-limão** (`--lima: #c6f432`). Aprovado pelo Luiz em 18 nov. 2026 (antes era azul-marinho).
- **Página Políticos:** segue o tema (claro no modo claro, preto/grafite no escuro). **Nada de bloco escuro dentro do modo claro** (pedido do Luiz). Cargos em cartões grandes coloridos, cartões "Explore" com imagem, cartões de políticos com foto oficial (Câmara/Senado). Sem índice A–Z.
- **Notícias:** formato de portal (abas por assunto, faixa de últimas, carrossel, "Brasil e mundo", feed). Lista em `core/noticias.ts`: só título original + link; resumo só se alguém leu a matéria. Feed automático futuro: `GET {API_URL}/noticias`.
- Os slides em `apresentacao/` são **referência só de visual** (ícones, cores, cartões, selos), **não de conteúdo** — o conteúdo deles é técnico.
- **Selos de status** padronizados (`shared/selo-status.ts`): Verificado, Confiável, Em análise, Novo, Sem contexto, Evidência insuficiente, Falso. Usar sempre esse componente.
- Ícones em quadradinhos coloridos (`.icone-tile`, `.ps-icone`), cartões com título + ícone (`.ps-cartao`, `.ps-titulo`).
- O FatoBot é uma **bolinha flutuante** (`shared/fatobot-bolha.ts`) que acompanha a pessoa; não volta para o menu lateral.
- **Navegação lateral:** Início, Notícias, **Políticos** (nunca "Candidatos": a seção cobre todos os cargos), Base da Política, Comunidades; embaixo Meu Perfil e Mensagens; no rodapé da lateral, o **espaço dinâmico** (`core/destaques-laterais.ts`). Ícones coloridos por seção.
- **Congresso** é uma aba dentro de Políticos (`shared/nav-politicos.ts`, abas: Todos os políticos + Congresso em ação). **Ranking de gastos, Presença e Comparar** não são abas: abrem pelos cartões "Explore" da página de Políticos (com "Voltar para Políticos"). Comparar deve ir para uma futura área de **Eleições**. Mapa do Brasil clicável: `shared/mapa-estados.ts`; **Fato ou Fake** é o botão "Verificar" da barra de cima; notificações ficam no sino.
- Trabalhar **por blocos**: só mexer na seção combinada e validar com o Luiz antes de passar para a próxima.
- Perfil de político segue a estrutura do slide 10 (cabeçalho com resumo do mandato, cartões, linha do tempo, fontes). Perfil de pessoa segue a mesma base, no estilo Orkut + LinkedIn.

## Mapa rápido
- `frontend/src/app/pages/` — telas (inicio, politicos, congresso, verificar = "Fato ou Fake", comunidades, conta/perfil, fatobot...).
- `frontend/src/app/core/` — serviços e dados (politicos.service, ficha-politico, congresso, comunidades.service, fato-ou-fake, registros-verificados...).
- `frontend/src/app/shared/` — componentes reutilizáveis (selo-status, redes-sociais, fatobot-bolha, projeto-acoes...).
- `frontend/scripts/preview/` — `capturas.cjs` (prints + checagem de problemas) e `mocks.cjs` (APIs falsas para teste).

## Skills do projeto
- `/preview` — compila, tira prints das telas, publica o preview e mostra o resultado.
- `/revisar-tela <tela>` — revisão visual de uma tela no claro e no escuro.
- `/subir` — confere o build e faz commit + push na `luiz/frontend`.
