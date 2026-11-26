import { Injectable } from '@angular/core';
import { LISTA_ATUALIZADA_EM, Noticia, NOTICIAS } from './noticias';
import { apiUrl } from './supabase';

/**
 * O back-end ainda não tem a rota GET /api/noticias (26 nov. 2026): chamar dava 404 vermelho no console.
 * Quando o João criar a rota, troque para true.
 */
const FEED_NOTICIAS_ATIVO = false;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "12 nov. 2026" ou "nov. 2026" → número para ordenar (mais nova primeiro). */
function ordem(n: Noticia & { quando?: string }): number {
  if (n.quando) return Date.parse(n.quando) || 0;
  const m = n.data.toLowerCase().match(/(?:(\d{1,2})\s+)?([a-zç]{3})[a-z.]*\s+(\d{4})/);
  if (!m) return 0;
  return new Date(Number(m[3]), Math.max(0, MESES.indexOf(m[2])), Number(m[1] ?? 1), 12).getTime();
}

/**
 * Lista de notícias da aba Notícias.
 *
 * 1º) Feed automático do back-end, quando existir:
 *     GET {API_URL}/noticias  →  200 [{ titulo, resumo?, categoria, data, fonte, url, imagem?, pergunta?, destaque? }]
 * 2º) Reserva: public/dados/noticias.json (títulos e links reais dos feeds RSS oficiais, gerado por
 *     scripts/dados/gerar-noticias.py) + a seleção da equipe (core/noticias.ts, com resumos lidos).
 */
@Injectable({ providedIn: 'root' })
export class NoticiasService {
  async carregar(): Promise<{ lista: Noticia[]; aoVivo: boolean; atualizadaEm: string }> {
    if (FEED_NOTICIAS_ATIVO) try {
      const resp = await fetch(`${apiUrl}/noticias`, { signal: AbortSignal.timeout(4000) });
      if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
        const dados = (await resp.json()) as Noticia[];
        if (Array.isArray(dados) && dados.length && dados.every((n) => n.titulo && n.url && n.fonte)) {
          return { lista: dados, aoVivo: true, atualizadaEm: '' };
        }
      }
    } catch {
      /* sem back-end: segue com a reserva */
    }
    let oficiais: (Noticia & { quando?: string })[] = [];
    let atualizadaEm = LISTA_ATUALIZADA_EM;
    try {
      const resp = await fetch('dados/noticias.json');
      if (resp.ok) {
        const arq = (await resp.json()) as { gerado_em: string | null; noticias: (Noticia & { quando?: string })[] };
        oficiais = arq.noticias.filter((n) => n.titulo && n.url?.startsWith('https://') && n.fonte);
        if (arq.gerado_em) {
          const d = new Date(arq.gerado_em);
          atualizadaEm = `${d.getDate()} ${MESES[d.getMonth()]}${d.getMonth() === 4 ? '' : '.'} ${d.getFullYear()}`.replace('mai.', 'maio');
        }
      }
    } catch {
      /* sem o arquivo: fica só a seleção da equipe */
    }
    // Junta sem repetir (a seleção da equipe ganha, porque tem resumo e pergunta) e ordena da mais nova para a mais antiga
    const urls = new Set(NOTICIAS.map((n) => n.url));
    const lista = [...NOTICIAS, ...oficiais.filter((n) => !urls.has(n.url))].sort((a, b) => ordem(b) - ordem(a));
    return { lista, aoVivo: false, atualizadaEm };
  }
}
