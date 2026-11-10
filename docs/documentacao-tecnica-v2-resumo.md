# Documentação Técnica e Funcional — Fato Real (v2.0) — Resumo em texto

> Resumo do PDF [`documentacao-tecnica-v2.pdf`](documentacao-tecnica-v2.pdf) (13 páginas), para leitura rápida.
> Em caso de dúvida, vale o PDF. **Veja no fim as divergências com o Trello, que o coordenador precisa decidir.**

## Identificação
- Senac • Gama DF • Docente orientador: Prof. Filypy.
- Repositório citado no PDF: `github.com/matheussss237/FatoReal`.
- Squads (segundo o PDF):
  | Squad | Integrantes | Escopo |
  |---|---|---|
  | 1 Back-End | Gustavo e João | Lógica de negócio, APIs do governo, ViaCEP, i18n, FatoBot (RAG), Tawk.to e WhatsApp |
  | 2 Front-End | Luiz e Arley | Telas responsivas, modo claro/escuro, idioma, loading, busca por letra, pop-ups |
  | 3 Banco de Dados | Pablo e Guilherme | Modelagem Supabase, RLS, preferências, CRUDs, favoritos, Dashboard Admin |
  | 4 Documentação | Raquel | ABNT, MVP, catálogo de telas, dicionário de dados, diagramas |
  | 5 Requisitos/Marketing/Jurídico | Raquel e Matheus | RF/RNF, regras de negócio, LGPD, Canva (15 telas), vídeo trailer |

## Produto
- Pilares: **Portal de Informação** (notícias), **Rede de Comunidades** e **Central de Inteligência** (pesquisa + IA com fontes).
- Slogan oficial no PDF: "Fato Real: Conheça os fatos. Participe da mudança."
- Público-alvo: eleitores/pesquisadores cívicos; verificadores do cotidiano; jovens iniciantes na política; membros de comunidades temáticas.

## Regras de negócio
| Código | Regra | Resumo |
|---|---|---|
| RN01 | Neutralidade procedimental | Mesmos campos e critérios para todos os partidos; proibido recomendar voto |
| RN02 | Rastreabilidade obrigatória | Nenhum dado factual sem URL da fonte oficial, órgão emissor e data/hora da coleta |
| RN03 | Separação visual | Cores/selos distintos para notícia, dado oficial, opinião de usuário e síntese da IA |
| RN04 | Trava anti-alucinação | FatoBot só usa recuperação documental (RAG); sem evidência → declara incerteza |
| RN05 | Moderação humana soberana | IA só sinaliza; remoção/suspensão é decisão humana no Dashboard, com direito a recurso |
| RN06 | Dados sensíveis (LGPD art. 11) | Coleta mínima; proibido perfilamento ideológico oculto |

## KPIs
Taxa de ativação em pesquisa · Índice de rastreabilidade (meta 100%) · Engajamento cívico (gamificação/XP) · SLA de denúncias.

## Módulos
- Portal/Feed (carrossel, categorias, assuntos em alta).
- Pesquisa política com filtro em tempo real.
- FatoBot e verificador de afirmações.
- Base da Política (educação cívica, glossário, quizzes).
- Comunidades estilo Orkut: **Aberta** (MVP), **Fechada** (MVP, entrada aprovada por moderador), **Privada** (pós-MVP).

### Estados de verificação do FatoBot (Quadro 3)
| Estado | Critério | Exibição |
|---|---|---|
| Evidências Sustentam | Fontes oficiais confirmam o essencial | Selo verde |
| Evidências Contradizem | Fontes oficiais mostram que é incorreta/fabricada | Alerta vermelho + link da prova |
| Fora de Contexto | Base verdadeira, mas data/local/autoria/sentido alterados | Selo amarelo |
| Evidência Insuficiente | Sem registros suficientes; ausência de evidência ≠ falsidade | — |
| Em Análise | Aguarda indexação de fontes ou revisão humana | — |

## Requisitos funcionais (RF01–RF20)
| Cód. | Requisito | Tecnologia |
|---|---|---|
| RF01 | Cadastro (nome, e-mail, senha, CEP) | Supabase Auth/DB |
| RF02 | Login e-mail/senha (JWT) | Supabase Auth |
| RF03 | Login com Gmail (desafio) | Supabase OAuth/SMTP |
| RF04 | Verificação de conta por e-mail | Supabase Auth SMTP |
| RF05 | Recuperação de senha | Supabase Auth |
| RF06 | Editar perfil e foto via URL | Supabase CRUD `perfis` |
| RF07 | CEP automático (regionaliza políticos da UF) | ViaCEP |
| RF08 | Busca por letra em tempo real | JS / Supabase |
| RF09 | Favoritos (mini CRUD) | Supabase `favoritos` |
| RF10 | Pop-up/toast de alerta | HTML/CSS/JS |
| RF11 | Tela de carregamento | CSS/JS |
| RF12 | Publicação e avaliação com mídia (URL), curtidas, comentários, enquetes | Supabase `postagens` |
| RF13 | FatoBot (RAG) com fontes e data da evidência | API IA + Supabase |
| RF14 | Chatbot de suporte | Tawk.to |
| RF15 | Botão WhatsApp com formulário | `wa.me` |
| RF16 | Dashboard Admin (usuários, postagens, fontes, denúncias) | Supabase |
| RF17 | Responsivo (3 colunas desktop / barra inferior mobile) | CSS Grid/Flex |
| RF18 | Gamificação (XP e nível) | Supabase/JS |
| RF19 | Modo claro/escuro (salvo no navegador e no perfil) | CSS vars/JS |
| RF20 | Idiomas PT-BR, EN, ES | i18n JSON |

