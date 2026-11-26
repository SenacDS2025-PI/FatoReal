-- =====================================================================
-- Fato Real: TODOS os políticos na tabela `politicos` (pedido do Guilherme, 24/11/2026).
--
-- Além dos deputados federais (Câmara) e senadores (Senado), a tabela passa a ter os eleitos
-- do TSE: Presidente, Governadores, Deputados Estaduais/Distritais, Prefeitos e Vereadores.
--
-- Como usar: Supabase > SQL Editor > colar tudo > Run. Rodar nos DOIS projetos (dev e prod),
-- ANTES do `npm run importar-tse`. Pode rodar mais de uma vez sem erro.
-- =====================================================================

-- Município onde a pessoa foi eleita (só Prefeito, Vice e Vereador) e a versão sem acento
-- para a busca ("sao paulo" acha "São Paulo").
alter table public.politicos add column if not exists municipio       text;
alter table public.politicos add column if not exists municipio_busca text;

comment on column public.politicos.id is
  'Câmara: id do deputado; Senado: código do senador; TSE: número sequencial do candidato (SQ_CANDIDATO).';

-- São ~65 mil linhas (só vereadores são ~58 mil): índices para o site filtrar por cargo, UF e cidade.
create index if not exists politicos_cargo_nome      on public.politicos (cargo, nome);
create index if not exists politicos_cargo_uf_nome   on public.politicos (cargo, uf, nome);
create index if not exists politicos_municipio_busca on public.politicos (municipio_busca, cargo);

-- Polêmicas/processos também podem ser de políticos do TSE (prefeitos, governadores...).
-- (Só se a tabela já existir: ela vem do tabelas-do-front.sql.)
do $$
begin
  if to_regclass('public.politico_alertas') is not null then
    alter table public.politico_alertas drop constraint if exists politico_alertas_casa_check;
    alter table public.politico_alertas add constraint politico_alertas_casa_check
      check (casa in ('camara', 'senado', 'tse'));
  end if;
end $$;
