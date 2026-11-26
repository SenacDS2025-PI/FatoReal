# Autenticação, conta e admin (área do Gustavo)

Divisão de tarefas e regras para não dar conflito: [`../../DIVISAO.md`](../../DIVISAO.md).

## Como funciona o login na API

O front já faz login direto no Supabase e guarda um **token de sessão**. Para chamar uma rota
protegida da API, o front manda esse token no cabeçalho:

```
Authorization: Bearer <token>
```

- `middlewares.js` → **`exigirLogin`** confere o token com o Supabase (`auth.getUser`) e coloca em
  `req.usuario` o `{ id, email }` de quem está logado. **`exigirModerador`** (usado depois do
  `exigirLogin`) confere `perfis.is_moderador`.
- `supabase-usuario.js` → cria o cliente do Supabase **com a chave pública + o token da pessoa**.
  Assim as regras de segurança do banco (RLS do `supabase/schema.sql`) valem: cada um só vê e
  altera o que tem permissão. A API **nunca** usa a `service_role`.
- `limite.js` → limite contra abuso com **contador próprio**: 60 pedidos/min por IP (ajuste com
  `LIMITE_CONTA_POR_IP_MIN`). É separado do contador do FatoBot de propósito: numa sala de aula todos
  saem pelo mesmo IP, e a área de conta não pode gastar o limite do FatoBot (nem o contrário).
- Quando o Supabase falha, a rota responde `502` e registra no log da Vercel só a mensagem do erro
  (`Auth (<função>): <mensagem>`). **Nunca** token, e-mail, cabeçalhos ou `req.usuario` (LGPD).

## Rotas

| Rota | Quem pode | Resposta |
|---|---|---|
| `GET /api/conta/me` | logado | `{ conta: { id, nome, foto_url, bio, cidade, uf, capa, criado_em, email, moderador } }` |
| `DELETE /api/conta` | logado | `{ ok: true, mensagem }` — apaga a conta e tudo ligado a ela (função `excluir_minha_conta()` do banco) |
| `GET /api/admin/metricas` | moderador | `{ metricas: { usuarios, comunidades, publicacoes, publicacoesRemovidas, denunciasAbertas }, geradoEm }` |

Erros (sempre `{ erro: "mensagem em português" }`):

| Código | Quando |
|---|---|
| `401` | sem token, token mal escrito ou sessão vencida (token inválido) |
| `403` | rota de moderador acessada por quem não é moderador |
| `429` | muitos pedidos em pouco tempo (limite por IP) |
| `502` | o Supabase não respondeu, está fora do ar (5xx) ou deu erro de rede — inclusive ao conferir o login (não é "sessão expirada") |
| `503` | a API está sem `SUPABASE_URL` / `SUPABASE_ANON_KEY` configuradas |

Observações:
- **Usuários** = total de perfis (o banco cria um perfil automático a cada cadastro; a tabela de
  login `auth.users` não pode ser lida com a chave pública).
- As contagens usam o RLS "como o moderador", por isso incluem publicações removidas
  (separadas em `publicacoesRemovidas`) e as denúncias.

## Testar no seu computador

1. Backend rodando com o `backend/.env` apontando para o banco **dev** (`npm run dev`).
2. Entre no site local (http://localhost:4200) com uma conta de teste.
3. Pegue o token: DevTools (F12) → **Application → Local Storage** → chave `sb-...-auth-token`
   → copie o valor de `access_token`.
4. Teste:
   ```bash
   curl -H "Authorization: Bearer COLE_O_TOKEN" http://localhost:3000/api/conta/me
   curl -H "Authorization: Bearer COLE_O_TOKEN" http://localhost:3000/api/admin/metricas
   ```
5. Para virar moderador no banco **dev** (Supabase → SQL Editor):
   ```sql
   update public.perfis set is_moderador = true
   where id = (select id from auth.users where email = 'seu-email-de-teste@exemplo.com');
   ```

Testes automáticos (sem internet, com Supabase falso): `npm test` roda também os
`test/auth-*.test.js`.

## G5 — Login com Google (a fazer no painel)

Checklist (fazer no **dev** primeiro, depois no **prod** — ver `supabase/AMBIENTES.md`):

1. **Google Cloud** (console.cloud.google.com) → novo projeto *Fato Real* → **APIs e serviços →
   Tela de consentimento OAuth** (tipo *Externo*, nome do app, e-mail de suporte).
2. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
   Em *URIs de redirecionamento autorizados*, cole o endereço que o Supabase mostra em
   **Authentication → Providers → Google → Callback URL** (é algo como
   `https://xxxx.supabase.co/auth/v1/callback`). Um para o dev e outro para o prod.
3. No **Supabase → Authentication → Providers → Google**: ligar, colar o *Client ID* e o
   *Client secret* e salvar. O *Client secret* fica **só** no painel do Supabase.
4. Conferir em **Authentication → URL Configuration** os endereços de volta (tabela do
   `supabase/AMBIENTES.md`, passo 3).
5. **E-mail de confirmação:** em **Authentication → Emails → SMTP Settings**, configurar um SMTP
   próprio (o padrão do Supabase manda poucos e-mails por hora).
6. **Front (com o Luiz):** botão "Entrar com Google" chamando
   `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`.