## Requisitos não funcionais
- **RNF01** RLS ativo; usuário só edita o próprio perfil; rotinas admin exigem papel `admin`.
- **RNF02** Privacy by design (LGPD), termos de uso, sem venda de dados.
- **RNF03** Filtro: < 150 ms com cache local; até 1,2 s em consulta remota.
- **RNF04** Contraste WCAG AA (4.5:1), troca de tema/idioma sem recarregar.
- **RNF05** Log imutável de ações administrativas (moderador, data/hora, justificativa).

## Arquitetura (segundo o PDF)
Cliente HTML5/CSS3/JS → Supabase (Auth, PostgreSQL + RLS, CRUDs, Dashboard) → IA FatoBot (RAG), Tawk.to, WhatsApp → APIs externas (TSE, Câmara/Senado, ViaCEP).

### Tabelas (DER)
| Tabela | Campos principais |
|---|---|
| `perfis_usuarios` | id_usuario, nome, email, papel_role, foto_url, cep, uf_cidade, nivel_xp, idioma, tema_modo |
| `comunidades` | id_comunidade, nome, categoria, regras, tipo_acesso, capa_url, total_membros |
| `postagens_mural` | id_postagem, id_usuario, id_comunidade, conteudo_texto, midia_url, tipo_post, criado_em |
| `candidatos_perfis` | id_candidato, nome, partido, cargo, uf, foto_url, historico_votos, fonte_oficial_url, data_atu |
| `favoritos_salvos` | id_favorito, id_usuario, tipo_item, ref_id_item, salvo_em |
| `comentarios_midia` | id_comentario, id_postagem, id_usuario, texto, anexo_midia_url, reacao_tipo, criado_em |
| `denuncias_moderacao` | id_denuncia, id_postagem, id_autor, motivo, status_analise, parecer_admin, fonte_chec |
| `verificacoes_ia` | id_verificacao, id_usuario, pergunta_afirmacao, estado_evidencia, ref_urls |

### Pipeline do FatoBot (RAG)
1. Pergunta/boato (loading ativo) → 2. Busca documental no Supabase (TSE, Câmara, leis, Lupa) → 3. Filtro de evidência (só trechos com URL e órgão; bloqueia alucinação) → 4. Síntese didática citando as fontes → 5. Exibição com selo, links clicáveis e aviso de revisão.

## Identidade visual (segundo o PDF)
Azul Profundo `#09192B` · Verde Profundo `#102A25` · Verde Vivo `#14A370` · Amarelo `#EEC043`.
Claro: fundo `#F6F8F7`, cards `#FFFFFF`, texto `#09192B`. Escuro: fundo `#09192B`, cards `#102A25`, bordas `#1E293B`, texto `#F6F8F7`.

## Telas (6)
1 Auth (login, cadastro, CEP, Gmail) · 2 Home Feed (busca, notícias, XP) · 3 Perfis e Config (candidatos, favoritos, tema, idioma) · 4 Comunidades (mural, posts, enquetes, denúncia) · 5 FatoBot (verificador, Tawk.to, WhatsApp) · 6 Admin CRUD (métricas, fontes, moderação).

## Riscos e mitigações
Alucinação da IA (RAG + links + incerteza) · Dados desatualizados (selo com data, sincronização, botão de reportar) · Viés (RN01) · Abuso nas comunidades (regras, denúncia, moderação) · Moderação contestada (revisão humana, recurso) · LGPD (RLS, coleta mínima, termos).

## Trailer (roteiro, ~1 min)
Ato 1 o problema (0:00–0:15) · Ato 2 a solução (0:15–0:35) · Ato 3 comunidade e educação (0:35–0:50) · Ato 4 encerramento: "Fato Real — Informação para entender. Comunidade para participar. Conheça os fatos. Participe da mudança." (0:50–1:05).

---

## ⚠️ Divergências entre este PDF e o Trello (decisão do coordenador)
| Tema | PDF v2.0 | Trello / combinado atual |
|---|---|---|
| Stack | HTML/CSS/JS puro + Supabase, sem servidor próprio | Angular + Node + Supabase + Vercel ("definida pelo professor") |
| Repositório | `matheussss237/FatoReal` | `SenacDS2025-PI/FatoReal` (este) |
| Escopo | Inclui feed de notícias, Base da Política, enquetes, gamificação, idiomas, modo escuro | Esses itens estão **fora do MVP** |
| Cores | `#09192B`, `#102A25`, `#14A370`, `#EEC043` | `#0B3D2E`, `#D4AF37`, `#1A1A1A` |
| Slogan | "Conheça os fatos. Participe da mudança." | "Informação que importa." |
| Cronograma | Datas de set–out/2025 | Marcos de nov/2026, entrega 1º/12/2026 |
| Squads | Arley no Front-End | Arlley na Documentação |

Observação técnica: mesmo sem servidor próprio, a chave da IA do FatoBot **não pode ficar no navegador**.
Ela precisa de um backend (Node, como já está neste repositório) ou de uma Edge Function do Supabase.
