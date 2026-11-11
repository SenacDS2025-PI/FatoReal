/** "Política Brasileira" → "politica-brasileira" */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Aceita só links http(s), para não exibir "javascript:" e afins. */
export function linkSeguro(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

/** Imagem segura: link http(s) ou arquivo do próprio site (ex.: "img/x.svg"). */
export function imagemSegura(url?: string | null): string | null {
  if (!url) return null;
  if (/^[a-z0-9/_.-]+$/i.test(url) && !url.includes('..')) return url;
  return linkSeguro(url);
}

/** "agora", "5 min atrás", "3h atrás", "2 dias atrás" ou a data. */
export function tempoAtras(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} dia(s) atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
