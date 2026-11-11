import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { lerDemo, salvarDemo } from './demo-store';
import { Autor, PerfilPublico } from './modelos';
import { PESSOAS_EXEMPLO, SEGUIR_EXEMPLO } from './pessoas-demo';
import { supabase } from './supabase';

/** Cores de capa que a pessoa pode escolher no perfil. */
export const CAPAS: Record<string, { nome: string; fundo: string }> = {
  verde: { nome: 'Verde', fundo: 'linear-gradient(120deg, #00875a, #0b6b4a 55%, #064a35)' },
  azul: { nome: 'Azul', fundo: 'linear-gradient(120deg, #1e6bff, #1747b8 55%, #0d2a6e)' },
  roxo: { nome: 'Roxo', fundo: 'linear-gradient(120deg, #7c4dff, #5b2bb5 55%, #33166b)' },
  laranja: { nome: 'Laranja', fundo: 'linear-gradient(120deg, #ff9a3c, #e2632a 55%, #a63c16)' },
  grafite: { nome: 'Grafite', fundo: 'linear-gradient(120deg, #4a5a6a, #2c3a48 55%, #17212b)' },
  brasil: { nome: 'Brasil', fundo: 'linear-gradient(120deg, #009c3b 0%, #009c3b 45%, #ffdf00 45%, #ffdf00 62%, #002776 62%)' },
};

interface BancoPessoas {
  perfis: PerfilPublico[];
  seguir: { seguidor: string; seguido: string }[];
}

/** Perfis públicos e "seguir pessoas". */
@Injectable({ providedIn: 'root' })
export class PerfisService {
  private auth = inject(AuthService);

  async obter(id: string): Promise<PerfilPublico | null> {
    const eu = this.auth.usuario();
    if (eu?.id === id) return { ...eu };
    if (!supabase) return this.demo().perfis.find((p) => p.id === id) ?? null;
    const { data, error } = await supabase.from('perfis').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('Não foi possível carregar o perfil.');
    if (!data) return null;
    return {
      id: data.id, nome: data.nome, foto_url: data.foto_url, moderador: !!data.is_moderador, criado_em: data.criado_em,
      bio: data.bio ?? null, cidade: data.cidade ?? null, uf: data.uf ?? null, capa: data.capa ?? null,
    };
  }

  async seguidores(id: string): Promise<Autor[]> {
    if (!supabase) return this.pessoas(this.demo().seguir.filter((s) => s.seguido === id).map((s) => s.seguidor));
    const { data, error } = await supabase
      .from('seguidores')
      .select('pessoa:perfis!seguidores_seguidor_id_fkey(id, nome, foto_url)')
      .eq('seguido_id', id);
    if (error) return [];
    return (data as unknown as { pessoa: Autor }[]).map((s) => s.pessoa);
  }

  async seguindo(id: string): Promise<Autor[]> {
    if (!supabase) return this.pessoas(this.demo().seguir.filter((s) => s.seguidor === id).map((s) => s.seguido));
    const { data, error } = await supabase
      .from('seguidores')
      .select('pessoa:perfis!seguidores_seguido_id_fkey(id, nome, foto_url)')
      .eq('seguidor_id', id);
    if (error) return [];
    return (data as unknown as { pessoa: Autor }[]).map((s) => s.pessoa);
  }

  async seguir(id: string): Promise<void> {
    const eu = this.exigirUsuario();
    if (eu === id) return;
    if (!supabase) {
      const db = this.demo();
      if (!db.seguir.some((s) => s.seguidor === eu && s.seguido === id)) db.seguir.push({ seguidor: eu, seguido: id });
      salvarDemo('pessoas-v1', db);
      return;
    }
    const { error } = await supabase.from('seguidores').insert({ seguidor_id: eu, seguido_id: id });
    if (error) throw new Error('Não foi possível seguir agora.');
  }

  async deixarDeSeguir(id: string): Promise<void> {
    const eu = this.exigirUsuario();
    if (!supabase) {
      const db = this.demo();
      db.seguir = db.seguir.filter((s) => !(s.seguidor === eu && s.seguido === id));
      salvarDemo('pessoas-v1', db);
      return;
    }
    const { error } = await supabase.from('seguidores').delete().eq('seguidor_id', eu).eq('seguido_id', id);
    if (error) throw new Error('Não foi possível deixar de seguir agora.');
  }

  /** Sugestões de quem seguir: pessoas que publicaram recentemente e que eu ainda não sigo. */
  async sugestoes(limite = 3): Promise<Autor[]> {
    const eu = this.auth.usuario()?.id;
    if (!eu) return [];
    const jaSigo = new Set((await this.seguindo(eu)).map((p) => p.id));
    if (!supabase) {
      return this.demo().perfis.filter((p) => p.id !== eu && !jaSigo.has(p.id)).slice(0, limite)
        .map((p) => ({ id: p.id, nome: p.nome, foto_url: p.foto_url }));
    }
    const { data } = await supabase
      .from('publicacoes')
      .select('autor:perfis(id, nome, foto_url)')
      .eq('removida', false)
      .order('criado_em', { ascending: false })
      .limit(40);
    const vistos = new Set<string>();
    return ((data ?? []) as unknown as { autor: Autor }[])
      .map((p) => p.autor)
      .filter((a) => a && a.id !== eu && !jaSigo.has(a.id) && !vistos.has(a.id) && !!vistos.add(a.id))
      .slice(0, limite);
  }

  private pessoas(ids: string[]): Autor[] {
    const eu = this.auth.usuario();
    const perfis = this.demo().perfis;
    return ids
      .map((id) => (eu?.id === id ? eu : perfis.find((p) => p.id === id)))
      .filter((p): p is PerfilPublico => !!p)
      .map((p) => ({ id: p.id, nome: p.nome, foto_url: p.foto_url }));
  }

  private exigirUsuario(): string {
    const id = this.auth.usuario()?.id;
    if (!id) throw new Error('Entre na sua conta para seguir pessoas.');
    return id;
  }

  /** As pessoas de exemplo vêm sempre do código (assim novas entram para todos); só quem segue quem fica salvo. */
  private demo(): BancoPessoas {
    const salvo = lerDemo<Partial<BancoPessoas>>('pessoas-v1', {});
    return { perfis: PESSOAS_EXEMPLO, seguir: salvo.seguir ?? [...SEGUIR_EXEMPLO] };
  }
}
