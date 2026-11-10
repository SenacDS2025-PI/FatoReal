// Imagens das comunidades (recortes da apresentação visual) e listas usadas na interface.

const IMAGENS: Record<string, { avatar: string; capa: string }> = {
  'politica-brasileira': { avatar: 'img/com-politica.svg', capa: 'img/destaque-bandeira.svg' },
  'direitos-e-cidadania': { avatar: 'img/com-direitos.svg', capa: 'img/brasil-juntos.svg' },
  'educacao-para-todos': { avatar: 'img/com-educacao.svg', capa: 'img/destaque-congresso.svg' },
};

export function avatarComunidade(slug?: string | null): string | null {
  return (slug && IMAGENS[slug]?.avatar) || null;
}

export function capaComunidade(slug?: string | null): string | null {
  return (slug && IMAGENS[slug]?.capa) || null;
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

/** Faixa de categorias do topo da página inicial (filtra o feed pelo tema da comunidade). */
export const CATEGORIAS = ['Política', 'Economia', 'Educação', 'Saúde', 'Tecnologia', 'Cidadania'];
