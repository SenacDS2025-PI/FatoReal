/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ComunidadesService, lerBancoSocial } from './comunidades.service';
import { lerDemo, proximoId, salvarDemo } from './demo-store';
import { Autor, Comunidade } from './modelos';
import { GRUPOS_EXEMPLO, PESSOAS_EXEMPLO, PRIVADAS_EXEMPLO } from './pessoas-demo';
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

/** Mensagem no grupo de uma comunidade. */
export interface MensagemGrupo {
  id: number;
  comunidade_id: number;
  autor: Autor;
  texto: string;
  criado_em: string;
}

export interface ConversaGrupo {
  comunidade: Comunidade;
  ultima: MensagemGrupo | null;
  naoLidas: number;
}

const FATO_REAL: Autor = { id: 'equipe', nome: 'Fato Real', foto_url: 'logo.svg' };

/**
 * Mensagens privadas entre participantes (Supabase: tabela "mensagens") e
 * grupos de conversa de cada comunidade (Supabase: tabela "mensagens_comunidade").
 * No modo demonstração, tudo fica no localStorage.
 */
@Injectable({ providedIn: 'root' })
export class MensagensService {
  private auth = inject(AuthService);
  private comunidades = inject(ComunidadesService);
  private readonly naoLidasPessoas = signal(0);
  private readonly naoLidasGrupos = signal(0);
  /** Total de mensagens não lidas (número vermelho do menu): privadas + grupos. */
  readonly naoLidas = computed(() => this.naoLidasPessoas() + this.naoLidasGrupos());

  // ---------- Conversas privadas ----------
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
    this.naoLidasPessoas.set(lista.reduce((t, c) => t + c.naoLidas, 0));
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
      for (const p of PESSOAS_EXEMPLO) if (p.id !== eu.id && !vistos.has(p.id)) vistos.set(p.id, { id: p.id, nome: p.nome, foto_url: p.foto_url });
      return [...vistos.values()].sort((a, b) => a.nome.localeCompare(b.nome));
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

  // ---------- Grupos das comunidades ----------
  /** Um grupo para cada comunidade de que participo, com a última mensagem e as não lidas. */
  async grupos(): Promise<ConversaGrupo[]> {
    const eu = this.auth.usuario();
    if (!eu) return [];
    const minhas = await this.comunidades.minhas();
    if (!minhas.length) {
      this.naoLidasGrupos.set(0);
      return [];
    }
    const msgs = await this.mensagensDosGrupos(minhas.map((c) => c.id));
    const lidos = this.lidosGrupos(eu.id);
    const lista = minhas.map((c) => {
      const doGrupo = msgs.filter((m) => m.comunidade_id === c.id);
      const ultima = doGrupo.reduce<MensagemGrupo | null>((u, m) => (!u || m.criado_em > u.criado_em ? m : u), null);
      const visto = lidos[c.id] ?? '';
      return { comunidade: c, ultima, naoLidas: doGrupo.filter((m) => m.autor.id !== eu.id && m.criado_em > visto).length };
    });
    lista.sort((a, b) => (b.ultima?.criado_em ?? '').localeCompare(a.ultima?.criado_em ?? ''));
    this.naoLidasGrupos.set(lista.reduce((t, g) => t + g.naoLidas, 0));
    return lista;
  }

  /** Mensagens de um grupo (da mais antiga para a mais nova). Marca o grupo como lido. */
  async grupo(comunidadeId: number): Promise<MensagemGrupo[]> {
    const eu = this.auth.usuario();
    if (!eu) return [];
    const lista = (await this.mensagensDosGrupos([comunidadeId])).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
    const lidos = this.lidosGrupos(eu.id);
    lidos[comunidadeId] = new Date().toISOString();
    salvarDemo(`grupos-lidos:${eu.id}`, lidos);
    return lista;
  }

