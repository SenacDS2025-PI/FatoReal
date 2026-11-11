/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Autor, Comentario, Comunidade, Denuncia, Publicacao, StatusDenuncia } from './modelos';
import { supabase } from './supabase';
import { lerDemo, proximoId, salvarDemo } from './demo-store';
import { gerarSlug } from './util';
import { PESSOAS_EXEMPLO, PUBLICACOES_EXEMPLO } from './pessoas-demo';

type Linha = Record<string, any>;

/**
 * Comunidades no estilo Orkut: listar, criar, entrar/sair, mural, comentários,
 * curtidas e denúncias. Usa o Supabase quando configurado; senão, o modo demonstração.
 */
@Injectable({ providedIn: 'root' })
export class ComunidadesService {
  private auth = inject(AuthService);
  private demo = new DemoSocial();

  private exigirUsuario() {
    const u = this.auth.usuario();
    if (!u) throw new Error('Entre na sua conta para fazer isso.');
    return u;
  }

  // ---------- Comunidades ----------
  async listar(termo = ''): Promise<Comunidade[]> {
    if (!supabase) return this.demo.listar(termo);
    let q = supabase.from('comunidades').select('*, comunidade_membros(count)').order('nome');
    if (termo.trim()) q = q.ilike('nome', `%${termo.trim()}%`);
    const { data, error } = await q;
    if (error) throw new Error('Não foi possível carregar as comunidades.');
    return (data as Linha[]).map(mapComunidade);
  }

  async obter(slug: string): Promise<Comunidade | null> {
    if (!supabase) return this.demo.obter(slug);
    const { data, error } = await supabase
      .from('comunidades')
      .select('*, comunidade_membros(count)')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error('Não foi possível carregar a comunidade.');
    return data ? mapComunidade(data) : null;
  }

