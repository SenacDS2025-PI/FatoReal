-- =====================================================================
-- FATO REAL: estrutura do banco (Supabase / PostgreSQL)
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar mais de uma vez sem erro.
-- O front (pasta frontend/) usa exatamente estes nomes de tabela e coluna.
-- =====================================================================

-- ---------- PERFIS (dados mínimos do usuário: LGPD) ----------
create table if not exists public.perfis (
  id           uuid primary key references auth.users(id) on delete cascade,
  nome         text not null default 'Usuário',
  foto_url     text,
  is_moderador boolean not null default false,
  criado_em    timestamptz not null default now()
);
-- Frase curta de apresentação do perfil (opcional). "add column if not exists" deixa rodar de novo sem erro.
alter table public.perfis add column if not exists bio text check (bio is null or char_length(bio) <= 160);

create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_cadastrar_usuario on auth.users;
create trigger ao_cadastrar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

create or replace function public.eh_moderador()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_moderador from public.perfis where id = auth.uid()), false);
$$;

-- LGPD: o próprio usuário exclui a conta (apaga em cascata perfil, publicações etc.)
create or replace function public.excluir_minha_conta()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ---------- POLÍTICOS (importados da API de Dados Abertos da Câmara) ----------
create table if not exists public.politicos (
  id                   bigint primary key,           -- id do deputado na API da Câmara
  nome                 text not null,
  nome_civil           text,
  partido              text,
  uf                   char(2),
  cargo                text default 'Deputado(a) Federal',
  foto_url             text,
  email                text,
  situacao             text,
  escolaridade         text,
  data_nascimento      date,
  municipio_nascimento text,
  fonte_url            text not null,                -- link para o original
  data_coleta          timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

-- ---------- COMUNIDADES ----------
create table if not exists public.comunidades (
  id          bigint generated always as identity primary key,
  slug        text not null unique,
  nome        text not null,
  tema        text not null,
  descricao   text not null default '',
  regras      text not null default '',
  criador_id  uuid references public.perfis(id) on delete set null,
  criado_em   timestamptz not null default now()
);

create table if not exists public.comunidade_membros (
  comunidade_id bigint not null references public.comunidades(id) on delete cascade,
  usuario_id    uuid   not null references public.perfis(id) on delete cascade,
  papel         text   not null default 'membro' check (papel in ('membro', 'moderador')),
  entrou_em     timestamptz not null default now(),
  primary key (comunidade_id, usuario_id)
);

create or replace function public.eh_membro(cid bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comunidade_membros where comunidade_id = cid and usuario_id = auth.uid());
$$;

-- ---------- MURAL ----------
create table if not exists public.publicacoes (
  id             bigint generated always as identity primary key,
  comunidade_id  bigint not null references public.comunidades(id) on delete cascade,
  autor_id       uuid   not null references public.perfis(id) on delete cascade,
  texto          text   not null check (char_length(texto) between 1 and 2000),
  link_url       text   check (link_url is null or link_url ~* '^https?://'),
  verificada     boolean not null default false,  -- true = informação verificada pela plataforma
  removida       boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table if not exists public.comentarios (
  id             bigint generated always as identity primary key,
  publicacao_id  bigint not null references public.publicacoes(id) on delete cascade,
  autor_id       uuid   not null references public.perfis(id) on delete cascade,
  texto          text   not null check (char_length(texto) between 1 and 1000),
  removido       boolean not null default false,
  criado_em      timestamptz not null default now()
);

create table if not exists public.curtidas (
  publicacao_id  bigint not null references public.publicacoes(id) on delete cascade,
  usuario_id     uuid   not null references public.perfis(id) on delete cascade,
  criado_em      timestamptz not null default now(),
  primary key (publicacao_id, usuario_id)
);

-- ---------- DENÚNCIAS E MODERAÇÃO ----------
create table if not exists public.denuncias (
  id              bigint generated always as identity primary key,
  tipo            text   not null check (tipo in ('publicacao', 'comentario')),
  publicacao_id   bigint not null references public.publicacoes(id) on delete cascade,
  comentario_id   bigint references public.comentarios(id) on delete cascade,
  denunciante_id  uuid   references public.perfis(id) on delete set null,
  motivo          text   not null,
  status          text   not null default 'aberta' check (status in ('aberta', 'removido', 'mantido')),
  decisao_motivo  text,
  moderador_id    uuid   references public.perfis(id) on delete set null,
  resolvida_em    timestamptz,
  criado_em       timestamptz not null default now()
);

-- ---------- MENSAGENS PRIVADAS ----------
create table if not exists public.mensagens (
  id               bigint generated always as identity primary key,
  remetente_id     uuid not null references public.perfis(id) on delete cascade,
  destinatario_id  uuid not null references public.perfis(id) on delete cascade,
  texto            text not null check (char_length(texto) between 1 and 1000),
  lida             boolean not null default false,
  criado_em        timestamptz not null default now(),
  check (remetente_id <> destinatario_id)
);
create index if not exists idx_mensagens_destinatario on public.mensagens (destinatario_id, criado_em desc);
create index if not exists idx_mensagens_remetente on public.mensagens (remetente_id, criado_em desc);

create index if not exists idx_publicacoes_comunidade on public.publicacoes (comunidade_id, criado_em desc);
create index if not exists idx_comentarios_publicacao on public.comentarios (publicacao_id, criado_em);
create index if not exists idx_denuncias_status on public.denuncias (status, criado_em desc);

-- =====================================================================
-- SEGURANÇA (Row Level Security)
-- =====================================================================
alter table public.perfis             enable row level security;
alter table public.politicos          enable row level security;
alter table public.comunidades        enable row level security;
alter table public.comunidade_membros enable row level security;
alter table public.publicacoes        enable row level security;
alter table public.comentarios        enable row level security;
alter table public.curtidas           enable row level security;
alter table public.denuncias          enable row level security;
alter table public.mensagens          enable row level security;

-- Perfis: nome e foto aparecem nas comunidades; cada um edita só o seu e ninguém vira moderador sozinho
drop policy if exists "perfis: todos veem" on public.perfis;
create policy "perfis: todos veem" on public.perfis for select using (true);
drop policy if exists "perfis: editar o proprio" on public.perfis;
create policy "perfis: editar o proprio" on public.perfis for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_moderador = (select p.is_moderador from public.perfis p where p.id = auth.uid()));

-- Políticos: leitura pública; só moderador (ou o script de importação com service_role) altera
drop policy if exists "politicos: todos veem" on public.politicos;
create policy "politicos: todos veem" on public.politicos for select using (true);
drop policy if exists "politicos: moderador altera" on public.politicos;
create policy "politicos: moderador altera" on public.politicos for all
  using (public.eh_moderador()) with check (public.eh_moderador());

-- Comunidades: todos veem; logado cria; criador ou moderador edita
drop policy if exists "comunidades: todos veem" on public.comunidades;
create policy "comunidades: todos veem" on public.comunidades for select using (true);
drop policy if exists "comunidades: logado cria" on public.comunidades;
create policy "comunidades: logado cria" on public.comunidades for insert
  with check (auth.uid() is not null and criador_id = auth.uid());
drop policy if exists "comunidades: criador ou moderador edita" on public.comunidades;
create policy "comunidades: criador ou moderador edita" on public.comunidades for update
  using (criador_id = auth.uid() or public.eh_moderador());

-- Membros: todos veem; cada um entra/sai só por si (o criador entra como moderador da comunidade)
drop policy if exists "membros: todos veem" on public.comunidade_membros;
create policy "membros: todos veem" on public.comunidade_membros for select using (true);
drop policy if exists "membros: entrar" on public.comunidade_membros;
create policy "membros: entrar" on public.comunidade_membros for insert
  with check (
    usuario_id = auth.uid()
    and (papel = 'membro'
         or exists (select 1 from public.comunidades c where c.id = comunidade_id and c.criador_id = auth.uid()))
  );
drop policy if exists "membros: sair" on public.comunidade_membros;
create policy "membros: sair" on public.comunidade_membros for delete using (usuario_id = auth.uid());

-- Publicações: todos veem as não removidas; membro publica; só moderador remove/verifica
drop policy if exists "publicacoes: ver" on public.publicacoes;
create policy "publicacoes: ver" on public.publicacoes for select using (removida = false or public.eh_moderador());
drop policy if exists "publicacoes: membro publica" on public.publicacoes;
create policy "publicacoes: membro publica" on public.publicacoes for insert
  with check (autor_id = auth.uid() and public.eh_membro(comunidade_id)
              and removida = false and (verificada = false or public.eh_moderador()));
drop policy if exists "publicacoes: moderador altera" on public.publicacoes;
create policy "publicacoes: moderador altera" on public.publicacoes for update using (public.eh_moderador());
drop policy if exists "publicacoes: autor exclui" on public.publicacoes;
create policy "publicacoes: autor exclui" on public.publicacoes for delete using (autor_id = auth.uid());

-- Comentários: mesma lógica (só membro da comunidade comenta)
drop policy if exists "comentarios: ver" on public.comentarios;
create policy "comentarios: ver" on public.comentarios for select using (removido = false or public.eh_moderador());
drop policy if exists "comentarios: membro comenta" on public.comentarios;
create policy "comentarios: membro comenta" on public.comentarios for insert
  with check (autor_id = auth.uid() and removido = false
              and exists (select 1 from public.publicacoes p where p.id = publicacao_id and public.eh_membro(p.comunidade_id)));
drop policy if exists "comentarios: moderador altera" on public.comentarios;
create policy "comentarios: moderador altera" on public.comentarios for update using (public.eh_moderador());
drop policy if exists "comentarios: autor exclui" on public.comentarios;
create policy "comentarios: autor exclui" on public.comentarios for delete using (autor_id = auth.uid());

-- Curtidas: todos veem; cada um curte/descurte por si
drop policy if exists "curtidas: todos veem" on public.curtidas;
create policy "curtidas: todos veem" on public.curtidas for select using (true);
drop policy if exists "curtidas: curtir" on public.curtidas;
create policy "curtidas: curtir" on public.curtidas for insert with check (usuario_id = auth.uid());
drop policy if exists "curtidas: descurtir" on public.curtidas;
create policy "curtidas: descurtir" on public.curtidas for delete using (usuario_id = auth.uid());

-- Denúncias: logado denuncia; só moderador vê e decide (decisão sempre humana)
drop policy if exists "denuncias: logado denuncia" on public.denuncias;
create policy "denuncias: logado denuncia" on public.denuncias for insert
  with check (denunciante_id = auth.uid() and status = 'aberta');
drop policy if exists "denuncias: moderador ve" on public.denuncias;
create policy "denuncias: moderador ve" on public.denuncias for select using (public.eh_moderador());
drop policy if exists "denuncias: moderador decide" on public.denuncias;
create policy "denuncias: moderador decide" on public.denuncias for update using (public.eh_moderador());

-- Mensagens: só quem enviou ou recebeu vê; só o destinatário marca como lida
drop policy if exists "mensagens: ver as minhas" on public.mensagens;
create policy "mensagens: ver as minhas" on public.mensagens for select
  using (remetente_id = auth.uid() or destinatario_id = auth.uid());
drop policy if exists "mensagens: enviar" on public.mensagens;
create policy "mensagens: enviar" on public.mensagens for insert
  with check (remetente_id = auth.uid() and lida = false);
drop policy if exists "mensagens: marcar lida" on public.mensagens;
create policy "mensagens: marcar lida" on public.mensagens for update
  using (destinatario_id = auth.uid()) with check (destinatario_id = auth.uid());

-- =====================================================================
-- DADOS INICIAIS: comunidades do piloto
-- =====================================================================
insert into public.comunidades (slug, nome, tema, descricao, regras) values
  ('politica-brasileira', 'Política Brasileira', 'Política', 'Debate sobre o Congresso, o governo e as eleições, sempre com fontes.', 'Respeite as pessoas. Cite fontes ao afirmar fatos. Opinião não é desinformação.'),
  ('educacao-para-todos', 'Educação para Todos', 'Educação', 'Educação pública, escolas, universidades e políticas educacionais.', 'Respeite as pessoas. Cite fontes ao afirmar fatos. Opinião não é desinformação.'),
  ('direitos-e-cidadania', 'Direitos e Cidadania', 'Cidadania', 'Direitos do cidadão, serviços públicos e participação social.', 'Respeite as pessoas. Cite fontes ao afirmar fatos. Opinião não é desinformação.')
on conflict (slug) do nothing;

-- Comunidades temáticas (as mesmas do modo demonstração do front)
insert into public.comunidades (slug, nome, tema, descricao, regras)
select v.slug, v.nome, v.tema, v.descricao, E'1. Respeite as pessoas: critique ideias, não ataque quem pensa diferente.\n2. Ao afirmar um fato, cite a fonte (de preferência oficial).\n3. Opinião é bem-vinda e não é desinformação.\n4. Não publique conteúdo sabidamente falso nem dados pessoais de outras pessoas.\n5. Denuncie o que violar estas regras: a moderação humana analisa.'
from (values
  ('eleicoes-e-voto', 'Eleições e Voto', 'Política', 'Calendário eleitoral, regras do TSE, urna eletrônica e como conferir candidaturas.'),
  ('camara-e-senado-em-pauta', 'Câmara e Senado em Pauta', 'Política', 'Acompanhe projetos, votações e comissões do Congresso Nacional, com link para a tramitação oficial.'),
  ('politica-na-minha-cidade', 'Política na Minha Cidade', 'Política', 'Câmaras municipais, prefeituras e orçamento local. O que é decidido perto de você.'),
  ('checagem-de-fatos', 'Checagem de Fatos', 'Cidadania', 'Recebeu um boato? Traga aqui para a comunidade conferir junto, sempre com fonte.'),
  ('contas-publicas', 'Contas Públicas', 'Economia', 'Orçamento, impostos, gastos do governo e cota parlamentar, com dados abertos.'),
  ('saude-publica-e-sus', 'Saúde Pública e SUS', 'Saúde', 'Políticas de saúde, vacinação e funcionamento do SUS, com informação oficial.'),
  ('meio-ambiente-e-clima', 'Meio Ambiente e Clima', 'Meio ambiente', 'Desmatamento, clima, energia e as leis ambientais em debate no país.'),
  ('seguranca-publica', 'Segurança Pública', 'Segurança', 'Políticas de segurança, dados de violência e o papel de cada esfera de governo.'),
  ('tecnologia-e-democracia', 'Tecnologia e Democracia', 'Tecnologia', 'Desinformação, inteligência artificial, privacidade (LGPD) e regras para as plataformas.'),
  ('juventude-e-participacao', 'Juventude e Participação', 'Cidadania', 'Para quem vota pela primeira vez: título de eleitor, conselhos, grêmios e como participar.')
) as v(slug, nome, tema, descricao)
on conflict (slug) do nothing;

-- =====================================================================
-- Tornar alguém moderador (rode depois que a pessoa se cadastrar):
-- update public.perfis set is_moderador = true
--   where id = (select id from auth.users where email = 'email@exemplo.com');
-- =====================================================================
