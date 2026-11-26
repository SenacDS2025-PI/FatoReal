import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { AvisosService } from '../core/avisos.service';
import { ComunidadesService } from '../core/comunidades.service';
import { EnquetesService } from '../core/enquetes.service';
import { Comunidade } from '../core/modelos';
import { fonteOficial, linkSeguro } from '../core/util';
import { Avatar, Icone } from './componentes';
import { Conferindo } from './conferindo';
import { reduzirImagem } from './imagem-reduzida';

/**
 * Caixa de publicar (Início e mural das comunidades): texto, foto ou meme, enquete, link com fonte,
 * atalho "É fake?" e a animação do FatoBot conferindo antes de publicar.
 */
@Component({
  selector: 'app-caixa-publicar',
  imports: [FormsModule, RouterLink, Icone, Avatar, Conferindo],
  template: `
    <section class="card composer ini-composer" aria-label="Nova publicação">
      @if (auth.usuario(); as u) {
        <form (submit)="$event.preventDefault(); publicar()">
          <div class="composer-linha">
            <app-avatar [nome]="u.nome" [url]="u.foto_url" [tamanho]="44" />
            <label for="novo-post" class="sr-only">No que você está pensando?</label>
            <textarea id="novo-post" name="texto" [(ngModel)]="texto" rows="1" maxlength="2000" [placeholder]="fixa() ? 'Escreva no mural. Se for um fato, cite a fonte.' : 'No que você está pensando, ' + primeiroNome() + '?'" [disabled]="!!conferindo()"></textarea>
          </div>

          @if (imagem()) {
            <div class="ini-anexo">
              <figure class="post-midia" [class.post-meme]="!!(memeTopo || memeBase)">
                <img [src]="imagem()" alt="Prévia da imagem" />
                @if (memeTopo) { <figcaption class="meme-topo">{{ memeTopo }}</figcaption> }
                @if (memeBase) { <figcaption class="meme-base">{{ memeBase }}</figcaption> }
                <button type="button" class="ini-tirar" (click)="tirarImagem()" aria-label="Tirar imagem"><app-icone nome="close" /></button>
              </figure>
              <div class="ini-meme-campos">
                <small class="texto-suave"><app-icone nome="mood" /> Quer virar meme? Escreva por cima (opcional):</small>
                <input name="memeTopo" [(ngModel)]="memeTopo" maxlength="60" placeholder="Texto de cima" />
                <input name="memeBase" [(ngModel)]="memeBase" maxlength="60" placeholder="Texto de baixo" />
              </div>
            </div>
          }
          @if (mostrarLink) {
            <div class="composer-extra">
              <label for="novo-link" class="sr-only">Link da fonte</label>
              <input id="novo-link" name="link" type="url" [(ngModel)]="link" (ngModelChange)="aoMudarLink($event)" placeholder="https:// link da fonte" />
            </div>
          }
          @if (mostrarEnquete) {
            <div class="ini-enquete">
              @for (o of opcoes; track $index; let i = $index) {
                <input [name]="'op' + i" [(ngModel)]="opcoes[i]" maxlength="60" [placeholder]="'Opção ' + (i + 1)" />
              }
              @if (opcoes.length < 4) { <button type="button" class="link-sutil" (click)="opcoes.push('')"><app-icone nome="add" /> Mais uma opção</button> }
            </div>
          }

          @if (conferindo(); as c) {
            <app-conferindo [texto]="c.texto" [link]="c.link" [temImagem]="c.temImagem" (fim)="animacaoAcabou()" />
          }

          <div class="ini-ferramentas">
            <label class="ini-ferramenta" style="--c: #16a34a">
              <input type="file" accept="image/*" class="sr-only" (change)="escolherImagem($event)" />
              <app-icone nome="image" /> Foto ou meme
            </label>
            <button type="button" class="ini-ferramenta" style="--c: #2563eb" (click)="mostrarEnquete = !mostrarEnquete" [attr.aria-pressed]="mostrarEnquete"><app-icone nome="poll" /> Enquete</button>
            <button type="button" class="ini-ferramenta" style="--c: #ea580c" (click)="mostrarLink = !mostrarLink" [attr.aria-pressed]="mostrarLink"><app-icone nome="link" /> Link com fonte</button>
            <a class="ini-ferramenta" style="--c: #7c3aed" routerLink="/fato-ou-fake"><app-icone nome="fact_check" /> É fake?</a>
          </div>
          <div class="composer-acoes">
            @if (fixa(); as f) {
              <span class="acao-composer"><app-icone nome="groups" /> Em {{ f.nome }}</span>
            } @else if (comunidades().length) {
              <label for="nova-comunidade" class="sr-only">Publicar em</label>
              <!-- Já vem com a primeira comunidade da pessoa escolhida (antes ficava em branco) -->
              <select id="nova-comunidade" name="comunidade" [ngModel]="comunidadeId ?? comunidades()[0]?.id" (ngModelChange)="comunidadeId = $event" class="select-discreto">
                @for (c of comunidades(); track c.id) { <option [ngValue]="c.id">Em {{ c.nome }}</option> }
              </select>
            } @else {
              <a routerLink="/comunidades" class="acao-composer"><app-icone nome="group_add" /> Entre numa comunidade para publicar</a>
            }
            <button type="submit" class="botao botao-escuro" [disabled]="!podePublicar()">Publicar</button>
          </div>
        </form>
      } @else {
        <div class="composer-linha">
          <span class="avatar" style="--tam: 44px"><app-icone nome="person" /></span>
          <a routerLink="/entrar" class="composer-falso">No que você está pensando? Entre para participar.</a>
        </div>
      }
    </section>

  `,
})
export class CaixaPublicar {
  private service = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private enquetes = inject(EnquetesService);
  protected auth = inject(AuthService);

