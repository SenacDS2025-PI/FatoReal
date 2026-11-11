import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { DetalhesPolitico, PoliticosService, detalhesCamara } from '../../core/politicos.service';
import { linkSeguro } from '../../core/util';
import { Avatar, Campo, FonteDado, Icone } from '../../shared/componentes';

@Component({
  selector: 'app-perfil-politico',
  imports: [RouterLink, DatePipe, CurrencyPipe, DecimalPipe, Avatar, Campo, FonteDado, Icone],
  templateUrl: './perfil-politico.html',
})
export class PerfilPoliticoPage implements OnInit {
  private service = inject(PoliticosService);
  /** Vem da URL /politicos/:id */
  readonly id = input.required<string>();

  protected readonly politico = signal<Politico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  /** Comissões, proposições, gastos e contato: carregam depois do perfil, sem travar a página. */
  protected readonly detalhes = signal<DetalhesPolitico | null>(null);
  protected readonly carregandoDetalhes = signal(true);
  protected readonly link = linkSeguro;

  protected readonly fonte = computed(() => {
    const p = this.politico();
    return p ? { titulo: 'Câmara dos Deputados', url: p.fonte_url, data: p.data_coleta } : null;
  });
  protected readonly fonteCamara = computed(() => ({
    titulo: 'Dados Abertos da Câmara',
    url: `https://dadosabertos.camara.leg.br/api/v2/deputados/${this.id()}`,
    data: new Date().toISOString(),
  }));
  protected readonly perguntaIa = computed(() => `O que se sabe sobre a atuação de ${this.politico()?.nome ?? ''}?`);
  protected readonly maiorGasto = computed(() => this.detalhes()?.despesas?.porTipo[0]?.valor || 1);
  protected readonly local = computed(() => {
    const g = this.detalhes()?.gabinete;
    if (!g?.sala) return null;
    return [`Sala ${g.sala}`, g.andar && `${g.andar}º andar`, g.predio && `Anexo ${g.predio}`].filter(Boolean).join(' · ');
  });

  async ngOnInit() {
    const id = Number(this.id());
    detalhesCamara(id)
      .then((d) => this.detalhes.set(d))
      .catch(() => this.detalhes.set(null))
      .finally(() => this.carregandoDetalhes.set(false));
    try {
      this.politico.set(await this.service.obter(id));
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
