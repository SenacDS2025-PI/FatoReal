# DESIGN.md: Fato Real

Ficha do visual do **Fato Real**, a rede social cívica do PI do Senac (turma DS 2025). Serve para quem for criar ou mudar telas, seja uma pessoa da turma ou uma IA: siga estes valores para o site ficar com a mesma cara em todo lugar.

- **Fonte da verdade:** `frontend/src/styles.scss` (variáveis em `:root` e `:root[data-tema='escuro']`). Se este arquivo e o código discordarem, vale o código, e este arquivo deve ser atualizado.
- **Foco:** computador. No celular, o layout só não pode quebrar.
- **Público:** de jovens a idosos. Textos simples e diretos, em português do Brasil.

---

## 1. Tema (theme)

Dois modos, trocados pela pessoa na lâmpada com cordinha (canto superior direito) ou em **Configurações > Aparência** (Claro, Escuro ou Automático). O modo fica em `<html data-tema="claro|escuro">`.

| | Modo claro | Modo escuro |
|---|---|---|
| Ideia | Verde do Fato Real, fundo verde bem clarinho, cartões brancos | Preto e grafite, contraste definido, destaques discretos em **verde-limão** |
| Proibido | Bloco escuro dentro do modo claro | Preto puro `#000` |

A faixa com as três cores (verde, amarelo, azul) aparece embaixo da barra de cima e em detalhes de marca.

---

## 2. Cores (colors)

Use sempre as **variáveis CSS**, nunca o valor direto, para o modo escuro funcionar sozinho.

### Superfícies e texto

| Variável | Claro | Escuro | Uso |
|---|---|---|---|
| `--moldura` | `#ffffff` | `#0b0b0d` | Barra de cima e menu lateral |
| `--moldura-2` | `#f1f7f4` | `#17191d` | Fundo secundário da moldura |
| `--moldura-borda` | `#dbe7e1` | `#2c2f34` | Bordas da moldura |
| `--moldura-campo` | `#f1f4f3` | `#16181c` | Campo de busca da barra |
| `--painel` | `#e9f5ef` | `#09090b` | Fundo da área de conteúdo |
| `--superficie` | `#ffffff` | `#121316` | Cartões |
| `--superficie-2` | `#f0f7f3` | `#1a1c20` | Fundo dentro de cartões, listas, chips |
| `--texto` | `#0a1a2b` | `#eceef0` | Texto principal |
| `--texto-suave` | `#52646f` | `#a3a8ae` | Texto secundário, legendas |
| `--borda` | `#d7e6de` | `#33363b` | Bordas de cartões e campos |

### Ação e marca

| Variável | Claro | Escuro | Uso |
|---|---|---|---|
| `--primaria` | `#00855a` | `#c6f432` | Botão principal, aba ativa |
| `--primaria-texto` | `#ffffff` | `#101a00` | Texto sobre a primária |
| `--link` | `#007a50` | `#c6f432` | Links e destaques de texto |
| `--lima` | (n/a) | `#c6f432` | Destaque do modo escuro |
| `--verde-vivo` | `#00c27a` | `#4ade80` | Ícones e detalhes de marca |
| `--destaque` | `#ffc21a` | `#ffd84a` | Amarelo de destaque e anel de foco |
| `--azul-vivo` | `#1e6bff` | `#4c8dff` | Azul de marca |
| `--perigo` | `#d62839` | `#ff5a64` | Erros, excluir |
| `--faixa-brasil` | verde `#00c27a` / amarelo `#ffc21a` / azul `#1e6bff` em três partes iguais | igual | Faixa da barra de cima |

Contador de notificação: fundo `#ff2d55` com texto branco.

### Selos de status (sempre pelo componente `shared/selo-status.ts`)

| Selo | Cor (claro) | Cor (escuro) | Quando usar |
|---|---|---|---|
| Verificado | `#16a34a` | `#4ade80` | Conferido em fontes oficiais ou confiáveis |
| Confiável | `#2563eb` | `#60a5fa` | Vem direto de fonte oficial |
| Em análise | `#d97706` | `#fbbf24` | Aguardando fontes ou revisão humana |
| Novo | `#7c3aed` | `#a78bfa` | Publicado nas últimas 24 horas |
| Sem contexto | `#ea580c` | (mesma lógica) | Tem base nos fatos, mas foi distorcido |
| Evidência insuficiente | `#64748b` | (mesma lógica) | Não dá para confirmar nem negar |
| Falso | `#dc2626` | (mesma lógica) | Fontes mostram que não é verdade |
| Publicação de usuário | `#64748b` | (mesma lógica) | Post de membro, sem checagem |