  async enviarGrupo(comunidadeId: number, texto: string): Promise<void> {
    const eu = this.auth.usuario();
    if (!eu) throw new Error('Entre na sua conta para enviar mensagens.');
    if (!supabase) {
      const lista = this.lerGruposDemo();
      lista.push({ id: proximoId(lista), comunidade_id: comunidadeId, autor: { id: eu.id, nome: eu.nome, foto_url: eu.foto_url }, texto, criado_em: new Date().toISOString() });
      salvarDemo('grupos-v1', lista);
      return;
    }
    const { error } = await supabase.from('mensagens_comunidade').insert({ comunidade_id: comunidadeId, autor_id: eu.id, texto });
    if (error) throw new Error('Não foi possível enviar a mensagem no grupo.');
  }

  async atualizarContagem(): Promise<void> {
    if (!this.auth.logado()) {
      this.naoLidasPessoas.set(0);
      this.naoLidasGrupos.set(0);
      return;
    }
    await Promise.allSettled([this.conversas(), this.grupos()]);
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

  private async mensagensDosGrupos(ids: number[]): Promise<MensagemGrupo[]> {
    if (!supabase) return this.lerGruposDemo().filter((m) => ids.includes(m.comunidade_id));
    const { data, error } = await supabase
      .from('mensagens_comunidade')
      .select('id, comunidade_id, texto, criado_em, autor:perfis(id, nome, foto_url)')
      .in('comunidade_id', ids)
      .order('criado_em', { ascending: false })
      .limit(500);
    if (error) return []; // tabela ainda não criada no banco
    return (data as any[]).map((m) => ({ id: m.id, comunidade_id: m.comunidade_id, texto: m.texto, criado_em: m.criado_em, autor: m.autor }));
  }

  /** Quando cada grupo foi lido pela última vez (fica neste navegador). */
  private lidosGrupos(eu: string): Record<number, string> {
    return lerDemo<Record<number, string>>(`grupos-lidos:${eu}`, {});
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

  /** Demo: boas-vindas da equipe e conversas de exemplo (entram uma vez por usuário, mesmo em navegador já usado). */
  private lerDemo(eu: string): Mensagem[] {
    const lista = lerDemo<Mensagem[] | null>(`mensagens:${eu}`, null) ?? [
      {
        id: 1, remetente_id: FATO_REAL.id, destinatario_id: eu, lida: false, criado_em: new Date(Date.now() - 30 * 3600_000).toISOString(),
        texto: 'Boas-vindas ao Fato Real! Aqui você conversa em particular com quem participa das mesmas comunidades. Lembre-se: respeito sempre e fonte em toda afirmação.',
      },
    ];
    if (!lerDemo<boolean>(`mensagens-exemplo:${eu}`, false)) {
      for (const p of PRIVADAS_EXEMPLO) {
        lista.push({
          id: proximoId(lista), remetente_id: p.de === 'eu' ? eu : p.de, destinatario_id: p.para === 'eu' ? eu : p.para,
          texto: p.texto, lida: p.lida, criado_em: new Date(Date.now() - p.horas * 3600_000).toISOString(),
        });
      }
      salvarDemo(`mensagens-exemplo:${eu}`, true);
      salvarDemo(`mensagens:${eu}`, lista);
    }
    return lista;
  }

  /** Demo: mensagens dos grupos, com as conversas de exemplo na primeira vez. */
  private lerGruposDemo(): MensagemGrupo[] {
    const salvo = lerDemo<MensagemGrupo[] | null>('grupos-v1', null);
    if (salvo) return salvo;
    const db = lerBancoSocial();
    const lista: MensagemGrupo[] = [];
    for (const g of GRUPOS_EXEMPLO) {
      const c = db.comunidades.find((x) => x.slug === g.comunidade);
      const p = g.autor === FATO_REAL.id ? FATO_REAL : PESSOAS_EXEMPLO.find((x) => x.id === g.autor);
      if (!c || !p) continue;
      lista.push({ id: lista.length + 1, comunidade_id: c.id, autor: { id: p.id, nome: p.nome, foto_url: p.foto_url }, texto: g.texto, criado_em: new Date(Date.now() - g.horas * 3600_000).toISOString() });
    }
    salvarDemo('grupos-v1', lista);
    return lista;
  }
}
