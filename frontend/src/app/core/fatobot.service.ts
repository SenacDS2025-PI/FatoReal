import { Injectable, inject } from '@angular/core';
import { RespostaFatoBot, Fonte } from './modelos';

export type EstadoVerificacao =
  | 'Evidências sustentam'
  | 'Evidências contradizem'
  | 'Fora de contexto'
  | 'Evidência insuficiente'
  | 'Em análise';

export interface ResultadoVerificacao {
  estado: EstadoVerificacao;
  explicacao: string;
  fontes: Fonte[];
  consultado_em: string;
}
import { apiUrl, modoDemo } from './supabase';
import { PoliticosService } from './politicos.service';

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
   *   - sem anexos: JSON { "afirmacao": "...", "link": "https://..." | null }
   *   - com anexos: multipart/form-data com os campos afirmacao, link e anexos (um ou mais arquivos)
   *   200 → { estado, explicacao, fontes, consultado_em }
   */
  async verificar(pedido: { afirmacao: string; link?: string | null; anexos?: File[] }): Promise<ResultadoVerificacao> {
    const anexos = pedido.anexos ?? [];
    try {
      let corpo: BodyInit;
      const headers: Record<string, string> = {};
      if (anexos.length) {
        const form = new FormData();
        form.append('afirmacao', pedido.afirmacao);
        if (pedido.link) form.append('link', pedido.link);
        for (const a of anexos) form.append('anexos', a, a.name);
        corpo = form; // o navegador define o Content-Type com o boundary
      } else {
        headers['Content-Type'] = 'application/json';
        corpo = JSON.stringify({ afirmacao: pedido.afirmacao, link: pedido.link ?? null });
      }
      const resp = await fetch(`${apiUrl}/verificar`, { method: 'POST', headers, body: corpo });
      if (resp.ok && resp.headers.get('content-type')?.includes('json')) return (await resp.json()) as ResultadoVerificacao;
      if (!modoDemo) throw new Error();
    } catch {
      if (!modoDemo) throw new Error('A verificação não respondeu agora. Tente de novo em instantes.');
    }
    const extras = [pedido.link ? 'o link' : '', anexos.length ? `${anexos.length} anexo(s)` : ''].filter(Boolean).join(' e ');
    return {
      estado: 'Em análise',
      explicacao:
        `Recebemos ${extras ? 'o pedido com ' + extras : 'a afirmação'}. No modo demonstração ainda não há busca automática de fontes ` +
        (anexos.length ? 'nem análise de fotos, vídeos e documentos (isso passa por revisão humana), ' : '') +
        'então ele fica em análise. Enquanto isso, confira nas agências de checagem e nas fontes oficiais listadas ao lado.',
      fontes: [],
      consultado_em: new Date().toISOString(),
    };
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
