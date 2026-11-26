import { inject, Injectable } from '@angular/core';
import { ComunidadesService } from './comunidades.service';
import { GLOSSARIO } from './glossario';
import { infoCategoria, NOTICIAS } from './noticias';
import { avatarComunidade, capaComunidade } from './visual';
import { rotaPolitico, todosDoCargo } from './politicos.service';

export type TipoResultado = 'politico' | 'comunidade' | 'termo' | 'noticia' | 'pagina';

export interface ResultadoBusca {
  tipo: TipoResultado;
  titulo: string;
  detalhe: string;
  icone: string;
  /** Rota interna (array do routerLink) ou link externo. */
  rota?: (string | number)[];
  query?: Record<string, string>;
  externo?: string;
  foto?: string | null;
  /** Imagem do cartão (capa da notícia, capa da comunidade). */
  imagem?: string | null;
  /** Ação especial em vez de navegar (ex.: abrir a bolinha do FatoBot). */
  acao?: 'fatobot';
  /** Selo de status mostrado ao lado do resultado. */
  selo?: 'verificado' | 'confiavel';
}

const PAGINAS: ResultadoBusca[] = [
  { tipo: 'pagina', titulo: 'Políticos', detalhe: 'Deputados, senadores e outros representantes', icone: 'account_balance', rota: ['/politicos'] },
  { tipo: 'pagina', titulo: 'Congresso em ação', detalhe: 'Agenda, votações e leis aprovadas', icone: 'gavel', rota: ['/congresso'] },
  { tipo: 'pagina', titulo: 'Ranking de gastos', detalhe: 'Cota parlamentar por estado', icone: 'leaderboard', rota: ['/politicos/gastos'] },
  { tipo: 'pagina', titulo: 'Eleições', detalhe: 'Contagem, como votar e comparar deputados', icone: 'how_to_vote', rota: ['/eleicoes'] },
  { tipo: 'pagina', titulo: 'Comparar deputados', detalhe: 'Dois deputados lado a lado (área de Eleições)', icone: 'compare_arrows', rota: ['/eleicoes/comparar'] },
  { tipo: 'pagina', titulo: 'Fato ou Fake', detalhe: 'Verificar texto, link, foto ou vídeo', icone: 'fact_check', rota: ['/fato-ou-fake'] },
  { tipo: 'pagina', titulo: 'Base da Política', detalhe: 'Glossário e como uma lei nasce', icone: 'school', rota: ['/base-da-politica'] },
  { tipo: 'pagina', titulo: 'Notícias', detalhe: 'Notícias em destaque com fonte', icone: 'newspaper', rota: ['/noticias'] },
  { tipo: 'pagina', titulo: 'FatoBot', detalhe: 'Pergunte para a IA', icone: 'smart_toy', acao: 'fatobot' },
];

export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Busca do topo: procura em políticos, comunidades, glossário, notícias e páginas do site. */
@Injectable({ providedIn: 'root' })
export class BuscaGeralService {
  private comunidades = inject(ComunidadesService);

  async buscar(termo: string, porGrupo = 4): Promise<ResultadoBusca[]> {
    const t = normalizar(termo);
    if (t.length < 2) return [];
    const tem = (...campos: (string | null | undefined)[]) => campos.some((c) => c && normalizar(c).includes(t));

    const [deps, sens, coms] = await Promise.allSettled([
      todosDoCargo('Deputado(a) Federal'),
      todosDoCargo('Senador(a)'),
      this.comunidades.listar(termo),
    ]);
    const politicos = [...(deps.status === 'fulfilled' ? deps.value : []), ...(sens.status === 'fulfilled' ? sens.value : [])]
      .filter((p) => tem(p.nome) || normalizar(p.partido ?? '') === t || normalizar(p.uf ?? '') === t)
      .slice(0, porGrupo)
      .map<ResultadoBusca>((p) => ({
        tipo: 'politico', selo: 'confiavel', titulo: p.nome, detalhe: `${p.cargo} · ${p.partido ?? ''} · ${p.uf ?? ''}`, icone: 'person', foto: p.foto_url,
        rota: rotaPolitico(p),
      }));
    // Busca por partido ou estado: atalho para a lista filtrada
    const atalhos: ResultadoBusca[] = [];
    if (/^[a-z]{2}$/.test(t)) atalhos.push({ tipo: 'pagina', titulo: `Políticos de ${t.toUpperCase()}`, detalhe: 'Ver todos do estado', icone: 'map', rota: ['/politicos'], query: { uf: t.toUpperCase() } });

    const comunidades = (coms.status === 'fulfilled' ? coms.value : []).slice(0, porGrupo).map<ResultadoBusca>((c) => ({
      tipo: 'comunidade', titulo: c.nome, detalhe: `Comunidade · ${c.tema}`, icone: 'groups', rota: ['/comunidades', c.slug],
      foto: avatarComunidade(c.slug), imagem: capaComunidade(c.slug, c.tema),
    }));
    const termos = GLOSSARIO.filter((g) => tem(g.termo) || (t.length >= 4 && tem(g.definicao))).slice(0, porGrupo).map<ResultadoBusca>((g) => ({
      tipo: 'termo', titulo: g.termo, detalhe: g.definicao, icone: g.icone, rota: ['/base-da-politica'],
    }));
    const noticias = NOTICIAS.filter((n) => tem(n.titulo, n.resumo ?? '', n.categoria)).slice(0, porGrupo).map<ResultadoBusca>((n) => ({
      tipo: 'noticia', selo: 'verificado', titulo: n.titulo, detalhe: `${n.fonte} · ${n.data}`, icone: 'newspaper', externo: n.url,
      imagem: n.imagem || infoCategoria(n.categoria).imagem,
    }));
    const paginas = PAGINAS.filter((p) => tem(p.titulo, p.detalhe)).slice(0, porGrupo);
    return [...atalhos, ...politicos, ...comunidades, ...termos, ...noticias, ...paginas];
  }
}
