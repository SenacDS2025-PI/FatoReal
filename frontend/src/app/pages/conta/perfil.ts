import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Autor, Comunidade, PerfilPublico, Publicacao } from '../../core/modelos';
import { CAPAS, PerfisService } from '../../core/perfis.service';
import { avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone } from '../../shared/componentes';
import { PublicacaoCard } from '../../shared/publicacao-card';

type Aba = 'publicacoes' | 'curtidas' | 'comunidades';

interface Conquista {
  titulo: string;
  icone: string;
  requisito: string;
  ok: boolean;
}

/** Perfil no estilo X/Twitter. Serve para "/perfil" (o meu) e "/pessoas/:id" (de outra pessoa). */
@Component({
  selector: 'app-perfil',
  imports: [RouterLink, DatePipe, Avatar, Icone, PublicacaoCard],
  templateUrl: './perfil.html',
})
export class PerfilPage {
  protected auth = inject(AuthService);
  private perfis = inject(PerfisService);
  private comunidadesService = inject(ComunidadesService);
  private avisos = inject(AvisosService);

  /** Vem da URL /pessoas/:id. Vazio em /perfil. */
  readonly id = input<string>();

  protected readonly perfil = signal<PerfilPublico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly aba = signal<Aba>('publicacoes');
  protected readonly publicacoes = signal<Publicacao[]>([]);
  protected readonly curtidas = signal<Publicacao[]>([]);
  protected readonly comunidades = signal<Comunidade[]>([]);
  protected readonly seguidores = signal<Autor[]>([]);
  protected readonly seguindo = signal<Autor[]>([]);
  protected readonly sugestoes = signal<Autor[]>([]);
  protected readonly lista = signal<'seguidores' | 'seguindo' | null>(null);
  protected readonly ocupado = signal(false);

  protected readonly corTema = COR_TEMA;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly avatarComunidade = avatarComunidade;

  protected readonly ehMeu = computed(() => {
    const eu = this.auth.usuario();
    return !!eu && (!this.id() || this.id() === eu.id);
  });
  protected readonly euSigo = computed(() => this.seguidores().some((p) => p.id === this.auth.usuario()?.id));
  protected readonly capa = computed(() => CAPAS[this.perfil()?.capa ?? ''] ?? CAPAS['verde']);
  protected readonly curtidasRecebidas = computed(() => this.publicacoes().reduce((t, p) => t + p.total_curtidas, 0));
  protected readonly primeiroNome = computed(() => (this.perfil()?.nome ?? '').split(' ')[0]);

  protected readonly conquistas = computed<Conquista[]>(() => {
    const pubs = this.publicacoes().length;
    const lista: Conquista[] = [
      { titulo: 'Primeira publicação', icone: 'edit', requisito: 'Publicar em uma comunidade', ok: pubs >= 1 },
      { titulo: 'Voz ativa', icone: 'campaign', requisito: 'Fazer 5 publicações', ok: pubs >= 5 },
      { titulo: 'Bem recebido', icone: 'thumb_up', requisito: 'Receber 5 curtidas', ok: this.curtidasRecebidas() >= 5 },
      { titulo: 'Participativo', icone: 'groups', requisito: 'Participar de 3 comunidades', ok: this.comunidades().length >= 3 },
      { titulo: 'Conectado', icone: 'person_add', requisito: 'Seguir 3 pessoas', ok: this.seguindo().length >= 3 },
    ];
    if (this.perfil()?.moderador) lista.unshift({ titulo: 'Moderação', icone: 'shield_person', requisito: 'Ser moderador(a)', ok: true });
    return lista;
  });
  protected readonly conquistasFeitas = computed(() => this.conquistas().filter((c) => c.ok).length);

  constructor() {
    // Recarrega quando muda a pessoa (URL) ou quando a conta entra/sai
    effect(() => {
      const id = this.id();
      const eu = this.auth.usuario()?.id;
      untracked(() => this.carregar(id || eu));
    });
  }

  private async carregar(id?: string) {
    this.lista.set(null);
    if (!id) {
      this.perfil.set(null);
      this.carregando.set(false);
      return;
    }
    this.carregando.set(true);
    if (!this.ehMeu() && this.aba() === 'curtidas') this.aba.set('publicacoes');
    try {
      this.perfil.set(await this.perfis.obter(id));
    } catch (e) {
      this.avisos.erro(e);
      this.perfil.set(null);
    }
    const meu = this.ehMeu();
    const [pubs, curtidas, comunidades, seguidores, seguindo, sugestoes] = await Promise.allSettled([
      this.comunidadesService.publicacoesDe(id),
      meu ? this.comunidadesService.curtidasDe(id) : Promise.resolve([]),
      this.comunidadesService.comunidadesDe(id),
      this.perfis.seguidores(id),
      this.perfis.seguindo(id),
      meu ? this.perfis.sugestoes(3) : Promise.resolve([]),
    ]);
    const valor = <T>(r: PromiseSettledResult<T>, padrao: T) => (r.status === 'fulfilled' ? r.value : padrao);
    this.publicacoes.set(valor(pubs, []));
    this.curtidas.set(valor(curtidas, []));
    this.comunidades.set(valor(comunidades, []));
    this.seguidores.set(valor(seguidores, []));
    this.seguindo.set(valor(seguindo, []));
    this.sugestoes.set(valor(sugestoes, []));
    this.carregando.set(false);
  }

  protected recarregar() {
    this.carregar(this.perfil()?.id);
  }

  protected async alternarSeguir() {
    const p = this.perfil();
    if (!p) return;
    this.ocupado.set(true);
    try {
      if (this.euSigo()) await this.perfis.deixarDeSeguir(p.id);
      else await this.perfis.seguir(p.id);
      this.seguidores.set(await this.perfis.seguidores(p.id));
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Seguir alguém da lista de sugestões, direto do meu perfil. */
  protected async seguirSugestao(pessoa: Autor) {
    try {
      await this.perfis.seguir(pessoa.id);
      this.sugestoes.update((l) => l.filter((x) => x.id !== pessoa.id));
      this.seguindo.update((l) => [...l, pessoa]);
      this.avisos.mostrar(`Você agora segue ${pessoa.nome}.`);
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  @HostListener('document:keydown.escape')
  protected fecharLista() {
    this.lista.set(null);
  }
}
