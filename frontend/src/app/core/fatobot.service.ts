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
   * Verificação assistida de uma afirmação.
   * Contrato: POST {API_URL}/verificar  body { "afirmacao": "..." }
   *   200 → { estado, explicacao, fontes, consultado_em }
   */
  async verificar(afirmacao: string): Promise<ResultadoVerificacao> {
    try {
      const resp = await fetch(`${apiUrl}/verificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ afirmacao }),
      });
      if (resp.ok && resp.headers.get('content-type')?.includes('json')) return (await resp.json()) as ResultadoVerificacao;
      if (!modoDemo) throw new Error();
    } catch {
      if (!modoDemo) throw new Error('A verificação não respondeu agora. Tente de novo em instantes.');
    }
    return {
      estado: 'Em análise',
      explicacao:
        'Recebemos a afirmação. No modo demonstração ainda não há busca automática de fontes, então ela fica em análise. ' +
        'Enquanto isso, confira nas agências de checagem e nas fontes oficiais listadas ao lado.',
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
