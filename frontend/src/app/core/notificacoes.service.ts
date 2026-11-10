/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ComunidadesService, lerBancoSocial } from './comunidades.service';
import { MensagensService } from './mensagens.service';
import { supabase } from './supabase';
import { VistosService } from './vistos.service';

export interface Notificacao {
  id: string;
  tipo: 'curtida' | 'comentario' | 'mensagem';
  texto: string;
  rota: string;
  data: string;
}

/**
 * Notificações montadas a partir do que já existe no banco:
 * curtidas e comentários nas minhas publicações e mensagens recebidas.
 */
@Injectable({ providedIn: 'root' })
export class NotificacoesService {
  private auth = inject(AuthService);
  private mensagens = inject(MensagensService);
  private comunidades = inject(ComunidadesService);
  private vistos = inject(VistosService);

  readonly lista = signal<Notificacao[]>([]);
  readonly naoLidas = computed(() => this.lista().filter((n) => n.data > this.vistos.datas().notificacoes).length);
  /** Publicações novas (de outras pessoas) nas minhas comunidades desde a última visita. */
  readonly novasNasComunidades = signal(0);

  async atualizar(): Promise<void> {
    const eu = this.auth.usuario();
    if (!eu) {
      this.lista.set([]);
      this.novasNasComunidades.set(0);
      return;
    }
    try {
      const [atividade, conversas, feed, minhas] = await Promise.all([
        this.atividade(eu.id),
        this.mensagens.conversas(),
        this.comunidades.feed(50),
        this.comunidades.minhas(),
      ]);
      const msgs: Notificacao[] = conversas
        .filter((c) => c.naoLidas > 0)
        .map((c) => ({
          id: `m-${c.ultima.id}`,
          tipo: 'mensagem',
          texto: `${c.pessoa.nome} enviou ${c.naoLidas > 1 ? `${c.naoLidas} mensagens` : 'uma mensagem'}`,
          rota: '/mensagens',
          data: c.ultima.criado_em,
        }));
      this.lista.set([...msgs, ...atividade].sort((a, b) => b.data.localeCompare(a.data)));
      const ids = new Set(minhas.map((c) => c.id));
      const desde = this.vistos.datas().comunidades;
      this.novasNasComunidades.set(feed.filter((p) => ids.has(p.comunidade_id) && p.autor.id !== eu.id && p.criado_em > desde).length);
    } catch {
      /* sem conexão: mantém o que já havia */
    }
  }

  marcarComoVistas(): void {
    this.vistos.marcar('notificacoes');
  }

  private async atividade(eu: string): Promise<Notificacao[]> {
    if (!supabase) {
      const db = lerBancoSocial();
      const minhas = db.publicacoes.filter((p) => p.autor.id === eu && !p.removida);
      const rota = (id: number) => `/comunidades/${db.comunidades.find((c) => c.id === minhas.find((p) => p.id === id)?.comunidade_id)?.slug ?? ''}`;
      const ids = new Set(minhas.map((p) => p.id));
      return db.comentarios
        .filter((c) => ids.has(c.publicacao_id) && c.autor.id !== eu && !c.removido)
        .map((c) => ({ id: `c-${c.id}`, tipo: 'comentario' as const, texto: `${c.autor.nome} comentou: “${resumo(c.texto)}”`, rota: rota(c.publicacao_id), data: c.criado_em }));
    }
    const { data: pubs } = await supabase.from('publicacoes').select('id, texto, comunidade:comunidades(slug)').eq('autor_id', eu).eq('removida', false).limit(100);
    const lista = (pubs ?? []) as any[];
    if (!lista.length) return [];
    const ids = lista.map((p) => p.id);
    const rota = (id: number) => `/comunidades/${lista.find((p) => p.id === id)?.comunidade?.slug ?? ''}`;
    const [com, cur] = await Promise.all([
      supabase.from('comentarios').select('id, publicacao_id, texto, criado_em, autor:perfis(nome)').in('publicacao_id', ids).neq('autor_id', eu).eq('removido', false).order('criado_em', { ascending: false }).limit(50),
      supabase.from('curtidas').select('publicacao_id, criado_em, usuario:perfis(nome)').in('publicacao_id', ids).neq('usuario_id', eu).order('criado_em', { ascending: false }).limit(50),
    ]);
    return [
      ...((com.data ?? []) as any[]).map((c) => ({ id: `c-${c.id}`, tipo: 'comentario' as const, texto: `${c.autor?.nome ?? 'Alguém'} comentou: “${resumo(c.texto)}”`, rota: rota(c.publicacao_id), data: c.criado_em })),
      ...((cur.data ?? []) as any[]).map((c) => ({ id: `l-${c.publicacao_id}-${c.criado_em}`, tipo: 'curtida' as const, texto: `${c.usuario?.nome ?? 'Alguém'} curtiu sua publicação`, rota: rota(c.publicacao_id), data: c.criado_em })),
    ];
  }
}

function resumo(t: string): string {
  return t.length > 70 ? `${t.slice(0, 70)}…` : t;
}
