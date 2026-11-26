import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORIAS, Categoria, InfoCategoria, LISTA_ATUALIZADA_EM, Noticia, NOTICIAS, infoCategoria } from '../../core/noticias';
import { NoticiasService } from '../../core/noticias.service';
import { AFIRMACOES, Afirmacao } from '../../core/fato-ou-fake';
import { Icone } from '../../shared/componentes';
import { PerguntarFatobot } from '../../shared/fatobot-bolha';
import { rolarSuave } from '../../shared/rolar-suave';

interface FonteNoticia { nome: string; orgao: string; url: string; icone: string; }

/** Item do feed "Continue lendo": notícia (grande ou compacta) ou um cartão de checagem do Fato Real. */
type ItemFeed = { tipo: 'grande' | 'compacta'; n: Noticia } | { tipo: 'checagem'; a: Afirmacao };

/**
 * Notícias, no formato de portal: abas por assunto, faixa de últimas, carrossel grande com lista ao lado,
 * cartões "Brasil e mundo" e um feed contínuo. Tudo vem de fontes oficiais, com link para a matéria.
 */
@Component({
  selector: 'app-noticias',
  imports: [RouterLink, Icone, PerguntarFatobot],
  template: `
    <header class="nt-cabecalho">
      <div>
        <p class="sobretitulo">Notícias com fonte</p>
        <h1>Notícias<span>.</span></h1>
      </div>
      <p class="nt-status" [class.ao-vivo]="aoVivo()">
        @if (aoVivo()) { <b>AO VIVO</b> Feed das fontes oficiais · }
        @else { <app-icone nome="verified" /> Fontes oficiais · atualizada em {{ atualizadaEm() }} · }
        {{ todas().length }} notícias
      </p>
    </header>

    <nav class="nt-abas" aria-label="Assuntos">
      <button type="button" [attr.aria-pressed]="!filtro()" (click)="filtrar(null)"><app-icone nome="bolt" /> Tudo</button>
      @for (c of categorias(); track c.nome) {
        <button type="button" [attr.aria-pressed]="filtro() === c.nome" [style.--c]="c.cor" (click)="filtrar(c.nome)"><app-icone [nome]="c.icone" /> {{ c.nome }}</button>
      }
    </nav>

    <div class="nt-faixa" [class.pausada]="faixaPausada()" role="region" aria-label="Últimas notícias">
      <b>ÚLTIMAS</b>
      <div class="nt-faixa-trilho">
        <div class="nt-faixa-itens">
          @for (rodada of [0, 1]; track rodada) {
            @for (n of ultimas(); track n.url) {
              <a [href]="n.url" target="_blank" rel="noopener noreferrer" [attr.aria-hidden]="rodada === 1" [attr.tabindex]="rodada === 1 ? -1 : 0">
                <span class="nt-faixa-cat" [style.--c]="cat(n).cor">{{ n.categoria }}</span> {{ n.titulo }}</a>
            }
          }
        </div>
      </div>
      <!-- WCAG 2.2.2: quem quiser pode parar a faixa (ela também para com o mouse em cima e com "reduzir movimento") -->
      <button type="button" class="nt-faixa-pausa" (click)="faixaPausada.set(!faixaPausada())" [attr.aria-pressed]="faixaPausada()"
        [attr.aria-label]="faixaPausada() ? 'Continuar a faixa de últimas notícias' : 'Pausar a faixa de últimas notícias'">
        <app-icone [nome]="faixaPausada() ? 'play_circle' : 'stop'" />
      </button>
    </div>

    <section class="nt-topo">
      <div class="nt-carrossel" aria-roledescription="carrossel" aria-label="Notícias em destaque"
        (mouseenter)="pausado.set(true)" (mouseleave)="pausado.set(false)" (focusin)="pausado.set(true)" (focusout)="pausado.set(false)">
        <ul #trilho class="nt-trilho" (scroll)="aoRolar()" tabindex="0" aria-label="Destaques"
          (keydown.arrowRight)="$event.preventDefault(); ir(atual() + 1)" (keydown.arrowLeft)="$event.preventDefault(); ir(atual() - 1)">
          @for (n of destaques(); track n.url; let i = $index) {
            <li class="nt-slide" [attr.aria-label]="(i + 1) + ' de ' + destaques().length" [attr.aria-hidden]="i !== atual()" [style.--c]="cat(n).cor">
              @if (imagem(n); as img) { <img [src]="img" alt="" /> }
              @else { <span class="nt-sem-imagem"><app-icone [nome]="cat(n).icone" /></span> }
              <div class="nt-slide-texto">
                <span class="nt-categoria"><app-icone [nome]="cat(n).icone" /> {{ n.categoria }}</span>
                <h2><a [href]="n.url" target="_blank" rel="noopener noreferrer" [attr.tabindex]="i === atual() ? 0 : -1">{{ n.titulo }}</a></h2>
                <p>{{ n.resumo || 'Leia a matéria completa na fonte oficial.' }}</p>
                <div class="nt-slide-rodape">
                  <span class="nt-fonte-oficial"><app-icone nome="verified" /> {{ n.fonte }}</span>
                  <time>{{ n.data }}</time>
                  @if (n.pergunta) {
                    <button type="button" class="nt-botao-vidro" [perguntarFatobot]="n.pergunta" [attr.tabindex]="i === atual() ? 0 : -1"><app-icone nome="smart_toy" /> Entender com o FatoBot</button>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
        <div class="nt-progresso" role="tablist" aria-label="Escolher destaque">
          @for (n of destaques(); track n.url; let i = $index) {
            <button type="button" role="tab" [attr.aria-selected]="i === atual()" [class.lida]="i < atual()" [attr.aria-label]="n.titulo" (click)="ir(i)">
              <span [style.animation-play-state]="pausado() ? 'paused' : 'running'"></span></button>
          }
        </div>
        <div class="nt-setas">
          <button type="button" (click)="ir(atual() - 1)" [disabled]="atual() === 0" aria-label="Destaque anterior"><app-icone nome="chevron_left" /></button>
          <button type="button" (click)="ir(atual() + 1)" [disabled]="atual() === destaques().length - 1" aria-label="Próximo destaque"><app-icone nome="chevron_right" /></button>
        </div>
      </div>

      <aside class="nt-lado" aria-label="Em destaque agora">
        <h3><app-icone nome="trending_up" /> Em destaque agora</h3>
        @for (n of destaques(); track n.url; let i = $index) {
          <button type="button" class="nt-mini" [class.ativa]="i === atual()" [style.--c]="cat(n).cor" (click)="ir(i)">
            <span class="nt-num" aria-hidden="true">{{ (i + 1).toString().padStart(2, '0') }}</span>
            <span><small class="nt-k">{{ n.categoria }}</small><strong>{{ n.titulo }}</strong><small>{{ n.fonte }} · {{ n.data }}</small></span>
          </button>
        }
      </aside>
    </section>

    @if (secundarias().length) {
      <h2 class="nt-secao">{{ filtro() ?? 'Brasil e mundo' }}</h2>
      <section class="nt-bento">
        @for (n of secundarias(); track n.url; let i = $index) {
          <article class="nt-cartao" [class.grande]="i === 0" [style.--c]="cat(n).cor">
            <div class="nt-cartao-img">
              @if (imagem(n); as img) { <img [src]="img" alt="" /> }
              @else { <span class="nt-sem-imagem"><app-icone [nome]="cat(n).icone" /></span> }
            </div>
            <div class="nt-cartao-texto">
              <span class="nt-k"><app-icone [nome]="cat(n).icone" /> {{ n.categoria }}</span>
              <h3><a [href]="n.url" target="_blank" rel="noopener noreferrer">{{ n.titulo }}</a></h3>
              @if (i === 0 && n.resumo) { <p>{{ n.resumo }}</p> }
              <small>{{ n.fonte }} · {{ n.data }}</small>
            </div>
          </article>
        }
      </section>
    }

    <h2 class="nt-secao">Rolando agora <small>postagens das fontes oficiais</small></h2>
    <div class="nt-feed-area">
      <div class="nt-feed nt-posts">
        @for (item of feed(); track $index) {
          @if (item.tipo === 'checagem') {
            <article class="nt-post nt-post-checagem">
              <header class="nt-post-topo">
                <img src="img/fatobot-rosto.svg" alt="" class="nt-post-av" />
                <span><strong>Fato Real <app-icone nome="verified" class="nt-post-selo" /></strong><small>Checagem · fato ou fake?</small></span>
              </header>
              <p class="nt-checagem-frase">“{{ item.a.texto }}”</p>
              <span class="nt-carimbo" [class.fato]="item.a.fato"><app-icone [nome]="item.a.fato ? 'check_circle' : 'cancel'" /> {{ item.a.fato ? 'FATO' : 'FAKE' }}</span>
              <p>{{ item.a.explicacao }}</p>
              <footer class="nt-post-acoes">
                <a [href]="item.a.fonte.url" target="_blank" rel="noopener noreferrer"><app-icone nome="link" /> {{ item.a.fonte.titulo }}</a>
                <a routerLink="/fato-ou-fake"><app-icone nome="quiz" /> Jogar Fato ou Fake</a>
              </footer>
            </article>
          } @else {
            @let f = fonteDe(item.n);
            <article class="nt-post" [style.--c]="cat(item.n).cor">
              <header class="nt-post-topo">
                <span class="nt-post-av nt-post-av-icone"><app-icone [nome]="f.icone" /></span>
                <span><strong>{{ item.n.fonte }} <app-icone nome="verified" class="nt-post-selo" /></strong><small>{{ f.orgao }} · {{ item.n.data }}</small></span>
                <span class="nt-post-cat"><app-icone [nome]="cat(item.n).icone" /> {{ item.n.categoria }}</span>
              </header>
              <h3><a [href]="item.n.url" target="_blank" rel="noopener noreferrer">{{ item.n.titulo }}</a></h3>
              @if (item.n.resumo) { <p>{{ item.n.resumo }}</p> }
              @if (imagem(item.n); as img) { <a [href]="item.n.url" target="_blank" rel="noopener noreferrer" class="nt-post-img" tabindex="-1" aria-hidden="true"><img [src]="img" alt="" /></a> }
              <footer class="nt-post-acoes">
                <a [href]="item.n.url" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Ler na fonte</a>
                @if (item.n.pergunta) { <button type="button" [perguntarFatobot]="item.n.pergunta"><app-icone nome="smart_toy" /> Entender</button> }
                <button type="button" (click)="compartilhar(item.n)"><app-icone nome="share" /> Compartilhar</button>
              </footer>
            </article>
          }
        } @empty {
          <p class="nt-vazio"><app-icone nome="inbox" /> Ainda não há mais notícias de {{ filtro() }}. <button type="button" class="link-sutil" (click)="filtrar(null)">Ver todas</button></p>
        }
        @if (temMais()) {
          <div #maisAbaixo class="nt-carregando"><span class="bolha-digitando"><span></span><span></span><span></span></span> Carregando mais postagens...</div>
          <button type="button" class="botao botao-fantasma nt-mais" (click)="carregarMais()"><app-icone nome="expand_more" /> Carregar mais</button>
        } @else if (feed().length) {
          <p class="nt-fim"><app-icone nome="task_alt" /> Você viu todas as notícias da lista de hoje.</p>
        }
      </div>

      <aside class="nt-coluna">
        @if (perguntas().length) {
          <section class="nt-caixa">
            <h4><app-icone nome="smart_toy" /> Para entender</h4>
            @for (n of perguntas(); track n.url) {
              <button type="button" class="nt-pergunta" [perguntarFatobot]="n.pergunta!"><span>{{ n.pergunta }}</span><app-icone nome="arrow_forward" /></button>
            }
          </section>
        }
        <section class="nt-caixa">
          <h4><app-icone nome="verified" /> De onde vêm as notícias</h4>
          @for (f of fontes; track f.url) {
            <a class="nt-fonte" [href]="f.url" target="_blank" rel="noopener noreferrer">
              <span class="nt-fonte-icone"><app-icone [nome]="f.icone" /></span>
              <span><strong>{{ f.nome }}</strong><small>{{ f.orgao }}</small></span>
              <app-icone nome="open_in_new" class="nt-fonte-seta" />
            </a>
          }
        </section>
        <section class="nt-caixa nt-verificar">
          <app-icone nome="fact_check" />
          <p>Viu uma notícia em outro lugar e ficou na dúvida? Confira antes de compartilhar.</p>
          <a routerLink="/fato-ou-fake" class="botao botao-verde">Verificar uma informação</a>
        </section>
      </aside>
    </div>

    <p class="nota-fontes"><app-icone nome="info" /> Títulos copiados das matérias originais. Imagens são ilustrações do Fato Real. Os resumos não substituem a leitura da fonte.</p>
  `,
})
export class NoticiasPage implements AfterViewInit, OnDestroy {
  private readonly servico = inject(NoticiasService);
  protected readonly atualizadaEm = signal(LISTA_ATUALIZADA_EM);
  protected readonly todas = signal<Noticia[]>(NOTICIAS);
  protected readonly faixaPausada = signal(false);
  protected readonly aoVivo = signal(false);
  protected readonly filtro = signal<Categoria | null>(null);
  protected readonly limite = signal(8);

