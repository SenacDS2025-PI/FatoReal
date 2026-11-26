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
  // Imagem enviada do computador/celular (já reduzida pelo site)
  if (/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  return linkSeguro(url);
}

/** "agora", "5 min atrás", "3h atrás", "2 dias atrás" ou a data. */
export function tempoAtras(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min atrás`;
  if (s < 86400) return `${Math.floor(s / 3600)}h atrás`;
  if (s < 7 * 86400) return `${plural(Math.floor(s / 86400), 'dia', 'dias')} atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Se o link é de um órgão oficial, devolve o nome dele (Câmara, Senado, TSE...). Senão, null. */
export function fonteOficial(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const host = new URL(link).hostname.replace(/^www\d*\./, '');
    const oficiais: [RegExp, string][] = [[/(^|\.)camara\.leg\.br$/, 'Câmara dos Deputados'], [/(^|\.)senado\.leg\.br$/, 'Senado Federal'], [/(^|\.)tse\.jus\.br$/, 'Tribunal Superior Eleitoral'],
      [/(^|\.)stf\.jus\.br$/, 'Supremo Tribunal Federal'], [/(^|\.)ibge\.gov\.br$/, 'IBGE'], [/(^|\.)ebc\.com\.br$/, 'Agência Brasil'], [/(^|\.)gov\.br$/, 'Governo federal'],
      [/\.leg\.br$/, 'Poder Legislativo'], [/\.jus\.br$/, 'Poder Judiciário'], [/\.mp\.br$/, 'Ministério Público']];
    return oficiais.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Id aleatório. crypto.randomUUID só existe em navegador recente e em endereço https: senão, monta um parecido. */
export function novoId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* sem randomUUID: segue abaixo */
  }
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}

/** "1 membro" / "5 membros": singular e plural certos, sem o "(s)". */
export function plural(n: number | null | undefined, um: string, varios: string): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString('pt-BR')} ${v === 1 ? um : varios}`;
}
