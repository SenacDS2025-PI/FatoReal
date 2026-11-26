import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BuscaGeralService, ResultadoBusca, TipoResultado } from '../core/busca-geral';
import { FatoBotConversa } from '../core/fatobot-conversa.service';
import { Avatar, Icone } from '../shared/componentes';
import { Faixa } from '../shared/faixa';
import { SeloStatus } from '../shared/selo-status';
import { plural } from '../core/util';

type Aba = 'tudo' | TipoResultado;

const GRUPOS: { tipo: TipoResultado; titulo: string; icone: string; cor: string }[] = [
  { tipo: 'politico', titulo: 'Políticos', icone: 'account_balance', cor: '#1f4fbf' },
  { tipo: 'comunidade', titulo: 'Comunidades', icone: 'groups', cor: '#7c3aed' },
  { tipo: 'noticia', titulo: 'Notícias', icone: 'newspaper', cor: '#e11d48' },
  { tipo: 'termo', titulo: 'Glossário', icone: 'menu_book', cor: '#d97706' },
  { tipo: 'pagina', titulo: 'No site', icone: 'explore', cor: '#0f766e' },
];

/** Página de resultados da busca do topo (/busca?q=...): abas por tipo e cartões com imagem. */
@Component({
  selector: 'app-busca-geral',
  imports: [RouterLink, Avatar, Icone, SeloStatus, Faixa],
  template: `
    <app-faixa sobretitulo="Busca" icone="search" [titulo]="'Resultados para “' + q() + '”'"
      [texto]="carregando() ? 'Procurando em políticos, comunidades, notícias e no glossário...' : plural(resultados().length, 'resultado encontrado', 'resultados encontrados') + ' no Fato Real.'"
      [cores]="['#0c4a6e', '#0369a1', '#38bdf8']" />

    @if (carregando()) {
      <div class="bsc-grade">
        @for (i of [1, 2, 3, 4]; track i) { <div class="card bsc-esqueleto"><span class="esqueleto"></span><span class="esqueleto" style="width: 70%"></span></div> }
      </div>
    } @else if (!resultados().length) {
      <div class="card vazio bsc-vazio">
        <img src="img/fatobot.webp" alt="" width="110" />
        <strong>Não achei nada com “{{ q() }}”</strong>
        <span>Tente outro nome, a sigla de um partido (ex.: PT, PL) ou de um estado (ex.: SP).</span>
      </div>
    } @else {
      <nav class="bsc-abas" role="tablist" aria-label="Tipo de resultado">
        <button type="button" role="tab" [attr.aria-selected]="aba() === 'tudo'" (click)="aba.set('tudo')"><app-icone nome="apps" /> Tudo <span>{{ resultados().length }}</span></button>
        @for (g of grupos; track g.tipo) {
          @if (doGrupo(g.tipo).length) {
            <button type="button" role="tab" [attr.aria-selected]="aba() === g.tipo" [style.--cor]="g.cor" (click)="aba.set(g.tipo)"><app-icone [nome]="g.icone" /> {{ g.titulo }} <span>{{ doGrupo(g.tipo).length }}</span></button>
          }
        }
      </nav>

      @for (g of gruposVisiveis(); track g.tipo) {
        <section class="bsc-grupo" [style.--cor]="g.cor">
          <h2 class="bsc-titulo"><span class="icone-tile"><app-icone [nome]="g.icone" /></span> {{ g.titulo }}
            @if (aba() === 'tudo' && doGrupo(g.tipo).length > 4) { <button type="button" class="link-sutil" (click)="aba.set(g.tipo)">Ver todos ({{ doGrupo(g.tipo).length }})</button> }
          </h2>
          <div class="bsc-grade" [attr.data-tipo]="g.tipo">
            @for (r of itens(g.tipo); track r.titulo) {
              @switch (r.tipo) {
                @case ('politico') {
                  <a [routerLink]="r.rota" class="card bsc-pol">
                    <app-avatar class="avatar-oficial" [nome]="r.titulo" [url]="r.foto" [tamanho]="84" />
                    <strong>{{ r.titulo }}</strong><small>{{ r.detalhe }}</small>
                    @if (r.selo) { <app-selo [tipo]="r.selo" texto="Dado oficial" /> }
                  </a>
                }
                @case ('noticia') {
                  <a [href]="r.externo" target="_blank" rel="noopener noreferrer" class="card bsc-img">
                    @if (r.imagem) { <img [src]="r.imagem" alt="" /> }
                    <span class="bsc-img-texto"><strong>{{ r.titulo }}</strong><small>{{ r.detalhe }} <app-icone nome="open_in_new" /></small></span>
                  </a>
                }
                @case ('comunidade') {
                  <a [routerLink]="r.rota" class="card bsc-img bsc-com">
                    @if (r.imagem) { <img [src]="r.imagem" alt="" /> }
                    <span class="bsc-com-av">@if (r.foto) { <img [src]="r.foto" alt="" /> } @else { <app-icone nome="groups" /> }</span>
                    <span class="bsc-img-texto"><strong>{{ r.titulo }}</strong><small>{{ r.detalhe }}</small></span>
                  </a>
                }
                @default {
                  @if (r.acao === 'fatobot') {
                    <button type="button" class="card bsc-tile" (click)="abrirFatobot()"><span class="icone-tile"><app-icone [nome]="r.icone" /></span><span><strong>{{ r.titulo }}</strong><small>{{ r.detalhe }}</small></span><app-icone nome="chat" class="busca-seta" /></button>
                  } @else {
                    <a [routerLink]="r.rota" [queryParams]="r.query" class="card bsc-tile"><span class="icone-tile"><app-icone [nome]="r.icone" /></span><span><strong>{{ r.titulo }}</strong><small>{{ r.detalhe }}</small></span><app-icone nome="chevron_right" class="busca-seta" /></a>
                  }
                }
              }
            }
          </div>
        </section>
      }
    }
  `,
})
export class BuscaGeralPage {
  protected readonly plural = plural;
  private busca = inject(BuscaGeralService);
  private bot = inject(FatoBotConversa);
  readonly q = input('');
  protected readonly grupos = GRUPOS;
  protected readonly aba = signal<Aba>('tudo');
  protected readonly resultados = signal<ResultadoBusca[]>([]);
  protected readonly carregando = signal(true);
  protected readonly gruposVisiveis = computed(() =>
    GRUPOS.filter((g) => (this.aba() === 'tudo' || this.aba() === g.tipo) && this.doGrupo(g.tipo).length),
  );

  constructor() {
    effect(() => {
      const q = this.q();
      untracked(async () => {
        this.carregando.set(true);
        this.aba.set('tudo');
        this.resultados.set(await this.busca.buscar(q ?? '', 12));
        this.carregando.set(false);
      });
    });
  }

  protected doGrupo(t: TipoResultado) {
    return this.resultados().filter((r) => r.tipo === t);
  }

  protected itens(t: TipoResultado) {
    const l = this.doGrupo(t);
    return this.aba() === 'tudo' ? l.slice(0, 4) : l;
  }

  /** O FatoBot abre na bolinha, sem sair da página. */
  protected abrirFatobot() {
    this.bot.abrir(this.q());
  }
}
