# Supabase: como configurar

1. Crie uma conta em https://supabase.com e um **New project** (região São Paulo).
2. Em **Project Settings → Team**, convide quem mexe no banco.
3. Vá em **SQL Editor**, cole todo o arquivo [`schema.sql`](schema.sql) e clique em **Run**. Ele cria as tabelas (perfis, políticos, comunidades, membros, publicações, comentários, curtidas e denúncias), as regras de segurança (RLS) e as 3 comunidades iniciais.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**. Elas vão em variáveis de ambiente (`SUPABASE_URL` e `SUPABASE_ANON_KEY`): no arquivo `frontend/.env` para rodar local e em **Settings → Environment Variables** na Vercel. Veja o [README do front](../frontend/README.md).
   - ⚠️ **Nunca** coloque a chave `service_role` no front. Ela só pode ser usada no script de importação dos dados da Câmara ou na API em Node.
5. Em **Authentication → URL Configuration**, coloque o link do site na Vercel em *Site URL* e em *Redirect URLs* (precisa disso para confirmar o e-mail e recuperar a senha).
6. Para virar moderador, rode o `update` que está no fim do `schema.sql` com o seu e-mail.

## Tabela `politicos`

O front lê desta tabela quando o Supabase está ligado. Os 10 a 20 deputados do piloto devem ser importados da API de Dados Abertos da Câmara (`https://dadosabertos.camara.leg.br/api/v2/deputados/{id}`), preenchendo sempre `fonte_url` e `data_coleta`. O `id` é o próprio id do deputado na Câmara.
