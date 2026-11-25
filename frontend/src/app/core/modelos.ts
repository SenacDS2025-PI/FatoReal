// Tipos usados em todo o front. Os nomes dos campos seguem as tabelas do Supabase (supabase/schema.sql).

export interface Fonte {
  titulo: string;
  url: string;
  /** Data em que o dado foi coletado/consultado (ISO). */
  data?: string | null;
}

export interface Politico {
  id: number; // id do deputado na API da Câmara
  nome: string;
  nome_civil?: string | null;
  partido?: string | null;
  uf?: string | null;
  cargo?: string | null;
  foto_url?: string | null;
  email?: string | null;
  situacao?: string | null;
  escolaridade?: string | null;
  data_nascimento?: string | null;
  municipio_nascimento?: string | null;
  fonte_url: string;
  data_coleta?: string | null;
  /** De onde vem o dado: Câmara, Senado ou TSE (eleitos importados pela equipe). */
  casa?: 'camara' | 'senado' | 'tse';
  /** Só Prefeito(a), Vice-prefeito(a) e Vereador(a) (dados do TSE). */
  municipio?: string | null;
}

export type TipoAlerta =
  | 'Condenação'
  | 'Processo em andamento'
  | 'Investigação'
  | 'Inelegibilidade'
  | 'Cassação'
  | 'Sanção administrativa'
  | 'Polêmica'
  | 'Absolvição ou arquivamento';

/** Polêmica ou registro jurídico/administrativo de um político. Sempre com link para a fonte. */
export interface AlertaJuridico {
  id: number;
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  /** Tribunal, órgão ou veículo que publicou (STF, TSE, TCU, Agência Brasil etc.). */
  orgao: string;
  data?: string | null;
  fonte_url: string;
  /** true = levantado pela equipe e fixo no código (não pode ser apagado pelo site). */
  verificado?: boolean;
}

/** Redes sociais do perfil (nome de usuário ou link; WhatsApp = número). */
export interface Redes {
  instagram?: string | null;
  tiktok?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  x?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  foto_url?: string | null;
  moderador: boolean;
  /** Frase curta de apresentação (até 160 caracteres). */
  bio?: string | null;
  criado_em?: string | null;
  cidade?: string | null;
  uf?: string | null;
  /** Cor da capa do perfil (chave de CAPAS em perfis.service.ts). */
  capa?: string | null;
  /** Profissão ou ocupação (estilo LinkedIn). */
  profissao?: string | null;
  /** Temas de interesse (Política, Educação...). */
  interesses?: string[] | null;
  redes?: Redes | null;
  /** Imagem de capa enviada pela pessoa (link https ou imagem reduzida em data URL). */
  capa_url?: string | null;
}

/** Dados de perfil que qualquer pessoa pode ver (sem e-mail). */
export interface PerfilPublico {
  id: string;
  nome: string;
  foto_url?: string | null;
  bio?: string | null;
  cidade?: string | null;
  uf?: string | null;
  capa?: string | null;
  moderador: boolean;
  criado_em?: string | null;
  /** Profissão ou ocupação (estilo LinkedIn). */
  profissao?: string | null;
  /** Temas de interesse (Política, Educação...). */
  interesses?: string[] | null;
  redes?: Redes | null;
  /** Imagem de capa enviada pela pessoa (link https ou imagem reduzida em data URL). */
  capa_url?: string | null;
}

export interface Autor {
  id: string;
  nome: string;
  foto_url?: string | null;
}

export interface Comunidade {
  id: number;
  slug: string;
  nome: string;
  tema: string;
  descricao: string;
  regras: string;
  criado_em: string;
  total_membros: number;
}

export interface Publicacao {
  id: number;
  comunidade_id: number;
  autor: Autor;
  texto: string;
  link_url?: string | null;
  /** true = informação verificada pela plataforma; false = publicação de usuário. */
  verificada: boolean;
  removida: boolean;
  criado_em: string;
  total_curtidas: number;
  curtida_por_mim: boolean;
  total_comentarios: number;
  /** Preenchidos no feed da página inicial (publicações de várias comunidades). */
  comunidade_nome?: string;
  comunidade_slug?: string;
  comunidade_tema?: string;
  /** Foto ou imagem do meme (no modo demonstração, imagem reduzida em data URL). */
  imagem_url?: string | null;
  /** Meme: textos por cima da imagem. Sempre marcado como "Meme" no card (piada não é informação). */
  meme?: { topo: string; base: string } | null;
  /** Checagem do Fato ou Fake compartilhada no feed. */
  checagem?: { afirmacao: string; estado: string; resumo: string; fonte?: { titulo: string; url: string } | null } | null;
}

/** Extras opcionais ao publicar. */
export type ExtrasPublicacao = Pick<Publicacao, 'imagem_url' | 'meme' | 'checagem'>;

export interface Comentario {
  id: number;
  publicacao_id: number;
  autor: Autor;
  texto: string;
  removido: boolean;
  criado_em: string;
}

export type StatusDenuncia = 'aberta' | 'removido' | 'mantido';

export interface Denuncia {
  id: number;
  tipo: 'publicacao' | 'comentario';
  publicacao_id: number;
  comentario_id?: number | null;
  motivo: string;
  status: StatusDenuncia;
  decisao_motivo?: string | null;
  criado_em: string;
  /** Texto do conteúdo denunciado, para o moderador ler. */
  conteudo: string;
  comunidade_slug?: string | null;
}

export interface RespostaFatoBot {
  resposta: string;
  fontes: Fonte[];
  consultado_em: string;
  sem_evidencia: boolean;
}
