import { novoId } from './util';
import { Injectable, computed, signal } from '@angular/core';
import { Usuario } from './modelos';
import { modoDemo, supabase } from './supabase';
import { lerDemo, salvarDemo } from './demo-store';

/**
 * Cadastro, login e perfil do usuário (Supabase Auth).
 * LGPD: coletamos só nome, e-mail e (opcional) foto. Nada de opinião política.
 */

const CAMPOS_EXTRAS = ['bio', 'cidade', 'uf', 'capa', 'profissao', 'interesses', 'redes', 'capa_url'];
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<Usuario | null>(null);
  /**
   * Campos opcionais do perfil (bio, cidade, uf, capa). No modo demonstração todos funcionam;
   * no Supabase, só os que existirem como coluna na tabela perfis.
   */
  readonly camposExtras = signal<string[]>([...CAMPOS_EXTRAS]);
  aceita(campo: string): boolean {
    return this.camposExtras().includes(campo);
  }
  readonly logado = computed(() => this.usuario() !== null);
  readonly moderador = computed(() => this.usuario()?.moderador ?? false);

  /** Resolve quando já sabemos se há alguém logado (usado pelos guards). */
  readonly pronto: Promise<void>;

  constructor() {
    this.pronto = this.iniciar();
  }

  private async iniciar(): Promise<void> {
    if (!supabase) {
      // Modo demonstração: quem não pôs foto ganha um avatar ilustrado (fictício), escolhido pelo id
      const u = lerDemo<Usuario | null>('usuario', null);
      this.usuario.set(u && !u.foto_url ? { ...u, foto_url: avatarIlustrado(u.id) } : u);
      return;
    }
    const { data } = await supabase.auth.getSession();
    await this.carregarPerfil(data.session?.user.id, data.session?.user.email);
    supabase.auth.onAuthStateChange((_evento, sessao) => {
      // setTimeout evita chamar o Supabase de dentro do próprio callback dele
      setTimeout(() => this.carregarPerfil(sessao?.user.id, sessao?.user.email));
    });
  }

  private async carregarPerfil(id?: string, email?: string): Promise<void> {
    if (!supabase || !id) {
      this.usuario.set(null);
      return;
    }
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    // As colunas extras são opcionais no banco: só oferecemos os campos que existirem.
    this.camposExtras.set(CAMPOS_EXTRAS.filter((c) => !!data && c in data));
    this.usuario.set({
      id,
      email: email ?? '',
      nome: data?.nome ?? email?.split('@')[0] ?? 'Usuário',
      foto_url: data?.foto_url ?? null,
      moderador: data?.is_moderador ?? false,
      bio: data?.bio ?? null,
      cidade: data?.cidade ?? null,
      uf: data?.uf ?? null,
      capa: data?.capa ?? null,
      profissao: data?.profissao ?? null,
      interesses: data?.interesses ?? null,
      redes: data?.redes ?? null,
      capa_url: data?.capa_url ?? null,
      criado_em: data?.criado_em ?? null,
    });
  }

  async cadastrar(nome: string, email: string, senha: string): Promise<{ confirmarEmail: boolean }> {
    if (!supabase) {
      // Demo: todo usuário é moderador para dar para mostrar o painel na apresentação.
      this.salvarDemo({ id: novoId(), email, nome, foto_url: null, moderador: true, criado_em: new Date().toISOString() });
      return { confirmarEmail: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome }, emailRedirectTo: `${location.origin}/entrar` },
    });
    if (error) throw new Error(traduzirErro(error.message));
    return { confirmarEmail: !data.session };
  }

  async entrar(email: string, senha: string): Promise<void> {
    if (!supabase) {
      const atual = lerDemo<Usuario | null>('ultimo-usuario', null);
      const nome = atual?.email === email ? atual.nome : email.split('@')[0];
      this.salvarDemo({ id: atual?.email === email ? atual.id : novoId(), email, nome, foto_url: atual?.foto_url ?? null, moderador: true });
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(traduzirErro(error.message));
  }

  async sair(): Promise<void> {
    if (!supabase) {
      this.usuario.set(null);
      salvarDemo('usuario', null);
      return;
    }
    await supabase.auth.signOut();
  }

  async recuperarSenha(email: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/nova-senha`,
    });
    if (error) throw new Error(traduzirErro(error.message));
  }

  async definirNovaSenha(senha: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) throw new Error(traduzirErro(error.message));
  }

  async atualizarPerfil(dados: {
    nome: string;
    foto_url: string | null;
    bio?: string | null;
    cidade?: string | null;
    uf?: string | null;
    capa?: string | null;
    profissao?: string | null;
    interesses?: string[] | null;
    redes?: Usuario['redes'];
    capa_url?: string | null;
  }): Promise<void> {
    const atual = this.usuario();
    if (!atual) return;
    if (!supabase) {
      this.salvarDemo({ ...atual, ...dados });
      return;
    }
    for (const c of CAMPOS_EXTRAS) if (!this.aceita(c)) delete (dados as Record<string, unknown>)[c];
    const { error } = await supabase.from('perfis').update(dados).eq('id', atual.id);
    if (error) throw new Error(traduzirErro(error.message));
    this.usuario.set({ ...atual, ...dados });
  }

  /** LGPD: o titular pode pedir a exclusão. No Supabase, isso é feito por uma função no servidor. */
  async excluirConta(): Promise<void> {
    if (!supabase) {
      salvarDemo('ultimo-usuario', null);
      await this.sair();
      return;
    }
    const { error } = await supabase.rpc('excluir_minha_conta');
    if (error) throw new Error(traduzirErro(error.message));
    await supabase.auth.signOut();
  }

  private salvarDemo(u: Usuario): void {
    this.usuario.set(u.foto_url ? u : { ...u, foto_url: avatarIlustrado(u.id) });
    salvarDemo('usuario', u);
    salvarDemo('ultimo-usuario', u);
  }
}

export { modoDemo };

function traduzirErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha inválidos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).';
  if (m.includes('already registered')) return 'Este e-mail já tem cadastro. Tente entrar.';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  return 'Não foi possível concluir. Tente novamente.';
}

/** Avatar ilustrado de exemplo (public/img/avatares), sempre o mesmo para o mesmo id. Só no modo demonstração. */
export function avatarIlustrado(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `img/avatares/a${(h % 16) + 1}.svg`;
}