Selo é uma pílula com ícone, texto e cor; nunca só cor.

### Cores por seção (ícones do menu e quadradinhos)

Cada seção tem um ícone num quadradinho colorido (`.icone-tile`, `.ps-icone`). Na busca: político `#2563eb`, comunidade `#ea580c`, termo do glossário `#7c3aed`, notícia `#16a34a`, página `#0891b2`. Nos cartões do perfil do político, o ícone fica num quadrado verde-limão `#d4f03c` com o desenho em `#26310a`; em alerta, fundo `#ffd6d9` e desenho em `#a3151f`.

---

## 3. Tipografia (typography)

- **Fonte:** `Inter` (Google Fonts, pesos 400, 500, 600, 700, 800), com reserva `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`. Variável `--fonte`.
- **Ícones:** `Material Symbols Rounded`, pelo componente `<app-icone nome="..." />`. Ícone preenchido (`FILL 1`) nos quadradinhos coloridos e no menu.
- **Corpo:** 16px, altura de linha 1.5.

| Elemento | Tamanho | Peso | Detalhes |
|---|---|---|---|
| `h1` | `clamp(1.45rem, 2.6vw, 1.9rem)` | 800 | Letras −0.01em; título da faixa −0.02em |
| `h2` / título de seção | `1.05rem` | 700 | |
| Texto pequeno / legenda | `0.8rem` a `0.88rem` | 400 a 600 | Cor `--texto-suave` |
| Rótulo de seção (sobretítulo) | `0.75rem` | 800 | MAIÚSCULAS, espaçamento 0.12em |
| Botões e chips | `0.9rem` a `1rem` | 600 a 700 | |
| Selos | `0.8rem` | 700 | |

Títulos usam `text-wrap: balance`.

---

## 4. Componentes (components)

Os principais (classes globais em `styles.scss`):

- **Cartão `.card`:** fundo `--superficie`, borda 1px `--borda`, cantos `--raio` (18px), espaço interno `clamp(16px, 2.2vw, 22px)`, sombra `--sombra`, 18px de espaço embaixo.
- **Cartão de painel `.ps-cartao` + `.ps-titulo` + `.ps-icone`:** título com ícone num quadradinho de 34px (cantos 10px).
- **Botão `.botao`:** pílula (`border-radius: 999px`), espaço 10px 20px, peso 700, fundo `--primaria`. Variações:
  - `.botao-fantasma`: transparente com borda;
  - `.botao-perigo`;
  - `.botao-p`: pequeno;
  - `.botao-bloco`: largura toda;
  - `.botao-icone`: redondo de 42px.
- **Chip `.chip`:** pílula com borda, peso 600. O ativo usa `--primaria`.
- **Etiqueta `.etiqueta`:** pílula pequena (0.78rem, peso 700) em `--superficie-2`; `.etiqueta-verde` e `.etiqueta-vermelha` para estado.
- **Selo de status:** `<app-selo tipo="verificado|confiavel|analise|novo|falso|sem-contexto|insuficiente|usuario" />`.
- **Quadradinho de ícone `.icone-tile`:** 44px, cantos 12px, fundo `--c`, ícone branco preenchido, sombra colorida suave.
- **Faixa de topo `<app-faixa>`:**
  - cantos 22px, altura mínima 150px, texto branco;
  - degradê de três cores da seção (`cores`) e ilustração à direita com máscara de esmaecimento;
  - sobretítulo, título, texto curto e selo de fonte opcional.
- **Campos:** largura total, espaço 11px 14px, cantos `--raio-p` (12px), borda `--borda`, fundo `--superficie`. Rótulo em peso 600.
- **Busca da barra de cima:**
  - pílula de 50px de altura, centralizada;
  - borda em degradê verde, amarelo e azul;
  - lupa num círculo colorido, dica que vai trocando e atalho `/`.
- **Assistente:** o **FatoBot**, robozinho 3D branco com detalhes dourados e verdes, visor preto com olhos verdes (piscando) e lupa na mão (`img/fatobot.webp`; rosto em `img/fatobot-rosto.webp`). Aparece como **bolinha flutuante** (`shared/fatobot-bolha.ts`) e não volta para o menu lateral.
- **Estado vazio `.vazio`:** centralizado, ícone de 2.2rem em `--verde-vivo` e texto suave. Prefira ilustração e um botão de ação.

---

## 5. Layout

- **Barra de cima:** 76px de altura, fixa no topo, com uma faixa de 3 cores embaixo. A ordem é logo, busca centralizada e ações (Verificar, sino, configurações, conta). A lâmpada fica pendurada no fio azul, embaixo da conta.
- **Menu lateral:** fixo, com estes grupos:
  - **Início, Notícias, Políticos, Base da Política e Comunidades.** É sempre "Políticos", nunca "Candidatos".
  - embaixo, **Meu Perfil** e **Mensagens**;
  - no rodapé, o **espaço dinâmico** "Enquanto você rola".
