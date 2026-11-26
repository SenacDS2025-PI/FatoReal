import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { termoDoDia } from '../../core/glossario';
import { Comunidade, Publicacao } from '../../core/modelos';
import { avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Icone } from '../../shared/componentes';
import { CaixaPublicar } from '../../shared/caixa-publicar';
import { PublicacaoCard } from '../../shared/publicacao-card';
import { PluralPipe } from '../../shared/plural';

type Aba = 'para-voce' | 'alta' | 'minhas' | 'memes';

/** Início com cara de rede social: stories, caixa de publicar (foto/meme, enquete, link), abas e feed. */
@Component({
  selector: 'app-inicio',
  imports: [PluralPipe, RouterLink, Icone, PublicacaoCard, CaixaPublicar],
  templateUrl: './inicio.html',
})
export class InicioPage implements OnInit {
  private comunidades = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected auth = inject(AuthService);

  protected readonly fatoDoDia = termoDoDia();
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly corTema = COR_TEMA;
  protected readonly avatarComunidade = avatarComunidade;
  protected readonly primeiroNome = computed(() => (this.auth.usuario()?.nome ?? '').split(' ')[0]);

  protected readonly abas: { id: Aba; nome: string }[] = [
    { id: 'para-voce', nome: 'Para você' },
    { id: 'alta', nome: 'Em alta 🔥' },
    { id: 'minhas', nome: 'Minhas comunidades' },
    { id: 'memes', nome: 'Memes 😂' },
  ];
  protected readonly aba = signal<Aba>('para-voce');

  protected readonly feedCompleto = signal<Publicacao[]>([]);
  protected readonly todas = signal<Comunidade[]>([]);
  protected readonly minhas = signal<Comunidade[]>([]);
  private readonly idsMinhas = computed(() => new Set(this.minhas().map((c) => c.id)));

  protected readonly feed = computed(() => {
    const lista = this.feedCompleto();
    switch (this.aba()) {
      case 'alta': return [...lista].sort((a, b) => b.total_curtidas + b.total_comentarios - (a.total_curtidas + a.total_comentarios));
      case 'minhas': return lista.filter((p) => this.idsMinhas().has(p.comunidade_id));
      case 'memes': return lista.filter((p) => p.meme || p.comunidade_slug === 'memes-da-politica');
      default: return lista;
    }
  });
  /** Stories: as comunidades da pessoa (ou as maiores, para quem ainda não entrou em nenhuma). */
  protected readonly stories = computed(() =>
    (this.minhas().length ? this.minhas() : [...this.todas()].sort((a, b) => b.total_membros - a.total_membros)).slice(0, 6),
  );
  protected readonly sugeridas = computed(() =>
    this.todas().filter((c) => !this.idsMinhas().has(c.id)).sort((a, b) => b.total_membros - a.total_membros).slice(0, 3),
  );
  /** "Em alta": hashtags mais usadas no feed (dado real das publicações). Sem hashtags, mostra os temas. */
  protected readonly emAlta = computed(() => {
    const cont = new Map<string, number>();
    for (const p of this.feedCompleto()) for (const t of new Set(p.texto.match(/#[\p{L}\d_]+/gu) ?? [])) cont.set(t, (cont.get(t) ?? 0) + 1);
    if (!cont.size) for (const p of this.feedCompleto()) if (p.comunidade_tema) cont.set(p.comunidade_tema, (cont.get(p.comunidade_tema) ?? 0) + 1);
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  });

  async ngOnInit() {
    await this.carregar();
  }

  private async carregar() {
    try {
      const [feed, todas, minhas] = await Promise.all([this.comunidades.feed(), this.comunidades.listar(), this.comunidades.minhas()]);
      this.feedCompleto.set(feed);
      this.todas.set(todas);
      this.minhas.set(minhas);
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async recarregarFeed() {
    this.feedCompleto.set(await this.comunidades.feed());
  }

  protected buscarTag(tag: string) {
    this.router.navigate(['/busca'], { queryParams: { q: tag.replace(/^#/, '') } });
  }

  protected async participar(c: Comunidade) {
    if (!this.auth.logado()) {
      this.router.navigate(['/entrar'], { queryParams: { voltar: '/' } });
      return;
    }
    try {
      await this.comunidades.entrar(c.id);
      this.avisos.mostrar(`Você entrou na comunidade ${c.nome}!`);
      await this.carregar();
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected focarComposer(caixa: CaixaPublicar) {
    if (!this.auth.logado()) {
      this.router.navigate(['/entrar'], { queryParams: { voltar: '/' } });
      return;
    }
    caixa.focar();
  }

  protected async aoPublicar() {
    this.aba.set('para-voce');
    await this.recarregarFeed();
  }
}