  async criar(dados: { nome: string; tema: string; descricao: string; regras: string }): Promise<Comunidade> {
    const u = this.exigirUsuario();
    const slug = gerarSlug(dados.nome);
    if (!slug) throw new Error('Dê um nome válido para a comunidade.');
    if (!supabase) return this.demo.criar({ ...dados, slug }, u.id);
    const { data, error } = await supabase
      .from('comunidades')
      .insert({ ...dados, slug, criador_id: u.id })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.code === '23505' ? 'Já existe uma comunidade com esse nome.' : 'Não foi possível criar a comunidade.');
    }
    await supabase.from('comunidade_membros').insert({ comunidade_id: data.id, usuario_id: u.id, papel: 'moderador' });
    return mapComunidade({ ...data, comunidade_membros: [{ count: 1 }] });
  }

  async ehMembro(comunidadeId: number): Promise<boolean> {
    const u = this.auth.usuario();
    if (!u) return false;
    if (!supabase) return this.demo.ehMembro(comunidadeId, u.id);
    const { count } = await supabase
      .from('comunidade_membros')
      .select('*', { count: 'exact', head: true })
      .eq('comunidade_id', comunidadeId)
      .eq('usuario_id', u.id);
    return (count ?? 0) > 0;
  }

  async entrar(comunidadeId: number): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.entrar(comunidadeId, u.id);
    const { error } = await supabase.from('comunidade_membros').insert({ comunidade_id: comunidadeId, usuario_id: u.id });
    if (error && error.code !== '23505') throw new Error('Não foi possível entrar na comunidade.');
  }

  async sair(comunidadeId: number): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.sair(comunidadeId, u.id);
    const { error } = await supabase
      .from('comunidade_membros')
      .delete()
      .eq('comunidade_id', comunidadeId)
      .eq('usuario_id', u.id);
    if (error) throw new Error('Não foi possível sair da comunidade.');
  }

  async membros(comunidadeId: number): Promise<(Autor & { papel: string })[]> {
    if (!supabase) return this.demo.membros(comunidadeId);
    const { data, error } = await supabase
      .from('comunidade_membros')
      .select('papel, perfil:perfis(id, nome, foto_url)')
      .eq('comunidade_id', comunidadeId)
      .order('entrou_em');
    if (error) throw new Error('Não foi possível carregar os membros.');
    return (data as Linha[]).map((m) => ({ ...mapAutor(m['perfil']), papel: m['papel'] }));
  }

  /** Comunidades de que o usuário logado participa (para a página de perfil). */
  async minhas(): Promise<Comunidade[]> {
    const u = this.auth.usuario();
    return u ? this.comunidadesDe(u.id) : [];
  }

  /** Comunidades de que uma pessoa participa (perfil público). */
  async comunidadesDe(usuarioId: string): Promise<Comunidade[]> {
    if (!supabase) return this.demo.minhas(usuarioId);
    const { data, error } = await supabase
      .from('comunidade_membros')
      .select('comunidade:comunidades(*, comunidade_membros(count))')
      .eq('usuario_id', usuarioId);
    if (error) return [];
    return (data as Linha[]).map((m) => mapComunidade(m['comunidade']));
  }

  /** Publicações escritas por uma pessoa (aba "Publicações" do perfil). */
  async publicacoesDe(usuarioId: string): Promise<Publicacao[]> {
    const eu = this.auth.usuario()?.id;
    if (!supabase) return this.demo.feed(eu).filter((p) => p.autor.id === usuarioId);
    const { data, error } = await supabase
      .from('publicacoes')
      .select(SELECT_PUBLICACAO)
      .eq('autor_id', usuarioId)
      .eq('removida', false)
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) throw new Error('Não foi possível carregar as publicações.');
    return (data as Linha[]).map((p) => mapPublicacao(p, eu));
  }

  /** Publicações que a pessoa curtiu (aba "Curtidas" do perfil). */
  async curtidasDe(usuarioId: string): Promise<Publicacao[]> {
    const eu = this.auth.usuario()?.id;
    if (!supabase) return this.demo.feed(eu).filter((p) => this.demo.curtiu(p.id, usuarioId));
    const { data, error } = await supabase
      .from('curtidas')
      .select(`publicacao:publicacoes(${SELECT_PUBLICACAO})`)
      .eq('usuario_id', usuarioId)
      .limit(50);
    if (error) throw new Error('Não foi possível carregar as curtidas.');
    return (data as Linha[])
      .map((c) => c['publicacao'])
      .filter((p) => p && !p['removida'])
      .map((p) => mapPublicacao(p, eu))
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
  }

  // ---------- Mural ----------
  async publicacoes(comunidadeId: number): Promise<Publicacao[]> {
    const eu = this.auth.usuario()?.id;
    if (!supabase) return this.demo.publicacoes(comunidadeId, eu);
    const { data, error } = await supabase
      .from('publicacoes')
      .select(SELECT_PUBLICACAO)
      .eq('comunidade_id', comunidadeId)
      .eq('removida', false)
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) throw new Error('Não foi possível carregar o mural.');
    return (data as Linha[]).map((p) => mapPublicacao(p, eu));
  }

  /** Feed da página inicial: publicações recentes de todas as comunidades. */
  async feed(limite = 30): Promise<Publicacao[]> {
    const eu = this.auth.usuario()?.id;
    if (!supabase) return this.demo.feed(eu).slice(0, limite);
    const { data, error } = await supabase
      .from('publicacoes')
      .select(SELECT_PUBLICACAO)
      .eq('removida', false)
      .order('criado_em', { ascending: false })
      .limit(limite);
    if (error) throw new Error('Não foi possível carregar o feed.');
    return (data as Linha[]).map((p) => mapPublicacao(p, eu));
  }

  async publicar(comunidadeId: number, texto: string, link: string | null): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.publicar(comunidadeId, texto, link, u);
    const { error } = await supabase
      .from('publicacoes')
      .insert({ comunidade_id: comunidadeId, autor_id: u.id, texto, link_url: link });
    if (error) throw new Error('Não foi possível publicar. Você precisa ser membro da comunidade.');
  }

  async comentarios(publicacaoId: number): Promise<Comentario[]> {
    if (!supabase) return this.demo.comentarios(publicacaoId);
    const { data, error } = await supabase
      .from('comentarios')
      .select('*, autor:perfis(id, nome, foto_url)')
      .eq('publicacao_id', publicacaoId)
      .eq('removido', false)
      .order('criado_em');
    if (error) throw new Error('Não foi possível carregar os comentários.');
    return (data as Linha[]).map((c) => ({
      id: c['id'],
      publicacao_id: c['publicacao_id'],
      autor: mapAutor(c['autor']),
      texto: c['texto'],
      removido: c['removido'],
      criado_em: c['criado_em'],
    }));
  }

  async comentar(publicacaoId: number, texto: string): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.comentar(publicacaoId, texto, u);
    const { error } = await supabase.from('comentarios').insert({ publicacao_id: publicacaoId, autor_id: u.id, texto });
    if (error) throw new Error('Não foi possível comentar. Você precisa ser membro da comunidade.');
  }

  async alternarCurtida(pub: Publicacao): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.alternarCurtida(pub.id, u.id);
    const q = pub.curtida_por_mim
      ? supabase.from('curtidas').delete().eq('publicacao_id', pub.id).eq('usuario_id', u.id)
      : supabase.from('curtidas').insert({ publicacao_id: pub.id, usuario_id: u.id });
    const { error } = await q;
    if (error) throw new Error('Não foi possível curtir agora.');
  }

  // ---------- Denúncias e moderação ----------
  async denunciar(alvo: { publicacao_id: number; comentario_id?: number }, motivo: string): Promise<void> {
    const u = this.exigirUsuario();
    const tipo = alvo.comentario_id ? 'comentario' : 'publicacao';
    if (!supabase) return this.demo.denunciar(tipo, alvo, motivo);
    const { error } = await supabase.from('denuncias').insert({
      tipo,
      publicacao_id: alvo.publicacao_id,
      comentario_id: alvo.comentario_id ?? null,
      denunciante_id: u.id,
      motivo,
    });
    if (error) throw new Error('Não foi possível enviar a denúncia.');
  }

  async denuncias(): Promise<Denuncia[]> {
    if (!supabase) return this.demo.denuncias();
    const { data, error } = await supabase
      .from('denuncias')
      .select('*, publicacao:publicacoes(texto, comunidade:comunidades(slug)), comentario:comentarios(texto)')
      .order('criado_em', { ascending: false });
    if (error) throw new Error('Não foi possível carregar as denúncias.');
    return (data as Linha[]).map((d) => ({
      id: d['id'],
      tipo: d['tipo'],
      publicacao_id: d['publicacao_id'],
      comentario_id: d['comentario_id'],
      motivo: d['motivo'],
      status: d['status'],
      decisao_motivo: d['decisao_motivo'],
      criado_em: d['criado_em'],
      conteudo: d['tipo'] === 'comentario' ? d['comentario']?.texto ?? '' : d['publicacao']?.texto ?? '',
      comunidade_slug: d['publicacao']?.comunidade?.slug ?? null,
    }));
  }

  /** A decisão é sempre humana: o moderador remove ou mantém e registra o motivo. */
  async decidir(d: Denuncia, status: Exclude<StatusDenuncia, 'aberta'>, motivo: string): Promise<void> {
    const u = this.exigirUsuario();
    if (!supabase) return this.demo.decidir(d, status, motivo);
    if (status === 'removido') {
      const r =
        d.tipo === 'comentario'
          ? await supabase.from('comentarios').update({ removido: true }).eq('id', d.comentario_id!)
          : await supabase.from('publicacoes').update({ removida: true }).eq('id', d.publicacao_id);
      if (r.error) throw new Error('Não foi possível remover o conteúdo.');
    }
    const { error } = await supabase
      .from('denuncias')
      .update({ status, decisao_motivo: motivo, moderador_id: u.id, resolvida_em: new Date().toISOString() })
      .eq('id', d.id);
    if (error) throw new Error('Não foi possível registrar a decisão.');
  }
}

