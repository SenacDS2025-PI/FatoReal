// Imagens das comunidades (recortes da apresentação visual) e listas usadas na interface.

const IMAGENS: Record<string, { avatar: string; capa: string }> = {
  'politica-brasileira': { avatar: 'img/com-politica.svg', capa: 'img/destaque-bandeira.svg' },
  'direitos-e-cidadania': { avatar: 'img/com-direitos.svg', capa: 'img/brasil-juntos.svg' },
  'educacao-para-todos': { avatar: 'img/com-educacao.svg', capa: 'img/destaque-congresso.svg' },
};

/** Capas ilustradas das comunidades temáticas (o ícone quadrado continua na cor do tema). */
const CAPAS_SLUG = [
  'eleicoes-e-voto', 'camara-e-senado-em-pauta', 'politica-na-minha-cidade', 'checagem-de-fatos', 'contas-publicas',
  'saude-publica-e-sus', 'meio-ambiente-e-clima', 'seguranca-publica', 'tecnologia-e-democracia', 'juventude-e-participacao',
];

/** Capa padrão por tema, para comunidades criadas pelos usuários. */
const CAPA_TEMA: Record<string, string> = {
  Política: 'img/capa-camara-e-senado-em-pauta.svg',
  Educação: 'img/destaque-congresso.svg',
  Cidadania: 'img/capa-juventude-e-participacao.svg',
  Economia: 'img/capa-contas-publicas.svg',
  Saúde: 'img/capa-saude-publica-e-sus.svg',
  'Meio ambiente': 'img/capa-meio-ambiente-e-clima.svg',
  Segurança: 'img/capa-seguranca-publica.svg',
  Tecnologia: 'img/capa-tecnologia-e-democracia.svg',
};

export function avatarComunidade(slug?: string | null): string | null {
  return (slug && IMAGENS[slug]?.avatar) || null;
}

/** Toda comunidade tem capa: a própria, a ilustrada do slug ou a do tema. */
export function capaComunidade(slug?: string | null, tema?: string | null): string | null {
  if (slug && IMAGENS[slug]?.capa) return IMAGENS[slug].capa;
  if (slug && CAPAS_SLUG.includes(slug)) return `img/capa-${slug}.svg`;
  return (tema && CAPA_TEMA[tema]) || 'img/destaque-bandeira.svg';
}

/** Ícone (Material Symbols) para cada tema, usado quando a comunidade não tem imagem. */
export const ICONE_TEMA: Record<string, string> = {
  Política: 'account_balance',
  Educação: 'school',
  Cidadania: 'balance',
  Economia: 'payments',
  Saúde: 'health_and_safety',
  'Meio ambiente': 'forest',
  Segurança: 'local_police',
  Tecnologia: 'memory',
};

/** Cor de cada tema: capa e ícone das comunidades que não têm imagem própria. */
export const COR_TEMA: Record<string, string> = {
  Política: '#1f4fbf',
  Educação: '#6a3fc7',
  Cidadania: '#0b7a55',
  Economia: '#a8650a',
  Saúde: '#c0353f',
  'Meio ambiente': '#2f7d32',
  Segurança: '#34495e',
  Tecnologia: '#0e7490',
};

/** Faixa de categorias do topo da página inicial (filtra o feed pelo tema da comunidade). */
export const CATEGORIAS = ['Política', 'Economia', 'Educação', 'Saúde', 'Tecnologia', 'Cidadania'];
