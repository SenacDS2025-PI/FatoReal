# Equipe e cronograma

## Divisão de tarefas (sugestão, o time pode trocar)

| Integrante | Responsável por | Arquivos principais |
|---|---|---|
| **Matheus** | Coordenação, revisar e aprovar PRs, hospedar o site (Netlify/Vercel), montar o Google Drive de entrega | `README.md` |
| **Gustavo** | Login, cadastro, verificar conta (e-mail), recuperar senha | `paginas/login.html`, `cadastro.html`, `recuperar-senha.html`, `nova-senha.html`, `js/auth.js` |
| **Arley** | Criar o projeto no Supabase, tabelas, políticas de segurança (RLS), CRUD básico | `supabase/schema.sql`, `js/supabase.js` |
| **João** | Tela de administrador (CRUD de itens e usuários) + dashboard com números/gráficos | `paginas/admin.html`, `paginas/dashboard.html` |
| **Pablo** | Listagem de itens, detalhe do item, filtro de busca em tempo real, carrinho, pop-up ao adicionar | `paginas/itens.html`, `item.html`, `carrinho.html` |
| **Luiz** | Editar perfil, lista de favoritos, avaliações com comentários e mídia (imagem por URL) | `paginas/perfil.html`, `favoritos.html` |
| **Guilherme** | CEP com endereço automático e cálculo de preço, botão do WhatsApp com formulário, **vídeo trailer** | `paginas/contato.html`, `js/cep.js`, `apresentacao/roteiro-video.md` |
| **Raquel** | Identidade visual (cores, logo), CSS global, responsividade, acessibilidade, tela de carregamento, **slides no Canva** | `css/style.css`, `apresentacao/roteiro-canva.md` |
| **Kelly** | Documentação completa: problematização, requisitos, casos de uso, modelagem, manual, relatório | `docs/` |

> Todos ajudam nos testes finais e no relatório reflexivo.

## Cronograma de entregas

### Até 10/11: 2ª apresentação (Planejamento)
- [ ] Tema, nome e logo definidos
- [ ] Problema, público-alvo e regras de negócio (`docs/01`)
- [ ] Requisitos funcionais e não funcionais (`docs/02`)
- [ ] Diagrama de casos de uso (`docs/03`)
- [ ] Modelagem do banco (`docs/04`) e tabelas criadas no Supabase
- [ ] Protótipo das telas (Figma ou papel) e paleta de cores
- [ ] Login e cadastro funcionando

### Até 17/11: 3ª apresentação (Desenvolvimento)
- [ ] Listagem de itens + filtro em tempo real + pop-up
- [ ] Carrinho (se tiver venda)
- [ ] CEP + preço + WhatsApp
- [ ] Perfil, favoritos e avaliações
- [ ] Verificar conta e recuperar senha
- [ ] Primeira versão do site hospedada

### Até 24/11: 4ª apresentação (Síntese)
- [ ] Tela de administrador + dashboard
- [ ] 15+ telas prontas e responsivas
- [ ] Acessibilidade e segurança revisadas
- [ ] Testes e correção de bugs
- [ ] Slides do Canva prontos
- [ ] Vídeo trailer pronto (1 min+)
- [ ] Manual do usuário

### 25/11: Ensaio + entrega
- [ ] Documentação completa no Google Docs/Drive (link enviado ao professor)
- [ ] Relatório reflexivo
- [ ] Ensaio completo da apresentação

### 26/11: Apresentação do PI 🎤
- Roupa esporte fino ou casual
- Ordem: slides (empresa, regras de negócio, motivação) → sistema funcionando já hospedado