  /** Comunidades onde a pessoa pode publicar (Início). */
  readonly comunidades = input<Comunidade[]>([]);
  /** Comunidade fixa (mural de uma comunidade): esconde a escolha. */
  readonly fixa = input<Comunidade | null>(null);
  /** Avisa quando a publicação já está no banco (para recarregar o feed). */
  readonly publicado = output<void>();

  protected readonly primeiroNome = computed(() => (this.auth.usuario()?.nome ?? '').split(' ')[0]);
  protected texto = '';
  protected link = '';
  protected memeTopo = '';
  protected memeBase = '';
  protected opcoes: string[] = ['', ''];
  protected mostrarLink = false;
  protected mostrarEnquete = false;
  protected comunidadeId: number | null = null;
  protected readonly imagem = signal<string | null>(null);
  protected readonly conferindo = signal<{ texto: string; link: string | null; temImagem: boolean } | null>(null);
  private envio: Promise<unknown> | null = null;
  private avisouLink = false;

  /** Coloca o cursor na caixa (usado pelo story "Publicar" e pelo botão do celular). */
  focar() {
    const campo = document.getElementById('novo-post');
    campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    campo?.focus();
  }

  private destino(): number | null {
    return this.fixa()?.id ?? this.comunidadeId ?? this.comunidades()[0]?.id ?? null;
  }

  protected async escolherImagem(ev: Event) {
    const alvo = ev.target as HTMLInputElement;
    const arquivo = alvo.files?.[0];
    alvo.value = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      this.avisos.mostrar('Escolha um arquivo de imagem (JPG, PNG, GIF ou WEBP).', 'erro');
      return;
    }
    try {
      this.imagem.set(await reduzirImagem(arquivo, 900, 900, false));
    } catch {
      this.avisos.mostrar('Não deu para abrir essa imagem. Tente outra.', 'erro');
    }
  }

  protected tirarImagem() {
    this.imagem.set(null);
    this.memeTopo = this.memeBase = '';
  }

  /** Colou um link de órgão oficial: o FatoBot comenta (uma vez por visita). */
  protected aoMudarLink(link: string) {
    const org = fonteOficial(link.trim());
    if (!org || this.avisouLink) return;
    this.avisouLink = true;
    window.dispatchEvent(new CustomEvent('fatobot-dica', { detail: {
      chave: 'link-oficial', titulo: `Boa, ${this.primeiroNome()}! 👋`,
      texto: `Esse link é de ${org}, uma fonte oficial. Sua publicação vai sair com o selo “Com fonte”.`,
    } }));
  }

  protected podePublicar() {
    return !!(this.texto.trim() || this.imagem()) && this.destino() !== null && !this.conferindo();
  }

  protected publicar() {
    const destino = this.destino();
    if (!this.podePublicar() || destino === null) return;
    const texto = this.texto.trim();
    const link = this.link.trim() ? linkSeguro(this.link) : null;
    if (this.link.trim() && !link) {
      this.avisos.mostrar('O link precisa começar com http:// ou https://', 'erro');
      return;
    }
    const opcoes = this.mostrarEnquete ? this.opcoes.map((o) => o.trim()).filter(Boolean) : [];
    if (this.mostrarEnquete && opcoes.length < 2) {
      this.avisos.mostrar('A enquete precisa de pelo menos 2 opções.', 'erro');
      return;
    }
    const imagem = this.imagem();
    const meme = imagem && (this.memeTopo.trim() || this.memeBase.trim()) ? { topo: this.memeTopo.trim(), base: this.memeBase.trim() } : null;
    this.conferindo.set({ texto, link, temImagem: !!imagem });
    this.envio = this.service
      .publicar(destino, texto, link, { imagem_url: imagem, meme })
      .then((id) => { if (id !== null && opcoes.length) this.enquetes.criar(id, opcoes); });
    this.envio.catch((e) => {
      this.conferindo.set(null);
      this.avisos.erro(e);
    });
  }

  /** A animação acabou: espera o envio terminar, limpa a caixa e avisa a página. */
  protected async animacaoAcabou() {
    try {
      await this.envio;
    } catch {
      return;
    }
    this.texto = this.link = this.memeTopo = this.memeBase = '';
    this.opcoes = ['', ''];
    this.mostrarLink = this.mostrarEnquete = false;
    this.imagem.set(null);
    this.publicado.emit();
    setTimeout(() => this.conferindo.set(null), 2600);
  }
}