const SELECT_PUBLICACAO =
  '*, autor:perfis(id, nome, foto_url), comunidade:comunidades(nome, slug, tema), curtidas(usuario_id), comentarios(count)';

function mapPublicacao(p: Linha, eu?: string): Publicacao {
  return {
    id: p['id'],
    comunidade_id: p['comunidade_id'],
    autor: mapAutor(p['autor']),
    texto: p['texto'],
    link_url: p['link_url'],
    verificada: p['verificada'] ?? false,
    removida: p['removida'],
    criado_em: p['criado_em'],
    total_curtidas: (p['curtidas'] ?? []).length,
    curtida_por_mim: (p['curtidas'] ?? []).some((c: Linha) => c['usuario_id'] === eu),
    total_comentarios: p['comentarios']?.[0]?.count ?? 0,
    comunidade_nome: p['comunidade']?.nome,
    comunidade_slug: p['comunidade']?.slug,
    comunidade_tema: p['comunidade']?.tema,
  };
}

function mapAutor(p: Linha | null): Autor {
  return { id: p?.['id'] ?? '', nome: p?.['nome'] ?? 'Usuário', foto_url: p?.['foto_url'] ?? null };
}

function mapComunidade(c: Linha): Comunidade {
  return {
    id: c['id'],
    slug: c['slug'],
    nome: c['nome'],
    tema: c['tema'] ?? '',
    descricao: c['descricao'] ?? '',
    regras: c['regras'] ?? '',
    criado_em: c['criado_em'],
    total_membros: c['comunidade_membros']?.[0]?.count ?? 0,
  };
}

