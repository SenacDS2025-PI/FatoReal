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
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  foto_url?: string | null;
  moderador: boolean;
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
}

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
