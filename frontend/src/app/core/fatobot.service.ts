import { Injectable, inject } from '@angular/core';
import { RespostaFatoBot, Fonte } from './modelos';

export type EstadoVerificacao =
  | 'Evidências sustentam'
  | 'Evidências contradizem'
  | 'Fora de contexto'
  | 'Evidência insuficiente'
  | 'Fonte confiável'
  | 'Em análise';

export interface ResultadoVerificacao {
  estado: EstadoVerificacao;
  explicacao: string;
  fontes: Fonte[];
  consultado_em: string;
  /** Contexto do registro (slide 20): fonte primária, data e categoria, quando conhecidos. */
  contexto?: { fonte?: string; data?: string; categoria?: string };
  /** true quando a resposta é do modo demonstração (sem API): nenhuma busca nem IA aconteceu. */
  demonstracao?: boolean;
}
import { apiUrl, modoDemo } from './supabase';

/** Erro de validação devolvido pela API (HTTP 400): a mensagem dela vai direto para a pessoa. */
export class ErroDoPedido extends Error {}
import { PoliticosService } from './politicos.service';
import { AFIRMACOES } from './fato-ou-fake';
import { EXEMPLOS } from './checagens.service';
import { plural } from './util';

/**
 * FatoBot: o front só manda a pergunta para a API em Node.
 * A chave da IA fica SÓ no servidor, nunca aqui.
 *
 * Contrato esperado da API (combinar com a equipe de back):
 *   POST {API_URL}/fatobot   body: { "pergunta": "..." }
 *   200 → { resposta, fontes: [{ titulo, url, data }], consultado_em, sem_evidencia }
 */
@Injectable({ providedIn: 'root' })
export class FatoBotService {
  private politicos = inject(PoliticosService);

