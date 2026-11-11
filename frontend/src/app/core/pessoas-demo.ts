// Pessoas de exemplo do MODO DEMONSTRAÇÃO (sem Supabase). Servem para testar perfis, seguir e o feed.
// Todas têm "(exemplo)" no nome para não serem confundidas com pessoas reais.
import { PerfilPublico } from './modelos';

export const PESSOAS_EXEMPLO: PerfilPublico[] = [
  {
    id: 'equipe', nome: 'Fato Real', foto_url: 'logo.svg', moderador: true, capa: 'verde',
    bio: 'Perfil oficial do Fato Real. Publicamos informação com fonte oficial e data.', cidade: null, uf: null,
    criado_em: '2026-08-01T12:00:00Z',
  },
  {
    id: 'ex-ana', nome: 'Ana Ribeiro (exemplo)', foto_url: null, moderador: false, capa: 'roxo',
    bio: 'Professora de história. Gosto de explicar como funciona o Congresso.', cidade: 'Salvador', uf: 'BA',
    criado_em: '2026-09-12T12:00:00Z',
  },
  {
    id: 'ex-bruno', nome: 'Bruno Tavares (exemplo)', foto_url: null, moderador: false, capa: 'azul',
    bio: 'Estudante de economia. Acompanho as contas públicas e a cota parlamentar.', cidade: 'Belo Horizonte', uf: 'MG',
    criado_em: '2026-10-03T12:00:00Z',
  },
  {
    id: 'ex-carla', nome: 'Carla Nogueira (exemplo)', foto_url: null, moderador: false, capa: 'laranja',
    bio: 'Jornalista em formação, apaixonada por checagem de fatos.', cidade: 'Porto Alegre', uf: 'RS',
    criado_em: '2026-10-20T12:00:00Z',
  },
];

/** Quem segue quem no início da demonstração. */
export const SEGUIR_EXEMPLO: { seguidor: string; seguido: string }[] = [
  { seguidor: 'ex-ana', seguido: 'equipe' },
  { seguidor: 'ex-bruno', seguido: 'equipe' },
  { seguidor: 'ex-carla', seguido: 'equipe' },
  { seguidor: 'ex-carla', seguido: 'ex-ana' },
  { seguidor: 'ex-ana', seguido: 'ex-carla' },
  { seguidor: 'ex-bruno', seguido: 'ex-ana' },
];

/** Publicações das pessoas de exemplo (comunidade pelo slug). */
export const PUBLICACOES_EXEMPLO: { autor: string; comunidade: string; texto: string; link_url: string | null; horas: number }[] = [
  {
    autor: 'ex-ana', comunidade: 'camara-e-senado-em-pauta', horas: 5, link_url: 'https://www.camara.leg.br/',
    texto: 'Dica para quem está começando: nas votações nominais da Câmara, o voto de cada deputado fica registrado e pode ser consultado no site oficial.',
  },
  {
    autor: 'ex-bruno', comunidade: 'contas-publicas', horas: 9, link_url: null,
    texto: 'Vocês sabiam que dá para ver quanto cada deputado gastou da cota parlamentar? Aqui no Fato Real aparece no perfil de cada um, em Candidatos.',
  },
  {
    autor: 'ex-carla', comunidade: 'checagem-de-fatos', horas: 14, link_url: null,
    texto: 'Antes de compartilhar o print de uma notícia, procurem a matéria no site do próprio veículo. Print sem link é o formato preferido de boato.',
  },
];
