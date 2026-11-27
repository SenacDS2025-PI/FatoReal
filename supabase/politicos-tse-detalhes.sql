-- =====================================================================
-- Fato Real: perfis do TSE mais completos (pedido do Guilherme, 27/11/2026).
--
-- Para presidente, governador, deputado estadual, prefeito e vereador a única fonte nacional é
-- o TSE. Este arquivo acrescenta na tabela `politicos` os campos do arquivo "consulta_cand",
-- o total de bens e os votos, e cria a tabela `politico_bens` (bens declarados).
--
-- Como usar: Supabase > SQL Editor > colar tudo > Run. Rodar nos DOIS projetos (dev e prod),
-- ANTES do `npm run importar-tse`. Pode rodar mais de uma vez sem erro.
--
-- Os nomes das colunas são o contrato com o front (Gustavo). Não mudar sem avisar.
-- LGPD: NÃO guardamos cor/raça (dado sensível), CPF, título de eleitor nem e-mail.
-- =====================================================================

-- ---------- 1. Campos novos em politicos ----------
alter table public.politicos add column if not exists numero_urna int;            -- NR_CANDIDATO
alter table public.politicos add column if not exists ocupacao    text;           -- DS_OCUPACAO
alter table public.politicos add column if not exists reeleicao   boolean;        -- ST_REELEICAO (S/N)
alter table public.politicos add column if not exists coligacao   text;           -- DS_COMPOSICAO_COLIGACAO (ou federação)
alter table public.politicos add column if not exists genero      char(1);        -- 'M'/'F': só para escrever "eleito"/"eleita"
alter table public.politicos add column if not exists bens_total  numeric(16, 2); -- soma dos bens declarados
alter table public.politicos add column if not exists votos       int;            -- votos nominais no turno final
alter table public.politicos add column if not exists turno       int;            -- turno em que foi eleito (1 ou 2)
-- data_nascimento e municipio_nascimento já existem (schema.sql) e passam a ser preenchidos.

alter table public.politicos drop constraint if exists politicos_genero_check;
alter table public.politicos add constraint politicos_genero_check check (genero is null or genero in ('M', 'F'));

-- ---------- 2. Bens declarados ----------
create table if not exists public.politico_bens (
  id          bigint generated always as identity primary key,
  politico_id bigint not null references public.politicos(id) on delete cascade, -- = SQ_CANDIDATO
  ordem       int    not null,                 -- NR_ORDEM_BEM_CANDIDATO
  tipo        text,                            -- DS_TIPO_BEM_CANDIDATO
  descricao   text,                            -- DS_BEM_CANDIDATO (CPF de terceiros mascarado na importação)
  valor       numeric(16, 2),                  -- VR_BEM_CANDIDATO
  ano         int    not null,                 -- ano da eleição
  unique (politico_id, ano, ordem)
);
create index if not exists politico_bens_politico on public.politico_bens (politico_id);

alter table public.politico_bens enable row level security;
drop policy if exists "politico_bens: todos veem" on public.politico_bens;
create policy "politico_bens: todos veem" on public.politico_bens for select using (true);
drop policy if exists "politico_bens: moderador altera" on public.politico_bens;
create policy "politico_bens: moderador altera" on public.politico_bens for all
  using (public.eh_moderador()) with check (public.eh_moderador());