// =====================================================================
// MODO DEMONSTRAÇÃO (dados no localStorage). Some quando o Supabase entrar.
// =====================================================================
export interface BancoDemo {
  comunidades: Omit<Comunidade, 'total_membros'>[];
  membros: { comunidade_id: number; usuario: Autor; papel: string }[];
  publicacoes: Omit<Publicacao, 'total_curtidas' | 'curtida_por_mim' | 'total_comentarios'>[];
  comentarios: Comentario[];
  curtidas: { publicacao_id: number; usuario_id: string }[];
  denuncias: Omit<Denuncia, 'conteudo' | 'comunidade_slug'>[];
  /** Slugs das comunidades extras já aplicadas neste navegador. */
  sementes?: string[];
}

const EQUIPE: Autor = { id: 'equipe', nome: 'Fato Real', foto_url: 'logo.svg' };
const EXEMPLO: Autor = { id: 'exemplo', nome: 'Participante (exemplo)', foto_url: null };
const REGRAS_PADRAO =
  '1. Respeite as pessoas: critique ideias, não ataque quem pensa diferente.\n' +
  '2. Ao afirmar um fato, cite a fonte (de preferência oficial).\n' +
  '3. Opinião é bem-vinda e não é desinformação.\n' +
  '4. Não publique conteúdo sabidamente falso nem dados pessoais de outras pessoas.\n' +
  '5. Denuncie o que violar estas regras: a moderação humana analisa.';

