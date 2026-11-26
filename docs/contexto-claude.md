# Contexto do projeto (para retomar o trabalho, com qualquer IA ou pessoa)

> Em uma conversa nova, peça: **"leia o arquivo docs/contexto-claude.md do repositório"**.
> As regras de trabalho ficam no `CLAUDE.md` e o visual no `DESIGN.md` (os dois na raiz).
> Atualizado em 20/11/2026.

## O projeto
- **Fato Real**: rede social de informação cívica (PI do Senac, turma DS 2025): informação política verificada, perfis de políticos, comunidades e o assistente FatoBot. O que vale é o **Trello** "FATO - PI" (https://trello.com/b/PrP5J55T/fato-pi), que é o que o professor pediu. O quadro antigo "PI Senac - FATO REAL" não é mais editado.
- **Tecnologias:** Angular 22 (pasta `frontend/`), Supabase (banco e login), API em Node/Express (pasta `backend/`, branch `joao/backend`), hospedagem na Vercel.
- **Apresentação e entrega final:** terça-feira, 1º/12/2026 (o ensaio de 27/11 deixou de ser prazo). Código congelado em 28/11.
- **Equipe:** Luiz Gustavo (GitHub `Liipez`) cuida do **front-end**. João cuida do **back-end**. Coordenador: Guilherme. Vice: Pablo.

## GitHub
- **Repositório oficial:** `SenacDS2025-PI/FatoReal` (https://github.com/SenacDS2025-PI/FatoReal). O antigo (`matheussss237/FatoReal`) não recebe mais trabalho.
- **Branch do front:** `luiz/frontend`. Ao terminar cada pedido: build sem erros, commit + push nela.
- **Não fazer sem o Luiz pedir:** force-push, mexer na `main` ou nas branches dos outros, abrir Pull Request.
- **Chaves e senhas nunca vão para o repositório nem para o chat.**

### Branches (situação em 20/11/2026)
| Branch | Para que serve | Último commit |
|---|---|---|
| `luiz/frontend` | trabalho do front (Luiz) | 20/11 — Visual E + C no site todo, transições suaves e limpeza |
| `joao/backend` | API em Node, testes, guia do Supabase | 19/11 — J12: /api/health/fontes |
| `main` | versão principal | 18/11 — Unifica front e backend na main |
| `dev`, `unificar`, `automacao/unificar-dev` | junção front + back (18/11) | 18/11 |
| `deploy-vercel`, `integracao`, `luiz-gustavo`, `backup/matheus-2026-11-17` | antigas | até 11/11 |

Em 20/11 a `luiz/frontend` tem 11 commits que a `main` ainda não tem (toda a parte de visual de 18 a 20/11).

## Decisões do Luiz (valem sempre)
- **Mudança de visual = só aparência.** Manter todo o conteúdo e todas as funções (perfil, stories, publicar, feed, memes, enquetes, lateral...). Nada some sem o Luiz pedir. O Fato Real é uma **rede social** e tem que parecer uma.
- **Trabalhar por blocos e mostrar protótipo antes** de mudar telas no site.
- **Foco: computador.** Celular não é prioridade (só não pode quebrar).
- **Nunca inventar dados** sobre políticos, notícias, números ou checagens. Sem fonte: "sem dados" / "Em análise". Processo não é condenação.
- Pessoas e mensagens do modo demonstração levam **"(exemplo)"** no nome.
- **FatoBot neutro** (decisão do grupo, 23/11, substitui a de 20/11): não opina, não elogia nem critica políticos e não recomenda voto. Fato e dado só com fonte; sem fonte, diz que não encontrou evidência.
- **Logo oficial:** a do chip com o globo (`frontend/public/img/logo.svg`, redesenhada em vetor). O robô FatoBot é o padrão (textura melhorada em `img/fatobot.svg` e `img/fatobot-rosto.svg`).
- **Rejeitado pelo Luiz (não voltar com isso):** mascotes de animais (onça, tucano etc.), logo de cervo, vozes do ElevenLabs (no máximo a primeira voz da apresentação), troca do nome "FatoBot".

## Visual atual: "E + C" (aprovado em 20/11/2026)
- Estrutura de rede social (protótipo E) com a força gráfica do Brasil (protótipo C).
- **Arquivo:** `frontend/src/tema-ec.scss`, carregado no fim de `frontend/src/styles.scss`. Fontes em `frontend/src/index.html`.
- **Claro:** barra de cima verde `#0e5e3a` com faixa fina verde/amarelo/azul, fundo `#f3f6f2`, títulos em **Archivo** (900, maiúsculas nos títulos de seção), texto em **Plus Jakarta Sans**, blocos em cor sólida (amarelo `#ffcd00`, azul `#1e4fd8`, vermelho `#c81e4a`), cantos de 6–10px, carimbo FATO/FAKE nas checagens, botão "Verificar" amarelo.
- **Escuro:** preto e grafite (`#09090b`, `#121316`, bordas `#33363b`, texto suave `#a3a8ae`) com destaques em verde-limão `#c6f432`.
- **Movimento:** troca de tela suave (View Transitions, em `app.config.ts`) e realce leve no clique/passar do mouse; desliga para quem pede menos movimento.
- **Protótipos (quadro de design no claude.ai, privado do Luiz):** https://claude.ai/artifact/MWMh8Lhf6UP6mk118mDhi8 — opções A a E de Início e todas as telas no estilo E + C. Só o Luiz consegue abrir; para outra pessoa ver, ele compartilha pelo menu "Compartilhar" do próprio quadro.

## O que já está pronto no front
- **Topo:** logo, busca com sugestões (atalho "/"), Verificar (= Fato ou Fake), sino de notificações, engrenagem, foto com menu e a **lâmpada com cordinha** que troca claro/escuro (também em Configurações > Aparência: claro, escuro ou automático).
- **Lateral:** Início, Notícias, Políticos, Base da Política, Comunidades; Meu Perfil e Mensagens; "Enquanto você rola" (contagem para a eleição de 2028, quiz Fato ou Fake, campanhas); links institucionais.
- **Telas:** Início (stories, publicar com foto/meme/enquete/link/"é fake?", abas do feed, em alta, comunidades, Fato do dia), Notícias (portal com abas, faixa de últimas, carrossel, Brasil e mundo, feed das fontes oficiais), Políticos (cargos, Explore, lista) + Congresso em ação, Ranking de gastos, Presença, Eleições e Comparar, Perfil do político (formato do slide 10), Fato ou Fake, Comunidades (lista, criar, página da comunidade), Meu Perfil (Orkut + LinkedIn) e edição, Mensagens, Notificações, Configurações, Base da Política, FatoBot em tela cheia, busca geral, moderação, conta (entrar, cadastrar, recuperar senha) e institucionais.
- **Conferido em 20/11:** varredura automática abriu todas as telas, seguiu todos os links e clicou nos botões — nenhuma tela quebrada, nenhum link para página inexistente, nenhum erro de JavaScript. Build (`npx ng build`) sem erros.
- **Limpeza em 20/11:** ~250 linhas de CSS de telas antigas e funções sem uso removidas. Mascotes e arquivos ligados a eles já tinham sido apagados.
- **Modo demonstração:** sem Supabase configurado, tudo funciona com dados no navegador (localStorage).
- **Dados públicos:** APIs da Câmara e do Senado. Elas bloqueiam acesso de fora do Brasil; em servidor na nuvem, testar com `--mock` (`frontend/scripts/preview/mocks.cjs`).

## Como rodar e conferir
1. `cd frontend` e `npm ci` (só na primeira vez)
2. `npm start` e abrir http://localhost:4200
3. Build: `npx ng build` (tem que passar sem erros antes de subir)
4. Prints das telas (claro e escuro): com o site em `npx ng serve --port 4300`, rodar `node scripts/preview/capturas.cjs --saida prints --mock`

No Windows, o PowerShell pode precisar de `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. Não usar o Live Server ("Go Live").

## Skills do Claude (pasta `.claude/skills/`, só funcionam no Claude Code)
- `/preview` — compila, tira prints e publica o preview.
- `/revisar-tela <tela>` — revisão visual de uma tela.
- `/subir` — confere o build e faz commit + push na `luiz/frontend`.

## Próximo passo combinado
- **Página de entrada animada** (estilo do site de referência com GSAP + ScrollTrigger + rolagem suave Lenis): abertura com a logo, fake news reais levando carimbo FAKE (com fonte), FatoBot explicando, cartões das áreas do site, final com Entrar / Criar conta. Opcional: mapa do Brasil girando de leve com o mouse. **Fazer primeiro como protótipo e mostrar ao Luiz.** Dentro da rede social, manter só as transições leves.

## Pendências
- Ligar o Supabase de verdade (URL e chave `anon` em `frontend/.env` e na Vercel; modelo em `frontend/.env.exemplo`).
- Juntar o front com a API do João (`POST /api/fatobot`, `POST /api/verificar`; contratos em `frontend/README.md`).
- Levar a `luiz/frontend` para a `main`/`dev` (só quando o Luiz pedir; não abrir PR sem pedido).
- Acabamento fino de Base da Política, Congresso e Configurações para ficarem idênticas ao protótipo.
- Ideias propostas ao Luiz (aguardando resposta): carregamento/erro padronizados, lista do que o front espera do back, teste de acessibilidade, prévia ao compartilhar no WhatsApp.
- Trocar o e-mail de contato provisório (`contato.fatoreal@exemplo.com`) em `frontend/src/app/pages/institucional/institucional.ts`.
- Trello: o quadro oficial agora é o "FATO - PI" (https://trello.com/b/PrP5J55T/fato-pi). Código congelado em 28/11 (alguns cartões ainda dizem 23/11 e precisam ser ajustados).
