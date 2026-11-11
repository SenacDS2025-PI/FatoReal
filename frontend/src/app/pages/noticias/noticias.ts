import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NOTICIAS_DESTAQUE } from '../../core/noticias';
import { Icone } from '../../shared/componentes';

interface FonteNoticia {
  nome: string;
  orgao: string;
  descricao: string;
  url: string;
  categoria: string;
  icone: string;
}

/**
 * Notícias: carrossel com poucas notícias em destaque (selecionadas pela equipe, com link para a fonte)
 * e, abaixo, os canais oficiais de notícias dos Poderes.
 */
@Component({
  selector: 'app-noticias',
  imports: [RouterLink, Icone],
  template: `
    <header class="cabecalho-pagina">
      <p class="sobretitulo">Em destaque</p>
      <h1>Notícias</h1>
      <p>As notícias mais importantes da semana, resumidas em poucas linhas e sempre com o link para a fonte original.</p>
    </header>

    <section class="noticias-carrossel" aria-roledescription="carrossel" aria-label="Notícias em destaque"
      (mouseenter)="pausado.set(true)" (mouseleave)="pausado.set(false)" (focusin)="pausado.set(true)" (focusout)="pausado.set(false)">
      <ul #trilho class="noticias-trilho" (scroll)="aoRolar()" tabindex="0" aria-label="Notícias"
        (keydown.arrowRight)="$event.preventDefault(); ir(atual() + 1)" (keydown.arrowLeft)="$event.preventDefault(); ir(atual() - 1)">
        @for (n of noticias; track n.url; let i = $index) {
          <li class="noticia-slide" [attr.aria-label]="(i + 1) + ' de ' + noticias.length" [attr.aria-hidden]="i !== atual()">
            <article class="noticia-card">
              <div class="noticia-imagem">
                <img [src]="n.imagem" alt="" [attr.loading]="i === 0 ? 'eager' : 'lazy'" />
                <span class="noticia-tema"><app-icone [nome]="n.icone" /> {{ n.tema }}</span>
                @if (n.imagemIlustrativa) { <small class="noticia-ilustrativa">Imagem ilustrativa</small> }
              </div>
              <div class="noticia-texto">
                <p class="noticia-meta"><span>{{ n.fonte }}</span> · <time>{{ n.data }}</time></p>
                <h2><a [href]="n.url" target="_blank" rel="noopener noreferrer" [attr.tabindex]="i === atual() ? 0 : -1">{{ n.titulo }}</a></h2>
                <p class="noticia-resumo">{{ n.resumo }}</p>
                <div class="noticia-acoes">
                  <a class="botao" [href]="n.url" target="_blank" rel="noopener noreferrer" [attr.tabindex]="i === atual() ? 0 : -1">Ler a notícia completa <app-icone nome="open_in_new" /></a>
                  <a class="botao botao-fantasma" routerLink="/fatobot" [queryParams]="{ p: n.pergunta }" [attr.tabindex]="i === atual() ? 0 : -1"><app-icone nome="smart_toy" /> Entender com o FatoBot</a>
                </div>
              </div>
            </article>
          </li>
        }
      </ul>
      <button type="button" class="noticias-seta noticias-seta-esq" (click)="ir(atual() - 1)" [disabled]="atual() === 0" aria-label="Notícia anterior"><app-icone nome="chevron_left" /></button>
      <button type="button" class="noticias-seta noticias-seta-dir" (click)="ir(atual() + 1)" [disabled]="atual() === noticias.length - 1" aria-label="Próxima notícia"><app-icone nome="chevron_right" /></button>
      <div class="noticias-pontos" role="tablist" aria-label="Escolher notícia">
        @for (n of noticias; track n.url; let i = $index) {
          <button type="button" role="tab" [attr.aria-selected]="i === atual()" [attr.aria-label]="n.titulo" (click)="ir(i)"><span [style.animation-play-state]="pausado() ? 'paused' : 'running'"></span></button>
        }
      </div>
    </section>

    <p class="nota-fontes"><app-icone nome="verified" /> Notícias selecionadas pela equipe Fato Real a partir de fontes públicas. Os resumos não substituem a leitura da matéria original.</p>

    <section class="card fontes-oficiais">
      <h2 class="titulo-secao">Acompanhe nas fontes oficiais</h2>
      <ul>
        @for (f of fontes; track f.url) {
          <li>
            <a [href]="f.url" target="_blank" rel="noopener noreferrer">
              <span class="fonte-icone"><app-icone [nome]="f.icone" /></span>
              <span><strong>{{ f.nome }}</strong><small>{{ f.orgao }}</small></span>
              <app-icone nome="open_in_new" class="fonte-seta" />
            </a>
          </li>
        }
      </ul>
    </section>

    <div class="card aviso-participar">
      <app-icone nome="fact_check" />
      <p>Viu uma notícia em outro lugar e ficou na dúvida? Confira antes de compartilhar.</p>
      <a routerLink="/verificar" class="botao botao-verde">Verificar uma informação</a>
    </div>
  `,
})
export class NoticiasPage implements AfterViewInit, OnDestroy {
  protected readonly noticias = NOTICIAS_DESTAQUE;
  private readonly trilho = viewChild.required<ElementRef<HTMLUListElement>>('trilho');
  protected readonly atual = signal(0);
  protected readonly pausado = signal(false);
  private timer?: ReturnType<typeof setInterval>;
  /** Segundos desde a última troca de notícia (zera ao trocar, pausar ou clicar). */
  private decorrido = 0;