  /** Só mostra abas de assuntos que têm notícia. */
  protected readonly categorias = computed<InfoCategoria[]>(() => CATEGORIAS.filter((c) => this.todas().some((n) => n.categoria === c.nome)));
  private readonly filtradas = computed(() => (this.filtro() ? this.todas().filter((n) => n.categoria === this.filtro()) : this.todas()));
  protected readonly ultimas = computed(() => this.todas().slice(0, 8));

  /** Carrossel: as marcadas como destaque (até 6) ou, num assunto, as 4 mais novas dele. */
  protected readonly destaques = computed(() => {
    const l = this.filtradas();
    const marcadas = this.filtro() ? l : l.filter((n) => n.destaque);
    return (marcadas.length ? marcadas : l).slice(0, this.filtro() ? 4 : 6);
  });
  private readonly restantes = computed(() => this.filtradas().filter((n) => !this.destaques().includes(n)));
  protected readonly secundarias = computed(() => this.restantes().slice(0, 5));
  private readonly doFeed = computed(() => this.restantes().slice(5));
  protected readonly temMais = computed(() => this.doFeed().length > this.limite());

  /** Feed com formatos misturados: a cada 3 notícias uma grande, e um cartão de checagem a cada 5. */
  protected readonly feed = computed<ItemFeed[]>(() => {
    const itens: ItemFeed[] = [];
    const fakes = AFIRMACOES.filter((a) => !a.fato);
    this.doFeed().slice(0, this.limite()).forEach((n, i) => {
      itens.push({ tipo: i % 3 === 0 ? 'grande' : 'compacta', n });
      if (i % 5 === 1 && !this.filtro()) itens.push({ tipo: 'checagem', a: fakes[Math.floor(i / 5) % fakes.length] });
    });
    return itens;
  });
  protected readonly perguntas = computed(() => this.filtradas().filter((n) => n.pergunta).slice(0, 4));

