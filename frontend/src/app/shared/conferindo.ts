import { Component, OnDestroy, OnInit, input, output, signal } from '@angular/core';
import { fonteOficial } from '../core/util';
import { Icone } from './componentes';

interface Pensamento { icone: string; texto: string; cor: string; x: number; id: number }

/**
 * Faixa pequena que aparece ao publicar: o FatoBot "confere" a publicação (lupinha, bloquinhos do raciocínio
 * subindo e barra de envio). No fim mostra "Publicado!" e, se o link for de órgão oficial, o selo "Com fonte".
 * Não muda a publicação: é um aviso visual. Quem prefere menos movimento vê só a barra.
 */
@Component({
  selector: 'app-conferindo',
  imports: [Icone],
  template: `
    <div class="conf" [class.fim]="terminou()" role="status" aria-live="polite">
      <span class="conf-bot"><img src="img/fatobot-rosto.webp" alt="" /><span class="conf-lupa"><app-icone nome="search" /></span></span>
      @if (!terminou()) {
        <span class="conf-txt"><b>{{ modo() === 'arquivo' ? 'FatoBot está carregando' : 'FatoBot está conferindo' }}<span class="conf-pontos"></span></b><span class="conf-trilho"><i [style.animation-duration.ms]="duracao"></i></span></span>
        <span class="conf-nuvem" aria-hidden="true">
          @for (p of pensamentos(); track p.id) {
            <span class="conf-chip" [style.--c]="p.cor" [style.left.px]="p.x"><app-icone [nome]="p.icone" /> {{ p.texto }}</span>
          }
        </span>
        <span class="sr-only">Conferindo sua publicação</span>
      } @else {
        <span class="conf-pronto"><app-icone nome="check_circle" /> {{ modo() === 'arquivo' ? 'Arquivo pronto para verificar!' : 'Publicado!' }}
          @if (modo() === 'arquivo') { <span class="conf-dica">Agora é só tocar em “Verificar”.</span> }
          @else if (oficial) { <span class="conf-selo"><app-icone nome="verified" /> Com fonte: {{ oficial }}</span> }
          @else if (link()) { <span class="conf-dica">Link anexado. Confira se a fonte é confiável.</span> }
          @else { <span class="conf-dica">Dica: publicações com link da fonte ganham mais confiança.</span> }
        </span>
      }
    </div>
  `,
})
export class Conferindo implements OnInit, OnDestroy {
  readonly texto = input('');
  readonly link = input<string | null>(null);
  readonly temImagem = input(false);
  /** 'publicar' (caixa de publicar) ou 'arquivo' (anexo no Fato ou Fake). */
  readonly modo = input<'publicar' | 'arquivo'>('publicar');
  /** Nomes dos arquivos recebidos (modo 'arquivo'). */
  readonly arquivos = input<string[]>([]);
  /** Avisa quando a animação acabou (a publicação já pode aparecer no feed). */
  readonly fim = output<void>();

  protected readonly pensamentos = signal<Pensamento[]>([]);
  protected readonly terminou = signal(false);
  protected oficial: string | null = null;
  protected duracao = 4800;
  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit() {
    this.oficial = fonteOficial(this.link());
    const passos: [string, string, string][] = this.modo() === 'arquivo' ? this.passosArquivo() : [['edit_note', 'Lendo o texto', '#0369a1']];
    if (this.modo() === 'arquivo') return this.animar(passos);
    if (this.temImagem()) passos.push(['image', 'Olhando a imagem', '#7c3aed']);
    const tags = (this.texto().match(/#[\p{L}\d_]+/gu) ?? []).slice(0, 1);
    if (tags.length) passos.push(['tag', 'Assunto: ' + tags[0], '#be185d']);
    const link = this.link();
    if (link) {
      let host = link;
      try { host = new URL(link).hostname.replace(/^www\./, ''); } catch { /* link inválido */ }
      passos.push(['link', 'Abrindo ' + host, '#6d28d9']);
      if (this.oficial) passos.push(['account_balance', this.oficial, '#15803d'], ['event', 'Conferindo a data', '#be185d'], ['verified', 'Fonte oficial ✔', '#15803d']);
      else passos.push(['travel_explore', 'Procurando a fonte', '#b45309']);
    } else {
      passos.push(['travel_explore', 'Procurando o assunto', '#b45309'], ['lightbulb', 'Sem link de fonte', '#64748b']);
    }
    this.animar(passos);
  }

  private passosArquivo(): [string, string, string][] {
    const p: [string, string, string][] = [];
    for (const nome of this.arquivos().slice(0, 2)) {
      const curto = nome.length > 22 ? nome.slice(0, 20) + '…' : nome;
      const icone = /\.(jpe?g|png|webp|gif)$/i.test(nome) ? 'image' : /\.(mp4|webm|mov)$/i.test(nome) ? 'movie' : 'description';
      p.push([icone, 'Abrindo ' + curto, '#7c3aed']);
    }
    p.push(['memory', 'Lendo o conteúdo', '#0369a1'], ['shield', 'Checando o arquivo', '#b45309'], ['task_alt', 'Pronto ✔', '#15803d']);
    return p;
  }

  private animar(passos: [string, string, string][]) {
    const menosMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.duracao = menosMovimento ? 1200 : this.modo() === 'arquivo' ? passos.length * 520 + 500 : Math.max(3600, passos.length * 800 + 1000);
    const passo = this.modo() === 'arquivo' ? 520 : 800;
    if (!menosMovimento) {
      const xs = [0, 120, 20, 160, 60, 130, 10];
      passos.forEach(([icone, texto, cor], k) =>
        this.timers.push(setTimeout(() => this.pensamentos.update((l) => [...l.slice(-3), { icone, texto, cor, x: xs[k % xs.length], id: k }]), k * passo)),
      );
    }
    this.timers.push(setTimeout(() => { this.terminou.set(true); this.fim.emit(); }, this.duracao));
  }

  ngOnDestroy() {
    this.timers.forEach(clearTimeout);
  }
}
