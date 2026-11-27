-- =====================================================================
-- Fato Real: campos do perfil que o site já usa, mas que faltavam no banco (27/11/2026).
--
-- Sem estas colunas, a tela "Editar perfil" esconde Profissão, Temas de interesse,
-- Redes sociais e a foto de capa (o site só mostra os campos que existem na tabela perfis).
--
-- Como usar: Supabase > SQL Editor > colar tudo > Run. Rodar nos DOIS projetos (dev e prod).
-- Pode rodar mais de uma vez sem erro. Não apaga nada.
-- =====================================================================

alter table public.perfis add column if not exists profissao  text   check (profissao is null or char_length(profissao) <= 60);
alter table public.perfis add column if not exists interesses text[] check (interesses is null or cardinality(interesses) <= 20);
alter table public.perfis add column if not exists redes      jsonb  check (redes is null or jsonb_typeof(redes) = 'object');
-- Capa enviada pela pessoa (imagem reduzida no navegador, guardada como texto data:image/...)
alter table public.perfis add column if not exists capa_url   text;

-- Avisa a API do Supabase (PostgREST) que as colunas mudaram, sem precisar reiniciar nada.
notify pgrst, 'reload schema';
