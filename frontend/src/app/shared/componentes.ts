import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { Fonte } from '../core/modelos';
import { modoDemo } from '../core/supabase';
import { imagemSegura, linkSeguro } from '../core/util';

/** Ícone do Google Material Symbols. Uso: <app-icone nome="search" /> */
@Component({
  selector: 'app-icone',
  template: `<span class="material-symbols-rounded" aria-hidden="true">{{ nome() }}</span>`,
  host: { class: 'icone' },
})
export class Icone {
  readonly nome = input.required<string>();
}

/** Foto redonda do usuário, ou as iniciais quando não há foto. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (foto() && !falhou()) {
      <img [src]="foto()" alt="" loading="lazy" (error)="falhou.set(true)" />
    } @else {
      <span aria-hidden="true">{{ iniciais() }}</span>
    }
  `,
  host: { class: 'avatar', '[style.--tam]': 'tamanho() + "px"' },
})
export class Avatar {
  readonly nome = input<string>('');
  readonly url = input<string | null | undefined>(null);
  readonly tamanho = input(40);
  protected readonly foto = computed(() => imagemSegura(this.url()));
  /** Se o link não for uma imagem válida, mostra as iniciais em vez do ícone de imagem quebrada. */
  protected readonly falhou = signal(false);
  constructor() {
    effect(() => {
      this.url();
      this.falhou.set(false);
    });
  }
  protected readonly iniciais = computed(() =>
    this.nome()
      .replace(/[^\p{L}\s]/gu, '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join(''),
  );
}

/** "Fonte: Câmara dos Deputados · coletado em 05/11/2026" com link para o original. */
@Component({
  selector: 'app-fonte',
  imports: [DatePipe, Icone],
  template: `
    <app-icone nome="verified" />
    <span>
      Fonte:
      @if (link()) {
        <a [href]="link()" target="_blank" rel="noopener noreferrer">{{ fonte().titulo }}</a>
      } @else {
        {{ fonte().titulo }}
      }
      @if (fonte().data) {
        · {{ rotulo() }} {{ fonte().data | date: 'dd/MM/yyyy' }}
      }
    </span>
  `,
  host: { class: 'fonte' },
})
export class FonteDado {
  readonly fonte = input.required<Fonte>();
  readonly rotulo = input('coletado em');
  protected readonly link = computed(() => linkSeguro(this.fonte().url));
}

/** Linha "rótulo: valor" que mostra "não disponível" quando o dado não existe. */
@Component({
  selector: 'app-campo',
  template: `
    <dt>{{ rotulo() }}</dt>
    <dd [class.indisponivel]="!valor()">{{ valor() || 'não disponível' }}</dd>
  `,
  host: { class: 'campo' },
})
export class Campo {
  readonly rotulo = input.required<string>();
  readonly valor = input<string | null | undefined>();
}

/** Selo que separa visualmente conteúdo de usuário de informação verificada. */
@Component({
  selector: 'app-selo',
  imports: [Icone],
  template: `
    @if (verificada()) {
      <app-icone nome="verified" /> Informação verificada pela plataforma
    } @else {
      <app-icone nome="person" /> Publicação de usuário
    }
  `,
  host: { class: 'selo', '[class.selo-verificado]': 'verificada()' },
})
export class Selo {
  readonly verificada = input(false);
}

/** Faixa amarela avisando que o site está sem Supabase (dados só neste navegador). */
@Component({
  selector: 'app-aviso-demo',
  imports: [Icone],
  template: `
    @if (demo) {
      <div class="aviso-demo" role="note">
        <app-icone nome="science" />
        <span><strong>Modo demonstração:</strong><span class="so-desktop">&nbsp;o Supabase ainda não está conectado. O que você criar fica salvo só neste navegador.</span><span class="so-celular">&nbsp;os dados ficam salvos só neste navegador.</span></span>
      </div>
    }
  `,
})
export class AvisoDemo {
  protected readonly demo = modoDemo;
}

/** Aviso obrigatório em toda resposta do FatoBot. */
@Component({
  selector: 'app-aviso-ia',
  imports: [Icone],
  template: `<app-icone nome="info" /><span>Resposta automatizada: a IA pode errar. Confira sempre as fontes.</span>`,
  host: { class: 'aviso-ia' },
})
export class AvisoIa {}