  ngAfterViewInit() {
    // Passa sozinho a cada 9 s (pausa com o mouse em cima ou com o foco do teclado; desliga se a pessoa prefere menos movimento)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      if (this.pausado() || document.hidden) {
        this.decorrido = 0;
        return;
      }
      this.decorrido += 1;
      if (this.decorrido >= 9) this.ir(this.atual() === this.noticias.length - 1 ? 0 : this.atual() + 1);
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  protected ir(i: number) {
    const lista = this.trilho().nativeElement;
    const destino = Math.max(0, Math.min(i, this.noticias.length - 1));
    lista.scrollTo({ left: destino * lista.clientWidth, behavior: 'smooth' });
    this.atual.set(destino);
    this.decorrido = 0;
  }

  @HostListener('window:resize')
  protected aoRolar() {
    const lista = this.trilho().nativeElement;
    this.atual.set(Math.max(0, Math.min(Math.round(lista.scrollLeft / lista.clientWidth), this.noticias.length - 1)));
  }

  protected readonly fontes: FonteNoticia[] = [
    { nome: 'Agência Câmara de Notícias', orgao: 'Câmara dos Deputados', categoria: 'Política', icone: 'account_balance', url: 'https://www.camara.leg.br/noticias', descricao: 'Projetos, votações e debates da Câmara dos Deputados.' },
    { nome: 'Agência Senado', orgao: 'Senado Federal', categoria: 'Política', icone: 'gavel', url: 'https://www12.senado.leg.br/noticias', descricao: 'Notícias das votações, comissões e sessões do Senado.' },
    { nome: 'Agência Brasil', orgao: 'Empresa Brasil de Comunicação (EBC)', categoria: 'Brasil', icone: 'public', url: 'https://agenciabrasil.ebc.com.br/', descricao: 'Agência pública de notícias com cobertura nacional.' },
    { nome: 'Notícias do Governo Federal', orgao: 'gov.br', categoria: 'Brasil', icone: 'flag', url: 'https://www.gov.br/pt-br/noticias', descricao: 'Comunicados oficiais de ministérios e órgãos federais.' },
    { nome: 'Notícias do TSE', orgao: 'Tribunal Superior Eleitoral', categoria: 'Eleições', icone: 'how_to_vote', url: 'https://www.tse.jus.br/comunicacao/noticias', descricao: 'Calendário eleitoral, candidaturas e regras das eleições.' },
    { nome: 'Notícias do STF', orgao: 'Supremo Tribunal Federal', categoria: 'Justiça', icone: 'balance', url: 'https://noticias.stf.jus.br/', descricao: 'Julgamentos e decisões do Supremo Tribunal Federal.' },
  ];
}