  private readonly trilho = viewChild.required<ElementRef<HTMLUListElement>>('trilho');
  protected readonly atual = signal(0);
  protected readonly pausado = signal(false);
  private timer?: ReturnType<typeof setInterval>;
  private decorrido = 0;

  constructor() {
    this.servico.carregar().then(({ lista, aoVivo, atualizadaEm }) => {
      this.todas.set(lista);
      this.aoVivo.set(aoVivo);
      this.atualizadaEm.set(atualizadaEm);
    });
    // Ao trocar de assunto, o carrossel volta para o começo
    effect(() => {
      this.destaques();
      const el = this.trilho()?.nativeElement;
      if (el) el.scrollLeft = 0;
      this.atual.set(0);
      this.decorrido = 0;
    });
  }

  protected cat(n: Noticia) {
    return infoCategoria(n.categoria);
  }

  protected imagem(n: Noticia): string | undefined {
    return n.imagem ?? infoCategoria(n.categoria).imagem;
  }

  /** Fonte da notícia no formato de "perfil" do post (ícone e órgão). */
  protected fonteDe(n: Noticia): FonteNoticia {
    const nome = n.fonte.toLowerCase();
    return this.fontes.find((f) => nome.includes(f.nome.toLowerCase()) || f.nome.toLowerCase().includes(nome))
      ?? { nome: n.fonte, orgao: 'Fonte oficial', icone: 'newspaper', url: n.url };
  }