  async perguntar(pergunta: string): Promise<RespostaFatoBot> {
    try {
      const resp = await fetch(`${apiUrl}/fatobot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta }),
      });
      if (resp.ok && resp.headers.get('content-type')?.includes('json')) {
        return (await resp.json()) as RespostaFatoBot;
      }
      if (!modoDemo) throw new Error();
    } catch {
      if (!modoDemo) throw new Error('O FatoBot não respondeu agora. Tente de novo em instantes.');
    }
    return this.respostaDemo(pergunta);
  }

  /**
   * Verificação assistida de uma afirmação, com link e anexos opcionais.
   * Contrato: POST {API_URL}/verificar
   *   JSON { "afirmacao": "...", "link": "https://..." | null, "anexos": [{ "nome", "tipo", "tamanho" }] }
   *   Só as INFORMAÇÕES dos anexos vão, nunca o arquivo: a Vercel recusa pedidos acima de ~4,5 MB
   *   e os anexos não são analisados nem guardados (J13 do backend).
   *   200 → { estado, explicacao, fontes, consultado_em }
   */
  async verificar(pedido: { afirmacao: string; link?: string | null; anexos?: File[] }): Promise<ResultadoVerificacao> {
    const anexos = pedido.anexos ?? [];
    try {
      const resp = await fetch(`${apiUrl}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          afirmacao: pedido.afirmacao,
          link: pedido.link ?? null,
          anexos: anexos.map((a) => ({ nome: a.name, tipo: a.type, tamanho: a.size })),
        }),
      });
      if (resp.ok && resp.headers.get('content-type')?.includes('json')) return (await resp.json()) as ResultadoVerificacao;
      // Pedido recusado pela API (ex.: texto curto demais): mostra a mensagem dela, sem cair na resposta de demonstração
      if (resp.status === 400) {
        const corpo = (await resp.json().catch(() => ({}))) as { erro?: string };
        throw new ErroDoPedido(corpo.erro || 'Confira o texto e tente de novo.');
      }
      if (!modoDemo) throw new Error();
    } catch (e) {
      if (e instanceof ErroDoPedido) throw e;
      if (!modoDemo) throw new Error('A verificação não respondeu agora. Tente de novo em instantes.');
    }
    const conhecido = this.checagemConhecida(pedido.afirmacao, pedido.link ?? null);
    if (conhecido) return { ...conhecido, demonstracao: true };
    const extras = [pedido.link ? 'o link' : '', anexos.length ? plural(anexos.length, 'anexo', 'anexos') : ''].filter(Boolean).join(' e ');
    return {
      estado: 'Em análise',
      explicacao:
        `Recebemos ${extras ? 'o pedido com ' + extras : 'a afirmação'}. No modo demonstração ainda não há busca automática de fontes ` +
        (anexos.length ? 'e os anexos não são analisados automaticamente (a verificação usa só o texto da afirmação), ' : '') +
        'então ele fica em análise. Enquanto isso, confira nas agências de checagem e nas fontes oficiais listadas ao lado.',
      fontes: [],
      consultado_em: new Date().toISOString(),
      demonstracao: true,
    };
  }

  /**
   * Modo demonstração: só responde o que já foi conferido pela equipe (jogo Fato ou Fake e exemplos)
   * ou quando o link é de um órgão oficial. O resto fica "Em análise". Nada é inventado.
   */
  private checagemConhecida(afirmacao: string, link: string | null): ResultadoVerificacao | null {
    const consultado_em = new Date().toISOString();
    const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    const palavras = new Set(norm(afirmacao));
    const parecida = (texto: string) => {
      const alvo = norm(texto);
      if (!alvo.length || palavras.size < 3) return 0;
      return alvo.filter((w) => palavras.has(w)).length / alvo.length;
    };
    let melhor: ResultadoVerificacao | null = null;
    let nota = 0.6;
    for (const a of AFIRMACOES) {
      const n = parecida(a.texto);
      if (n >= nota) {
        nota = n;
        melhor = { estado: a.fato ? 'Evidências sustentam' : 'Evidências contradizem', explicacao: a.explicacao, fontes: [{ titulo: a.fonte.titulo, url: a.fonte.url, data: consultado_em }], consultado_em,
          contexto: { fonte: a.fonte.titulo.replace(/ \(.*\)$/, ''), categoria: 'Política e eleições' } };
      }
    }
    for (const e of EXEMPLOS) {
      const n = parecida(e.afirmacao);
      if (n >= nota) {
        nota = n;
        melhor = { estado: e.estado, explicacao: e.resumo, fontes: e.fonte ? [{ titulo: e.fonte.titulo, url: e.fonte.url, data: consultado_em }] : [], consultado_em,
          contexto: { fonte: e.fonte?.titulo, categoria: 'Política e eleições' } };
      }
    }
    if (melhor) return melhor;
    if (link) {
      try {
        const host = new URL(link).hostname.replace(/^www\./, '');
        const oficiais: [RegExp, string][] = [[/(^|\.)camara\.leg\.br$/, 'Câmara dos Deputados'], [/(^|\.)senado\.leg\.br$/, 'Senado Federal'], [/(^|\.)tse\.jus\.br$/, 'Tribunal Superior Eleitoral'],
          [/(^|\.)stf\.jus\.br$/, 'Supremo Tribunal Federal'], [/(^|\.)ibge\.gov\.br$/, 'IBGE'], [/(^|\.)gov\.br$/, 'Governo federal (gov.br)'], [/\.leg\.br$/, 'Poder Legislativo'], [/\.jus\.br$/, 'Poder Judiciário'], [/\.mp\.br$/, 'Ministério Público']];
        const achou = oficiais.find(([re]) => re.test(host));
        if (achou) {
          return { estado: 'Fonte confiável', consultado_em, fontes: [{ titulo: achou[1], url: link, data: consultado_em }],
            explicacao: `O link é de um site oficial (${achou[1]}). O conteúdo vem direto da fonte primária. Mesmo assim, confira a data da publicação e se o texto compartilhado é o mesmo da página.`,
            contexto: { fonte: achou[1] } };
        }
      } catch {
        /* link inválido */
      }
    }
    return null;
  }

  /**
   * Enquanto a API não existe: procura um político citado na pergunta e devolve
   * só o que está na fonte oficial. Sem IA, sem inventar nada.
   */
  private async respostaDemo(pergunta: string): Promise<RespostaFatoBot> {
    const consultado_em = new Date().toISOString();
    const palavras = pergunta.split(/[^\p{L}]+/u).filter((p) => p.length >= 4);
    for (const termo of palavras) {
      try {
        const achados = await this.politicos.buscar({ termo });
        if (achados.length === 1 || (achados.length > 1 && achados.length <= 3)) {
          const p = achados[0];
          return {
            resposta:
              `Encontrei nos dados oficiais: ${p.nome} é ${p.cargo ?? 'parlamentar'}` +
              `${p.partido ? ` pelo ${p.partido}` : ''}${p.uf ? ` (${p.uf})` : ''}. ` +
              'Abra a fonte para ver o histórico completo. (Modo demonstração: a IA ainda não está conectada.)',
            fontes: [{ titulo: `Câmara dos Deputados: ${p.nome}`, url: p.fonte_url, data: p.data_coleta }],
            consultado_em,
            sem_evidencia: false,
          };
        }
      } catch {
        break;
      }
    }
    return {
      resposta:
        'Não encontrei evidência nas fontes disponíveis para responder a essa pergunta. ' +
        'Ausência de evidência não significa que algo é falso. (Modo demonstração: a IA ainda não está conectada.)',
      fontes: [],
      consultado_em,
      sem_evidencia: true,
    };
  }
}