function bancoInicial(): BancoDemo {
  const agora = new Date().toISOString();
  const haHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
  const com = (id: number, nome: string, tema: string, descricao: string) => ({
    id, slug: gerarSlug(nome), nome, tema, descricao, regras: REGRAS_PADRAO, criado_em: agora,
  });
  return {
    comunidades: [
      com(1, 'Política Brasileira', 'Política', 'Debate sobre o Congresso, o governo e as eleições, sempre com fontes.'),
      com(2, 'Educação para Todos', 'Educação', 'Educação pública, escolas, universidades e políticas educacionais.'),
      com(3, 'Direitos e Cidadania', 'Cidadania', 'Direitos do cidadão, serviços públicos e participação social.'),
    ],
    membros: [
      ...[1, 2, 3].map((id) => ({ comunidade_id: id, usuario: EQUIPE, papel: 'moderador' })),
      { comunidade_id: 1, usuario: EXEMPLO, papel: 'membro' },
    ],
    publicacoes: [
      {
        id: 3, comunidade_id: 1, autor: EXEMPLO, verificada: false, removida: false, criado_em: haHoras(1),
        texto: 'E vocês, onde costumam conferir se uma notícia sobre política é verdadeira? Vamos trocar fontes confiáveis nos comentários!',
        link_url: null,
      },
      {
        id: 4, comunidade_id: 2, autor: EQUIPE, verificada: true, removida: false, criado_em: haHoras(3),
        texto: 'O Censo Escolar é feito todo ano pelo Inep e reúne dados de matrículas, escolas e professores de todo o país.',
        link_url: 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/censo-escolar',
      },
      {
        id: 1, comunidade_id: 1, autor: EQUIPE, verificada: true, removida: false, criado_em: haHoras(4),
        texto: 'A Câmara dos Deputados tem 513 deputados federais, eleitos para mandatos de 4 anos. Os dados de cada um estão no portal de Dados Abertos.',
        link_url: 'https://dadosabertos.camara.leg.br/',
      },
      {
        id: 2, comunidade_id: 3, autor: EQUIPE, verificada: true, removida: false, criado_em: haHoras(6),
        texto: 'A Constituição Federal de 1988 pode ser lida na íntegra no site oficial do Planalto.',
        link_url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
      },
    ],
    comentarios: [],
    curtidas: [],
    denuncias: [],
  };
}

/**
 * Comunidades temáticas acrescentadas depois da primeira versão. São mescladas no banco
 * já salvo no navegador (pelo slug), para quem já usava o site também vê-las.
 */