  protected async compartilhar(n: Noticia) {
    try {
      if (navigator.share) await navigator.share({ title: n.titulo, url: n.url });
      else await navigator.clipboard.writeText(`${n.titulo} ${n.url}`);
    } catch {
      /* pessoa cancelou */
    }
  }

  protected carregarMais() {
    this.limite.update((l) => l + 6);
  }

  /** Rolou até o fim do feed: carrega mais postagens sozinho. */
  private readonly maisAbaixo = viewChild<ElementRef<HTMLElement>>('maisAbaixo');
  private observador?: IntersectionObserver;
  private readonly vigia = effect(() => {
    const el = this.maisAbaixo()?.nativeElement;
    this.observador?.disconnect();
    if (!el || typeof IntersectionObserver === 'undefined') return;
    this.observador = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setTimeout(() => this.carregarMais(), 500); }, { rootMargin: '200px' });
    this.observador.observe(el);
  });

  protected filtrar(c: Categoria | null) {
    this.filtro.set(c);
    this.limite.set(8);
  }

  ngAfterViewInit() {
    // Passa sozinho a cada 7 s (pausa com o mouse em cima ou com o foco; desliga se a pessoa prefere menos movimento)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      if (this.pausado() || document.hidden) {
        this.decorrido = 0;
        return;
      }
      this.decorrido += 1;
      if (this.decorrido >= 7) this.ir(this.atual() === this.destaques().length - 1 ? 0 : this.atual() + 1);
    }, 1000);
  }

  ngOnDestroy() {
    this.observador?.disconnect();
    clearInterval(this.timer);
  }

  protected ir(i: number) {
    const lista = this.trilho().nativeElement;
    const destino = Math.max(0, Math.min(i, this.destaques().length - 1));
    rolarSuave(lista, destino * lista.clientWidth);
    this.atual.set(destino);
    this.decorrido = 0;
  }

  @HostListener('window:resize')
  protected aoRolar() {
    const lista = this.trilho().nativeElement;
    this.atual.set(Math.max(0, Math.min(Math.round(lista.scrollLeft / lista.clientWidth), this.destaques().length - 1)));
  }

  protected readonly fontes: FonteNoticia[] = [
    { nome: 'Agência Câmara', orgao: 'Câmara dos Deputados', icone: 'account_balance', url: 'https://www.camara.leg.br/noticias' },
    { nome: 'Agência Senado', orgao: 'Senado Federal', icone: 'gavel', url: 'https://www12.senado.leg.br/noticias' },
    { nome: 'Agência Brasil', orgao: 'Empresa Brasil de Comunicação', icone: 'public', url: 'https://agenciabrasil.ebc.com.br/' },
    { nome: 'Governo Federal', orgao: 'gov.br', icone: 'flag', url: 'https://www.gov.br/pt-br/noticias' },
    { nome: 'TSE', orgao: 'Tribunal Superior Eleitoral', icone: 'how_to_vote', url: 'https://www.tse.jus.br/comunicacao/noticias' },
    { nome: 'STF', orgao: 'Supremo Tribunal Federal', icone: 'balance', url: 'https://noticias.stf.jus.br/' },
  ];
}
