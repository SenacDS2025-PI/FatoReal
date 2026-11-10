import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Denuncia } from '../../core/modelos';
import { Icone } from '../../shared/componentes';

/** Painel mínimo de moderação: a decisão final é sempre de uma pessoa, com motivo registrado. */
@Component({
  selector: 'app-moderacao',
  imports: [FormsModule, RouterLink, DatePipe, Icone],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="shield" /> Moderação</h1>
      <p>Denúncias de publicações e comentários. Leia o conteúdo, consulte as fontes e registre o motivo da decisão.</p>
    </header>

    <div class="abas" role="tablist">
      <button role="tab" type="button" [attr.aria-selected]="filtro() === 'aberta'" (click)="filtro.set('aberta')">Abertas ({{ abertas() }})</button>
      <button role="tab" type="button" [attr.aria-selected]="filtro() === 'todas'" (click)="filtro.set('todas')">Histórico</button>
    </div>

    <ul class="lista-denuncias">
      @for (d of visiveis(); track d.id) {
        <li class="card denuncia">
          <header>
            <span class="etiqueta" [class.etiqueta-verde]="d.status === 'mantido'" [class.etiqueta-vermelha]="d.status === 'removido'">
              {{ d.status === 'aberta' ? 'Aguardando análise' : d.status === 'removido' ? 'Conteúdo removido' : 'Conteúdo mantido' }}
            </span>
            <small class="texto-suave">{{ d.tipo === 'comentario' ? 'Comentário' : 'Publicação' }} · {{ d.criado_em | date: 'dd/MM/yyyy HH:mm' }}</small>
          </header>
          <blockquote>{{ d.conteudo || '(conteúdo não encontrado)' }}</blockquote>
          <p><strong>Motivo da denúncia:</strong> {{ d.motivo }}</p>
          @if (d.comunidade_slug) {
            <a [routerLink]="['/comunidades', d.comunidade_slug]" class="link-seta">Abrir comunidade <app-icone nome="arrow_forward" /></a>
          }
          @if (d.status === 'aberta') {
            <form class="decisao" (submit)="$event.preventDefault()">
              <label [for]="'mot-' + d.id">Motivo da decisão *</label>
              <input [id]="'mot-' + d.id" [name]="'mot-' + d.id" [(ngModel)]="motivo[d.id]" placeholder="Ex.: fonte oficial desmente; é opinião, não desinformação" maxlength="300" />
              <div class="acoes-linha">
                <button type="button" class="botao botao-fantasma" (click)="decidir(d, 'mantido')"><app-icone nome="check" /> Manter</button>
                <button type="button" class="botao botao-perigo" (click)="decidir(d, 'removido')"><app-icone nome="delete" /> Remover conteúdo</button>
              </div>
            </form>
          } @else if (d.decisao_motivo) {
            <p class="texto-suave"><strong>Decisão:</strong> {{ d.decisao_motivo }}</p>
          }
        </li>
      } @empty {
        <li class="card vazio">Nenhuma denúncia {{ filtro() === 'aberta' ? 'aberta' : 'registrada' }}.</li>
      }
    </ul>
  `,
})
export class ModeracaoPage implements OnInit {
  private service = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  protected readonly lista = signal<Denuncia[]>([]);
  protected readonly filtro = signal<'aberta' | 'todas'>('aberta');
  protected readonly abertas = computed(() => this.lista().filter((d) => d.status === 'aberta').length);
  protected readonly visiveis = computed(() =>
    this.filtro() === 'aberta' ? this.lista().filter((d) => d.status === 'aberta') : this.lista(),
  );
  protected motivo: Record<number, string> = {};

  async ngOnInit() {
    await this.carregar();
  }

  private async carregar() {
    try {
      this.lista.set(await this.service.denuncias());
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async decidir(d: Denuncia, status: 'mantido' | 'removido') {
    const motivo = (this.motivo[d.id] ?? '').trim();
    if (!motivo) {
      this.avisos.mostrar('Escreva o motivo da decisão antes.', 'erro');
      return;
    }
    try {
      await this.service.decidir(d, status, motivo);
      this.avisos.mostrar(status === 'removido' ? 'Conteúdo removido.' : 'Conteúdo mantido.');
      await this.carregar();
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
