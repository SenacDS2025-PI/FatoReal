/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { lerBancoSocial } from './comunidades.service';
import { lerDemo, proximoId, salvarDemo } from './demo-store';
import { Autor } from './modelos';
import { supabase } from './supabase';

export interface Mensagem {
  id: number;
  remetente_id: string;
  destinatario_id: string;
  texto: string;
  lida: boolean;
  criado_em: string;
}

export interface Conversa {
  pessoa: Autor;
  ultima: Mensagem;
  naoLidas: number;
}

const FATO_REAL: Autor = { id: 'equipe', nome: 'Fato Real', foto_url: 'logo.svg' };

/** Mensagens privadas entre participantes (Supabase: tabela "mensagens"; demo: localStorage). */
@Injectable({ providedIn: 'root' })
export class MensagensService {
  private auth = inject(AuthService);
  /** Total de mensagens não lidas (número vermelho do menu). */
  readonly naoLidas = signal(0);

  async conversas(): Promise<Conversa[]> {
    const eu = this.auth.usuario();
    if (!eu) return [];
    const todas = await this.todasMinhas(eu.id);
    const pessoas = await this.pessoas(todas.map((m) => (m.remetente_id === eu.id ? m.destinatario_id : m.remetente_id)));
    const mapa = new Map<string, Conversa>();
    for (const m of todas) {
      const outro = m.remetente_id === eu.id ? m.destinatario_id : m.remetente_id;
      const c = mapa.get(outro) ?? { pessoa: pessoas.get(outro) ?? { id: outro, nome: 'Participante' }, ultima: m, naoLidas: 0 };
      if (m.criado_em >= c.ultima.criado_em) c.ultima = m;
      if (m.destinatario_id === eu.id && !m.lida) c.naoLidas++;
      mapa.set(outro, c);
    }
    const lista = [...mapa.values()].sort((a, b) => b.ultima.criado_em.localeCompare(a.ultima.criado_em));
    this.naoLidas.set(lista.reduce((t, c) => t + c.naoLidas, 0));
    return lista;
  }

  async conversa(outroId: string): Promise<Mensagem[]> {
    const eu = this.auth.usuario();
    if (!eu) return [];
    const lista = (await this.todasMinhas(eu.id))
      .filter((m) => m.remetente_id === outroId || m.destinatario_id === outroId)
      .sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    await this.marcarLidas(eu.id, outroId);
    return lista;
  }

  async enviar(paraId: string, texto: string): Promise<void> {
    const eu = this.auth.usuario();
    if (!eu) throw new Error('Entre na sua conta para enviar mensagens.');
    if (!supabase) {
      const lista = this.lerDemo(eu.id);
      lista.push({ id: proximoId(lista), remetente_id: eu.id, destinatario_id: paraId, texto, lida: false, criado_em: new Date().toISOString() });
      salvarDemo(`mensagens:${eu.id}`, lista);
      return;
    }
    const { error } = await supabase.from('mensagens').insert({ remetente_id: eu.id, destinatario_id: paraId, texto });
    if (error) throw new Error('Não foi possível enviar a mensagem.');
  }

  /** Pessoas com quem dá para conversar: quem participa das mesmas comunidades. */
  async contatos(): Promise<Autor[]> {
    const eu = this.auth.usuario();
    if (!eu) return [];
    if (!supabase) {
      const db = lerBancoSocial();
      const minhas = db.membros.filter((m) => m.usuario.id === eu.id).map((m) => m.comunidade_id);
      const vistos = new Map<string, Autor>([[FATO_REAL.id, FATO_REAL]]);
      for (const m of db.membros) if (minhas.includes(m.comunidade_id) && m.usuario.id !== eu.id) vistos.set(m.usuario.id, m.usuario);
      return [...vistos.values()];
    }
    const { data } = await supabase.from('comunidade_membros').select('comunidade_id').eq('usuario_id', eu.id);
    const ids = (data ?? []).map((m: any) => m.comunidade_id);
    if (!ids.length) return [];
    const { data: membros } = await supabase
      .from('comunidade_membros')
      .select('perfil:perfis(id, nome, foto_url)')
      .in('comunidade_id', ids)
      .neq('usuario_id', eu.id);
    const mapa = new Map<string, Autor>();
    for (const m of membros ?? []) {
      const p = (m as any).perfil;
      if (p) mapa.set(p.id, { id: p.id, nome: p.nome, foto_url: p.foto_url });
    }
    return [...mapa.values()];
  }

  async atualizarContagem(): Promise<void> {
    if (!this.auth.logado()) {
      this.naoLidas.set(0);
      return;
    }
    await this.conversas();
  }

  // ---------- internos ----------
  private async todasMinhas(eu: string): Promise<Mensagem[]> {
    if (!supabase) return this.lerDemo(eu);
    const { data, error } = await supabase
      .from('mensagens')
      .select('*')
      .or(`remetente_id.eq.${eu},destinatario_id.eq.${eu}`)
      .order('criado_em', { ascending: false })
      .limit(500);
    if (error) throw new Error('Não foi possível carregar as mensagens.');
    return data as Mensagem[];
  }

  private async pessoas(ids: string[]): Promise<Map<string, Autor>> {
    const mapa = new Map<string, Autor>([[FATO_REAL.id, FATO_REAL]]);
    const unicos = [...new Set(ids)].filter((i) => i !== FATO_REAL.id);
    if (!unicos.length) return mapa;
    if (!supabase) {
      for (const c of await this.contatos()) mapa.set(c.id, c);
      return mapa;
    }
    const { data } = await supabase.from('perfis').select('id, nome, foto_url').in('id', unicos);
    for (const p of data ?? []) mapa.set(p.id, p as Autor);
    return mapa;
  }

  private async marcarLidas(eu: string, outro: string): Promise<void> {
    if (!supabase) {
      const lista = this.lerDemo(eu).map((m) => (m.destinatario_id === eu && m.remetente_id === outro ? { ...m, lida: true } : m));
      salvarDemo(`mensagens:${eu}`, lista);
    } else {
      await supabase.from('mensagens').update({ lida: true }).eq('destinatario_id', eu).eq('remetente_id', outro).eq('lida', false);
    }
    await this.conversas();
  }

  /** Demo: cada usuário começa com uma mensagem de boas-vindas da equipe. */
  private lerDemo(eu: string): Mensagem[] {
    const lista = lerDemo<Mensagem[] | null>(`mensagens:${eu}`, null);
    if (lista) return lista;
    const inicial: Mensagem[] = [
      {
        id: 1, remetente_id: FATO_REAL.id, destinatario_id: eu, lida: false, criado_em: new Date().toISOString(),
        texto: 'Boas-vindas ao Fato Real! Aqui você conversa em particular com quem participa das mesmas comunidades. Lembre-se: respeito sempre e fonte em toda afirmação.',
      },
    ];
    salvarDemo(`mensagens:${eu}`, inicial);
    return inicial;
  }
}
