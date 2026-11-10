import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisosService } from '../../core/avisos.service';
import { EstadoVerificacao, FatoBotService, ResultadoVerificacao } from '../../core/fatobot.service';
import { AvisoIa, FonteDado, Icone } from '../../shared/componentes';

interface Item {
  afirmacao: string;
  resultado: ResultadoVerificacao;
}

/** Verificação assistida: avaliação preliminar baseada nas fontes consultadas, nunca certificação automática. */
@Component({
  selector: 'app-verificar',
  imports: [FormsModule, DatePipe, Icone, FonteDado, AvisoIa],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="fact_check" /> Verificar informação</h1>
      <p>Recebeu uma afirmação sobre política? Cole aqui antes de compartilhar. A resposta é uma avaliação preliminar, baseada só nas fontes consultadas.</p>
    </header>

    <div class="layout-comunidade">
      <div class="coluna-central">
        <form class="card" (submit)="$event.preventDefault(); verificar()">
          <div class="campo-form">
            <label for="afirmacao">Afirmação para verificar</label>
            <textarea id="afirmacao" name="afirmacao" [(ngModel)]="afirmacao" rows="4" maxlength="1000"
              placeholder="Ex.: A Câmara dos Deputados tem 513 deputados."></textarea>
          </div>
          <button class="botao botao-verde" type="submit" [disabled]="!afirmacao.trim() || verificando()">
            <app-icone nome="search_check" /> {{ verificando() ? 'Verificando...' : 'Verificar' }}
          </button>
        </form>

        @for (it of historico(); track $index) {
          <article class="card resultado-verificacao">
            <blockquote>“{{ it.afirmacao }}”</blockquote>
            <span class="estado" [attr.data-estado]="it.resultado.estado">
              <app-icone [nome]="icone(it.resultado.estado)" /> {{ it.resultado.estado }}
            </span>
            <p>{{ it.resultado.explicacao }}</p>
            @for (f of it.resultado.fontes; track f.url) { <app-fonte [fonte]="f" rotulo="data" /> }
            <small class="texto-suave">Consultado em {{ it.resultado.consultado_em | date: 'dd/MM/yyyy HH:mm' }}</small>
            <app-aviso-ia />
          </article>
        }
      </div>

      <aside class="coluna-direita">
        <section class="card bloco">
          <h2><app-icone nome="rule" /> O que cada resultado quer dizer</h2>
          <dl class="estados">
            @for (e of estados; track e[0]) {
              <div><dt><span class="estado" [attr.data-estado]="e[0]"><app-icone [nome]="icone(e[0])" /> {{ e[0] }}</span></dt><dd>{{ e[1] }}</dd></div>
            }
          </dl>
        </section>
        <section class="card bloco">
          <h2><app-icone nome="travel_explore" /> Agências de checagem</h2>
          <ul class="lista-links">
            <li><a href="https://www.agencialupa.org/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Agência Lupa</a></li>
            <li><a href="https://www.aosfatos.org/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Aos Fatos</a></li>
            <li><a href="https://projetocomprova.com.br/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Projeto Comprova</a></li>
          </ul>
        </section>
      </aside>
    </div>
  `,
})
export class VerificarPage {
  private bot = inject(FatoBotService);
  private avisos = inject(AvisosService);
  protected afirmacao = '';
  protected readonly verificando = signal(false);
  protected readonly historico = signal<Item[]>([]);
  protected readonly estados: [EstadoVerificacao, string][] = [
    ['Evidências sustentam', 'Fontes primárias ou confiáveis confirmam o essencial da afirmação.'],
    ['Evidências contradizem', 'Fontes primárias ou confiáveis mostram que a afirmação é incorreta.'],
    ['Fora de contexto', 'Há base nos fatos, mas data, local ou sentido foram alterados ou omitidos.'],
    ['Evidência insuficiente', 'Não há fontes suficientes para confirmar nem para negar. Ausência de evidência não é prova de falsidade.'],
    ['Em análise', 'Recebida; aguardando busca de fontes ou revisão humana.'],
  ];

  protected icone(e: EstadoVerificacao): string {
    return {
      'Evidências sustentam': 'check_circle',
      'Evidências contradizem': 'cancel',
      'Fora de contexto': 'error',
      'Evidência insuficiente': 'help',
      'Em análise': 'hourglass_top',
    }[e];
  }

  protected async verificar() {
    const afirmacao = this.afirmacao.trim();
    if (!afirmacao) return;
    this.verificando.set(true);
    try {
      const resultado = await this.bot.verificar(afirmacao);
      this.historico.update((h) => [{ afirmacao, resultado }, ...h]);
      this.afirmacao = '';
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.verificando.set(false);
    }
  }
}