const SEMENTES_EXTRAS: { nome: string; tema: string; descricao: string; post?: { texto: string; link_url: string | null; verificada: boolean } }[] = [
  {
    nome: 'Eleições e Voto', tema: 'Política',
    descricao: 'Calendário eleitoral, regras do TSE, urna eletrônica e como conferir candidaturas.',
    post: { verificada: true, texto: 'No DivulgaCandContas, do TSE, dá para consultar candidaturas, bens declarados e prestação de contas de campanha.', link_url: 'https://divulgacandcontas.tse.jus.br/' },
  },
  {
    nome: 'Câmara e Senado em Pauta', tema: 'Política',
    descricao: 'Acompanhe projetos, votações e comissões do Congresso Nacional, com link para a tramitação oficial.',
    post: { verificada: true, texto: 'Toda proposição na Câmara tem uma ficha de tramitação pública: autor, relator, pareceres e votações.', link_url: 'https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada' },
  },
  {
    nome: 'Política na Minha Cidade', tema: 'Política',
    descricao: 'Câmaras municipais, prefeituras e orçamento local. O que é decidido perto de você.',
    post: { verificada: true, texto: 'Pela Lei de Acesso à Informação (Lei 12.527/2011), qualquer pessoa pode pedir dados públicos à prefeitura ou à câmara municipal, sem precisar justificar.', link_url: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm' },
  },
  {
    nome: 'Checagem de Fatos', tema: 'Cidadania',
    descricao: 'Recebeu um boato? Traga aqui para a comunidade conferir junto, sempre com fonte.',
    post: { verificada: false, texto: 'Vi um vídeo dizendo que dá para votar pela internet nas próximas eleições. Alguém achou alguma fonte oficial sobre isso?', link_url: null },
  },
  {
    nome: 'Contas Públicas', tema: 'Economia',
    descricao: 'Orçamento, impostos, gastos do governo e cota parlamentar, com dados abertos.',
    post: { verificada: true, texto: 'O Portal da Transparência mostra despesas, transferências e servidores do governo federal, com dados para baixar.', link_url: 'https://portaldatransparencia.gov.br/' },
  },
  {
    nome: 'Saúde Pública e SUS', tema: 'Saúde',
    descricao: 'Políticas de saúde, vacinação e funcionamento do SUS, com informação oficial.',
    post: { verificada: true, texto: 'O calendário nacional de vacinação, por idade, fica no site do Ministério da Saúde.', link_url: 'https://www.gov.br/saude/pt-br/vacinacao' },
  },
  {
    nome: 'Meio Ambiente e Clima', tema: 'Meio ambiente',
    descricao: 'Desmatamento, clima, energia e as leis ambientais em debate no país.',
    post: { verificada: true, texto: 'Os dados oficiais de desmatamento da Amazônia (Prodes e Deter) são publicados pelo Inpe na plataforma TerraBrasilis.', link_url: 'https://terrabrasilis.dpi.inpe.br/' },
  },
  {
    nome: 'Segurança Pública', tema: 'Segurança',
    descricao: 'Políticas de segurança, dados de violência e o papel de cada esfera de governo.',
    post: { verificada: true, texto: 'O Anuário Brasileiro de Segurança Pública reúne, todo ano, os dados oficiais de violência de todos os estados.', link_url: 'https://forumseguranca.org.br/' },
  },
  {
    nome: 'Tecnologia e Democracia', tema: 'Tecnologia',
    descricao: 'Desinformação, inteligência artificial, privacidade (LGPD) e regras para as plataformas.',
    post: { verificada: true, texto: 'A LGPD (Lei 13.709/2018) define seus direitos sobre dados pessoais: saber quem usa, corrigir e pedir a exclusão.', link_url: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm' },
  },
  {
    nome: 'Juventude e Participação', tema: 'Cidadania',
    descricao: 'Para quem vota pela primeira vez: título de eleitor, conselhos, grêmios e como participar.',
    post: { verificada: true, texto: 'O voto é facultativo a partir dos 16 anos. O título de eleitor pode ser tirado pela internet, no autoatendimento da Justiça Eleitoral.', link_url: 'https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral' },
  },
];

function completarSementes(db: BancoDemo): BancoDemo {
  const aplicadas = new Set(db.sementes ?? []);
  let mudou = false;
  SEMENTES_EXTRAS.forEach((sem, i) => {
    const slug = gerarSlug(sem.nome);
    if (aplicadas.has(slug)) return;
    aplicadas.add(slug);
    mudou = true;
    if (db.comunidades.some((c) => c.slug === slug)) return;
    const id = proximoId(db.comunidades);
    db.comunidades.push({ id, slug, nome: sem.nome, tema: sem.tema, descricao: sem.descricao, regras: REGRAS_PADRAO, criado_em: new Date().toISOString() });
    db.membros.push({ comunidade_id: id, usuario: EQUIPE, papel: 'moderador' });
    if (i % 3 === 0) db.membros.push({ comunidade_id: id, usuario: EXEMPLO, papel: 'membro' });
    if (sem.post) {
      db.publicacoes.push({
        id: proximoId(db.publicacoes), comunidade_id: id, autor: sem.post.verificada ? EQUIPE : EXEMPLO,
        verificada: sem.post.verificada, removida: false, texto: sem.post.texto, link_url: sem.post.link_url,
        criado_em: new Date(Date.now() - (8 + i * 5) * 3600_000).toISOString(),
      });
    }
  });
  // Pessoas de exemplo: entram nas comunidades e publicam (uma vez por navegador)
  if (!aplicadas.has('pessoas-1')) {
    aplicadas.add('pessoas-1');
    mudou = true;
    for (const pub of PUBLICACOES_EXEMPLO) {
      const c = db.comunidades.find((x) => x.slug === pub.comunidade);
      const pessoa = PESSOAS_EXEMPLO.find((x) => x.id === pub.autor);
      if (!c || !pessoa) continue;
      const autor = { id: pessoa.id, nome: pessoa.nome, foto_url: pessoa.foto_url };
      if (!db.membros.some((m) => m.comunidade_id === c.id && m.usuario.id === autor.id)) {
        db.membros.push({ comunidade_id: c.id, usuario: autor, papel: 'membro' });
      }
      db.publicacoes.push({
        id: proximoId(db.publicacoes), comunidade_id: c.id, autor, verificada: false, removida: false,
        texto: pub.texto, link_url: pub.link_url, criado_em: new Date(Date.now() - pub.horas * 3600_000).toISOString(),
      });
    }
  }
  db.sementes = [...aplicadas];
  if (mudou) salvarDemo('social-v2', db);
  return db;
}

/** Leitura do banco do modo demonstração (usado também pelas notificações). */
export function lerBancoSocial(): BancoDemo {
  return completarSementes(lerDemo<BancoDemo>('social-v2', bancoInicial()));
}

class DemoSocial {
  private get db(): BancoDemo {
    return lerBancoSocial();
  }
  private salvar(db: BancoDemo) {
    salvarDemo('social-v2', db);
  }
  private comTotal(db: BancoDemo, c: Omit<Comunidade, 'total_membros'>): Comunidade {
    return { ...c, total_membros: db.membros.filter((m) => m.comunidade_id === c.id).length };
  }

  listar(termo: string): Comunidade[] {
    const db = this.db;
    const t = termo.trim().toLowerCase();
    return db.comunidades
      .filter((c) => !t || c.nome.toLowerCase().includes(t) || c.tema.toLowerCase().includes(t))
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((c) => this.comTotal(db, c));
  }
  obter(slug: string): Comunidade | null {
    const db = this.db;
    const c = db.comunidades.find((x) => x.slug === slug);
    return c ? this.comTotal(db, c) : null;
  }
  criar(dados: { nome: string; slug: string; tema: string; descricao: string; regras: string }, usuarioId: string): Comunidade {
    const db = this.db;
    if (db.comunidades.some((c) => c.slug === dados.slug)) throw new Error('Já existe uma comunidade com esse nome.');
    const nova = { ...dados, id: proximoId(db.comunidades), criado_em: new Date().toISOString() };
    db.comunidades.push(nova);
    db.membros.push({ comunidade_id: nova.id, usuario: this.autor(usuarioId), papel: 'moderador' });
    this.salvar(db);
    return this.comTotal(db, nova);
  }
  ehMembro(comunidadeId: number, usuarioId: string): boolean {
    return this.db.membros.some((m) => m.comunidade_id === comunidadeId && m.usuario.id === usuarioId);
  }
  entrar(comunidadeId: number, usuarioId: string) {
    const db = this.db;
    if (!this.ehMembro(comunidadeId, usuarioId)) {
      db.membros.push({ comunidade_id: comunidadeId, usuario: this.autor(usuarioId), papel: 'membro' });
      this.salvar(db);
    }
  }
  sair(comunidadeId: number, usuarioId: string) {
    const db = this.db;
    db.membros = db.membros.filter((m) => !(m.comunidade_id === comunidadeId && m.usuario.id === usuarioId));
    this.salvar(db);
  }
  membros(comunidadeId: number) {
    return this.db.membros.filter((m) => m.comunidade_id === comunidadeId).map((m) => ({ ...m.usuario, papel: m.papel }));
  }
  curtiu(publicacaoId: number, usuarioId: string): boolean {
    return this.db.curtidas.some((c) => c.publicacao_id === publicacaoId && c.usuario_id === usuarioId);
  }
  minhas(usuarioId: string): Comunidade[] {
    const db = this.db;
    const ids = db.membros.filter((m) => m.usuario.id === usuarioId).map((m) => m.comunidade_id);
    return db.comunidades.filter((c) => ids.includes(c.id)).map((c) => this.comTotal(db, c));
  }
  publicacoes(comunidadeId: number, eu?: string): Publicacao[] {
    return this.feed(eu).filter((p) => p.comunidade_id === comunidadeId);
  }
  feed(eu?: string): Publicacao[] {
    const db = this.db;
    return db.publicacoes
      .filter((p) => !p.removida)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map((p) => {
        const c = db.comunidades.find((x) => x.id === p.comunidade_id);
        return {
          ...p,
          total_curtidas: db.curtidas.filter((x) => x.publicacao_id === p.id).length,
          curtida_por_mim: db.curtidas.some((x) => x.publicacao_id === p.id && x.usuario_id === eu),
          total_comentarios: db.comentarios.filter((x) => x.publicacao_id === p.id && !x.removido).length,
          comunidade_nome: c?.nome,
          comunidade_slug: c?.slug,
          comunidade_tema: c?.tema,
        };
      });
  }
  publicar(comunidadeId: number, texto: string, link: string | null, u: Autor) {
    const db = this.db;
    if (!db.membros.some((m) => m.comunidade_id === comunidadeId && m.usuario.id === u.id)) {
      throw new Error('Entre na comunidade para publicar.');
    }
    db.publicacoes.push({
      id: proximoId(db.publicacoes), comunidade_id: comunidadeId, texto, link_url: link,
      autor: { id: u.id, nome: u.nome, foto_url: u.foto_url }, verificada: false, removida: false,
      criado_em: new Date().toISOString(),
    });
    this.salvar(db);
  }
  comentarios(publicacaoId: number): Comentario[] {
    return this.db.comentarios.filter((c) => c.publicacao_id === publicacaoId && !c.removido);
  }
  comentar(publicacaoId: number, texto: string, u: Autor) {
    const db = this.db;
    db.comentarios.push({
      id: proximoId(db.comentarios), publicacao_id: publicacaoId, texto, removido: false,
      autor: { id: u.id, nome: u.nome, foto_url: u.foto_url }, criado_em: new Date().toISOString(),
    });
    this.salvar(db);
  }
  alternarCurtida(publicacaoId: number, usuarioId: string) {
    const db = this.db;
    const i = db.curtidas.findIndex((c) => c.publicacao_id === publicacaoId && c.usuario_id === usuarioId);
    if (i >= 0) db.curtidas.splice(i, 1);
    else db.curtidas.push({ publicacao_id: publicacaoId, usuario_id: usuarioId });
    this.salvar(db);
  }
  denunciar(tipo: 'publicacao' | 'comentario', alvo: { publicacao_id: number; comentario_id?: number }, motivo: string) {
    const db = this.db;
    db.denuncias.push({
      id: proximoId(db.denuncias), tipo, publicacao_id: alvo.publicacao_id, comentario_id: alvo.comentario_id ?? null,
      motivo, status: 'aberta', decisao_motivo: null, criado_em: new Date().toISOString(),
    });
    this.salvar(db);
  }
  denuncias(): Denuncia[] {
    const db = this.db;
    return [...db.denuncias].reverse().map((d) => {
      const pub = db.publicacoes.find((p) => p.id === d.publicacao_id);
      const com = db.comentarios.find((c) => c.id === d.comentario_id);
      return {
        ...d,
        conteudo: (d.tipo === 'comentario' ? com?.texto : pub?.texto) ?? '',
        comunidade_slug: db.comunidades.find((c) => c.id === pub?.comunidade_id)?.slug ?? null,
      };
    });
  }
  decidir(d: Denuncia, status: StatusDenuncia, motivo: string) {
    const db = this.db;
    if (status === 'removido') {
      if (d.tipo === 'comentario') db.comentarios.forEach((c) => c.id === d.comentario_id && (c.removido = true));
      else db.publicacoes.forEach((p) => p.id === d.publicacao_id && (p.removida = true));
    }
    db.denuncias.forEach((x) => {
      if (x.id === d.id) {
        x.status = status;
        x.decisao_motivo = motivo;
      }
    });
    this.salvar(db);
  }

  private autor(usuarioId: string): Autor {
    const u = lerDemo<Autor | null>('usuario', null);
    return u && u.id === usuarioId ? { id: u.id, nome: u.nome, foto_url: u.foto_url } : { id: usuarioId, nome: 'Usuário' };
  }
}
