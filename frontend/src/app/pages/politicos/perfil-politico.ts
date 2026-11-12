import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AlertaJuridico, Politico } from '../../core/modelos';
import { DetalhesPolitico, PoliticosService, alertasDe, detalhesCamara, obterSenador } from '../../core/politicos.service';
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
  /** Vem dos dados da rota: 'senado' em /politicos/senado/:id. */
  readonly casa = input<'camara' | 'senado'>('camara');
  protected readonly alertas = signal<AlertaJuridico[]>([]);
  protected readonly carregandoAlertas = signal(true);
  /** Onde qualquer pessoa pode consultar processos e sanções oficialmente. */
  protected readonly consultas = [
    { nome: 'STF: consulta de processos', url: 'https://portal.stf.jus.br/' },
    { nome: 'CNJ: condenações por improbidade', url: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php' },
    { nome: 'TSE: candidaturas e certidões', url: 'https://divulgacandcontas.tse.jus.br/' },
    { nome: 'Portal da Transparência: sanções (CEIS/CNEP)', url: 'https://portaldatransparencia.gov.br/sancoes' },
  ];
  protected readonly gravidade: Record<AlertaJuridico['tipo'], 'alta' | 'media' | 'neutra'> = {
    'Condenação': 'alta', 'Inelegibilidade': 'alta', 'Cassação': 'alta',
    'Processo em andamento': 'media', 'Sanção administrativa': 'media', 'Absolvição ou arquivamento': 'neutra',
  };

  protected readonly politico = signal<Politico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  /** Comissões, proposições, gastos e contato: carregam depois do perfil, sem travar a página. */
  protected readonly detalhes = signal<DetalhesPolitico | null>(null);
  protected readonly carregandoDetalhes = signal(true);
  protected readonly link = linkSeguro;

  protected readonly fonte = computed(() => {
    const p = this.politico();
    return p ? { titulo: p.casa === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados', url: p.fonte_url, data: p.data_coleta } : null;
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
    const senado = this.casa() === 'senado';
    if (senado) {
      this.carregandoDetalhes.set(false);
    } else {
      detalhesCamara(id)
        .then((d) => this.detalhes.set(d))
        .catch(() => this.detalhes.set(null))
        .finally(() => this.carregandoDetalhes.set(false));
    }
    try {
      const p = senado ? await obterSenador(id) : await this.service.obter(id);
      this.politico.set(p);
      if (p) alertasDe(p).then((a) => this.alertas.set(a)).finally(() => this.carregandoAlertas.set(false));
      else this.carregandoAlertas.set(false);
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