- **Conteúdo:** `main` com largura máxima de **1240px**, centralizado, espaço de 22px 24px 48px. Fundo `--painel`.
- **Grades:** `.grade-2` (colunas automáticas de no mínimo 300px, espaço de 18px) e `.grade-cards` (no mínimo 260px, espaço de 18px).
- **Espaçamento:** a base é **18px** entre blocos. Dentro de cartões, 6 a 14px. Prefira `gap` em flex/grid a margens.
- **Cantos:**
  - `--raio` 18px: cartões;
  - `--raio-p` 12px: campos e itens pequenos;
  - 22px: faixas;
  - 999px: botões, chips e selos.

---

## 6. Elevação (elevation)

- **Claro:** `--sombra: 0 1px 2px rgba(0,80,50,.05), 0 8px 22px rgba(0,80,50,.08)`. É uma sombra esverdeada e suave.
- **Escuro:** `--sombra: 0 10px 30px rgba(0,0,0,.35)`. No escuro, a separação vem mais das bordas `#33363b` do que da sombra.
- **Botões:** `0 1px 2px rgba(0,60,40,.12)`.
- **Quadradinhos de ícone:** sombra da própria cor com 35% de força.
- **Foco do teclado:** contorno de 3px em `--destaque` (amarelo), afastado 2px. Nunca remova.

---

## 7. Regras (guidelines)

**Conteúdo**
1. **Nunca invente dados** sobre políticos, notícias, números ou checagens. Use só fonte oficial ou registro verificado com link. Sem fonte, mostre "sem dados" ou "Em análise".
2. Polêmicas e processos de políticos só com fonte oficial (STF, TSE, CNJ, Agência Brasil...). **Processo não é condenação.**
3. Pessoas e mensagens de exemplo do modo demonstração levam "(exemplo)" no nome.
4. O FatoBot é neutro: não opina, não elogia nem critica políticos e não recomenda voto. Fato e dado só com fonte; sem fonte, diz que não encontrou evidência (decisão do grupo, 23 nov. 2026).

**Visual**

5. Tudo em **português do Brasil**, simples e direto. O texto do botão diz exatamente o que ele faz.
6. Telas ilustrativas e vivas: faixa colorida no topo, cartões com título e ícone, imagens. Informação curta.
7. **Nada de bloco escuro dentro do modo claro.** No escuro, só preto e grafite, com verde-limão discreto.
8. Use sempre os selos padronizados para status de informação.
9. Notícias: título original com link para a fonte; resumo só se alguém leu a matéria.
10. Animações curtas e suaves. Respeite `prefers-reduced-motion`, sem animação para quem pediu menos movimento.

**Acessibilidade**

11. Contraste de leitura nos dois modos e foco visível.
12. Ícone sozinho precisa de `aria-label`.
13. Cor nunca é a única informação: use ícone e texto junto.

---

## 8. Responsivo (responsive)

Pontos de quebra usados: **1180px, 1100px, 1000px, 900px, 760px, 640px e 560px**.

- **Até 900px (celular e tablet):**
  - a barra de cima cai para 62px;
  - a busca some da barra (fica no ícone de lupa);
  - o menu lateral vira abas roláveis embaixo da barra;
  - o que é `.so-desktop` some e o que é `.so-celular` aparece.
- **Grades:** passam a ter 1 ou 2 colunas.
- **Lâmpada do tema:** some no celular. A troca fica em Configurações.
- Laterais de pelo menos 16px e nunca rolagem para os lados.

---

## 9. Guia para IA (agent_guide)

- **Antes de mudar uma tela:** leia `CLAUDE.md` e este arquivo. Trabalhe só na seção combinada.
- **Estilos:**
  - use as variáveis de `:root`, sem cores soltas, salvo as cores fixas de seção e de selo listadas acima;
  - estilos globais em `frontend/src/styles.scss`;
  - componentes Angular standalone com signals e `@if`/`@for`.
- **Reaproveite antes de criar:**
  - `<app-faixa>`, `<app-selo>`, `<app-icone>`, `.card`, `.ps-cartao`, `.botao`, `.chip`, `.icone-tile`;
  - `<app-mapa-estados>` para o mapa do Brasil clicável.
- **Teste os dois modos** (claro e escuro) no computador e confira se o celular não quebrou.
- **Antes de dizer que terminou:** `npx ng build` sem erros e prints das telas mexidas.
