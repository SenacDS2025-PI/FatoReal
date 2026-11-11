import { Component, inject, input, output, signal } from '@angular/core';
import { LocationStrategy } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AvisosService } from '../core/avisos.service';
import { ComunidadesService } from '../core/comunidades.service';
import { Comentario, Publicacao } from '../core/modelos';
import { linkSeguro, tempoAtras } from '../core/util';
import { Avatar, Icone, PluralPipe } from './componentes';

/** Card de publicação no estilo da apresentação: autor, comunidade, texto, link, curtir/comentar/compartilhar/denunciar. */
@Component({
  selector: 'app-publicacao',
  imports: [FormsModule, RouterLink, Avatar, Icone, PluralPipe],
  template: `
    @let p = pub();
    <article class="post" [class.post-verificado]="p.verificada">
      <header class="post-topo">
        <app-avatar [nome]="p.autor.nome" [url]="p.autor.foto_url" [tamanho]="44" />
        <div class="post-autor">
          <strong>
            {{ p.autor.nome }}
            @if (p.verificada) { <app-icone nome="verified" class="selo-azul" /> }
          </strong>
          <small>
            {{ tempo(p.criado_em) }}
            @if (mostrarComunidade() && p.comunidade_slug) {
              · Em <a [routerLink]="['/comunidades', p.comunidade_slug]">{{ p.comunidade_nome }}</a>
            }
          </small>
        </div>
        <span class="post-tipo" [class.post-tipo-verificado]="p.verificada">
          <app-icone [nome]="p.verificada ? 'verified' : 'person'" />
          {{ p.verificada ? 'Informação verificada' : 'Publicação de usuário' }}
        </span>
      </header>

      <p class="post-texto">{{ p.texto }}</p>

      @if (link(p.link_url); as l) {
        <a class="post-link" [href]="l" target="_blank" rel="noopener noreferrer nofollow ugc">
          <app-icone nome="link" />
          <span><strong>{{ dominio(l) }}</strong><small>{{ l }}</small></span>
          <app-icone nome="open_in_new" />
        </a>
      }

      <div class="post-contagem">
        <span>@if (p.total_curtidas) { <span class="bolinha-curtida"><app-icone nome="thumb_up" /></span> {{ p.total_curtidas }} }</span>
        <button type="button" class="link-discreto" (click)="alternarComentarios()">{{ p.total_comentarios | plural: 'comentário' : 'comentários' }}</button>
      </div>

      <footer class="post-acoes">
        <button type="button" (click)="curtir()" [attr.aria-pressed]="p.curtida_por_mim" [class.ativo]="p.curtida_por_mim">
          <app-icone nome="thumb_up" /> Curtir
        </button>
        <button type="button" (click)="alternarComentarios()" [attr.aria-expanded]="comentarios() !== null">
          <app-icone nome="chat_bubble" /> Comentar
        </button>
        <button type="button" (click)="compartilhar()"><app-icone nome="share" /> Compartilhar</button>
        <button type="button" (click)="abrirDenuncia()" class="acao-denunciar" aria-label="Denunciar publicação">
          <app-icone nome="flag" /> <span class="so-desktop">Denunciar</span>
        </button>
      </footer>

      @if (comentarios(); as lista) {
        <section class="comentarios" aria-label="Comentários">
          @for (co of lista; track co.id) {
            <div class="comentario">
              <app-avatar [nome]="co.autor.nome" [url]="co.autor.foto_url" [tamanho]="32" />
              <div class="comentario-balao">
                <strong>{{ co.autor.nome }}</strong> <small>{{ tempo(co.criado_em) }}</small>
                <p>{{ co.texto }}</p>
              </div>
              <button type="button" class="botao-icone botao-icone-p" aria-label="Denunciar comentário" (click)="abrirDenuncia(co.id)">
                <app-icone nome="flag" />
              </button>
            </div>
          } @empty {
            <p class="texto-suave">Nenhum comentário ainda. Comece a conversa.</p>
          }
          @if (auth.logado()) {
            <form class="comentar" (submit)="$event.preventDefault(); comentar()">
              <app-avatar [nome]="auth.usuario()?.nome ?? ''" [url]="auth.usuario()?.foto_url" [tamanho]="32" />
              <label [for]="'com-' + p.id" class="sr-only">Escreva um comentário</label>
              <input [id]="'com-' + p.id" [name]="'com-' + p.id" [(ngModel)]="novoComentario" maxlength="1000" placeholder="Escreva um comentário..." />
              <button class="botao botao-p" type="submit" [disabled]="!novoComentario.trim()">Enviar</button>
            </form>
          } @else {
            <p class="texto-suave"><a routerLink="/entrar">Entre</a> para comentar.</p>
          }
        </section>
      }
    </article>

    @if (denunciando()) {
      <div class="modal-fundo" (click)="denunciando.set(null)">
        <form class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-denuncia"
          (click)="$event.stopPropagation()" (submit)="$event.preventDefault(); enviarDenuncia()" (keydown.escape)="denunciando.set(null)">
          <h2 id="titulo-denuncia">Denunciar {{ denunciando()?.comentario_id ? 'comentário' : 'publicação' }}</h2>
          <p class="texto-suave">Uma pessoa da moderação vai analisar. A IA não decide sozinha.</p>
          <fieldset>
            <legend>Motivo</legend>
            @for (m of motivos; track m) {
              <label class="opcao"><input type="radio" name="motivo" [value]="m" [(ngModel)]="motivo" /> {{ m }}</label>
            }
          </fieldset>
          <div class="campo-form">
            <label for="den-detalhe">Detalhes (opcional)</label>
            <textarea id="den-detalhe" name="detalhe" [(ngModel)]="detalhe" rows="3" maxlength="500" placeholder="Se for desinformação, cole o link da fonte que desmente."></textarea>
          </div>
          <div class="modal-acoes">
            <button type="button" class="botao botao-fantasma" (click)="denunciando.set(null)">Cancelar</button>
            <button type="submit" class="botao botao-perigo">Enviar denúncia</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class PublicacaoCard {
  protected auth = inject(AuthService);
  private service = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  private local = inject(LocationStrategy);

  readonly pub = input.required<Publicacao>();
  readonly mostrarComunidade = input(false);
  /** Avisa a página para recarregar a lista depois de curtir/comentar. */
  readonly mudou = output<void>();

  protected readonly comentarios = signal<Comentario[] | null>(null);
  protected novoComentario = '';
  protected readonly denunciando = signal<{ comentario_id?: number } | null>(null);
  protected motivo = '';
  protected detalhe = '';
  protected readonly motivos = [
    'Desinformação (fato desmentido por fonte confiável)',
    'Discurso de ódio, assédio ou ameaça',
    'Dados pessoais de outra pessoa',
    'Spam ou propaganda',
    'Outro motivo',
  ];
  protected readonly tempo = tempoAtras;
  protected readonly link = linkSeguro;

  protected dominio(url: string): string {
    return new URL(url).hostname.replace(/^www\./, '');
  }

  private exigirConta(): boolean {
    if (this.auth.logado()) return true;
    this.router.navigate(['/entrar'], { queryParams: { voltar: this.router.url } });
    return false;
  }

  protected async curtir() {
    if (!this.exigirConta()) return;
    try {
      await this.service.alternarCurtida(this.pub());
      this.mudou.emit();
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async alternarComentarios() {
    if (this.comentarios()) this.comentarios.set(null);
    else this.comentarios.set(await this.service.comentarios(this.pub().id));
  }

  protected async comentar() {
    const texto = this.novoComentario.trim();
    if (!texto || !this.exigirConta()) return;
    try {
      await this.service.comentar(this.pub().id, texto);
      this.novoComentario = '';
      this.comentarios.set(await this.service.comentarios(this.pub().id));
      this.mudou.emit();
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async compartilhar() {
    const slug = this.pub().comunidade_slug;
    const caminho = this.local.prepareExternalUrl(slug ? `/comunidades/${slug}` : this.router.url);
    const url = new URL(caminho, location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      this.avisos.mostrar('Link copiado! É só colar onde quiser compartilhar.');
    } catch {
      this.avisos.mostrar(`Copie o link: ${url}`);
    }
  }

  protected abrirDenuncia(comentario_id?: number) {
    if (!this.exigirConta()) return;
    this.motivo = this.motivos[0];
    this.detalhe = '';
    this.denunciando.set({ comentario_id });
  }

  protected async enviarDenuncia() {
    const alvo = this.denunciando();
    if (!alvo) return;
    const motivo = this.detalhe.trim() ? `${this.motivo}: ${this.detalhe.trim()}` : this.motivo;
    try {
      await this.service.denunciar({ publicacao_id: this.pub().id, comentario_id: alvo.comentario_id }, motivo);
      this.denunciando.set(null);
      this.avisos.mostrar('Denúncia enviada. A moderação humana vai analisar.');
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
