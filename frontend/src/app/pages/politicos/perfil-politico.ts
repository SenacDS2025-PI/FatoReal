import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { PoliticosService } from '../../core/politicos.service';
import { Avatar, Campo, FonteDado, Icone } from '../../shared/componentes';

@Component({
  selector: 'app-perfil-politico',
  imports: [RouterLink, DatePipe, Avatar, Campo, FonteDado, Icone],
  templateUrl: './perfil-politico.html',
})
export class PerfilPoliticoPage implements OnInit {
  private service = inject(PoliticosService);
  /** Vem da URL /politicos/:id */
  readonly id = input.required<string>();

  protected readonly politico = signal<Politico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  protected readonly fonte = computed(() => {
    const p = this.politico();
    return p ? { titulo: 'Câmara dos Deputados', url: p.fonte_url, data: p.data_coleta } : null;
  });
  protected readonly perguntaIa = computed(() => `O que se sabe sobre a atuação de ${this.politico()?.nome ?? ''}?`);

  async ngOnInit() {
    try {
      this.politico.set(await this.service.obter(Number(this.id())));
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
