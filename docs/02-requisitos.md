# Requisitos do sistema

## Requisitos funcionais (RF)

| Código | Requisito | Prioridade | Responsável | Status |
|---|---|---|---|---|
| RF01 | O sistema deve permitir que o usuário se cadastre com nome, e-mail e senha. | Alta | Gustavo | ⏳ |
| RF02 | O sistema deve enviar e-mail para verificar a conta. | Alta | Gustavo | ⏳ |
| RF03 | O sistema deve permitir login com e-mail e senha. | Alta | Gustavo | ⏳ |
| RF04 | O sistema deve permitir recuperar a senha por e-mail. | Alta | Gustavo | ⏳ |
| RF05 | O usuário deve poder editar seu perfil (nome, foto por URL, telefone, endereço). | Média | Luiz | ⏳ |
| RF06 | O sistema deve exibir uma tela de carregamento ao abrir as páginas. | Média | Raquel | ⏳ |
| RF07 | O sistema deve listar os itens com imagem (via URL), nome e preço. | Alta | Pablo | ⏳ |
| RF08 | O sistema deve filtrar os itens em tempo real a cada letra digitada na busca. | Alta | Pablo | ⏳ |
| RF09 | O sistema deve exibir um pop-up de alerta ao adicionar um item. | Média | Pablo | ⏳ |
| RF10 | O sistema deve ter uma tela de carrinho (adicionar, alterar quantidade, remover). | Alta | Pablo | ⏳ |
| RF11 | O sistema deve preencher o endereço automaticamente a partir do CEP e calcular o preço. | Alta | Guilherme | ⏳ |
| RF12 | O sistema deve ter um botão de WhatsApp com formulário que envia a mensagem pelo `wa.me`. | Alta | Guilherme | ⏳ |
| RF13 | O usuário deve poder adicionar e remover itens da lista de favoritos. | Média | Luiz | ⏳ |
| RF14 | O usuário deve poder avaliar itens com nota, comentário e mídia (imagem por URL). | Média | Luiz | ⏳ |
| RF15 | O administrador deve poder cadastrar, listar, editar e excluir itens (CRUD). | Alta | João | ⏳ |
| RF16 | O administrador deve ver um dashboard com totais (usuários, itens, avaliações, pedidos). | Alta | João | ⏳ |
| RF17 | | | | |

## Requisitos não funcionais (RNF)

| Código | Requisito | Categoria |
|---|---|---|
| RNF01 | O sistema deve ser responsivo (celular, tablet e computador). | Usabilidade |
| RNF02 | O sistema deve seguir boas práticas de acessibilidade: textos alternativos em imagens, contraste adequado, navegação por teclado e rótulos nos formulários. | Acessibilidade |
| RNF03 | As senhas devem ser gerenciadas pelo Supabase Auth (nunca guardadas em texto puro). | Segurança |
| RNF04 | O banco deve usar Row Level Security (RLS): cada usuário só altera os próprios dados. | Segurança |
| RNF05 | A chave `service_role` do Supabase nunca deve ficar no código do site. | Segurança |
| RNF06 | As páginas devem carregar em menos de 3 segundos em conexão comum. | Desempenho |
| RNF07 | O sistema deve funcionar nos navegadores Chrome, Edge e Firefox atualizados. | Compatibilidade |
| RNF08 | O sistema deve ficar hospedado e acessível pela internet (Netlify/Vercel). | Disponibilidade |
| RNF09 | Tecnologias: HTML, CSS, JavaScript, Supabase. | Tecnologia |
| RNF10 | O código deve ficar versionado no GitHub. | Manutenibilidade |
