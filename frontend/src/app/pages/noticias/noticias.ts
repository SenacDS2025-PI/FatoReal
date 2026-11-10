import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/componentes';

interface FonteNoticia {
  nome: string;
  orgao: string;
  descricao: string;
  url: string;
  categoria: string;
  icone: string;
}

/**
 * Notícias: no piloto, reunimos os canais oficiais de notícias dos Poderes.
 * O feed automático (com resumo, data e status de verificação) entra numa próxima etapa.
 */
@Component({
  selector: 'app-noticias',
  imports: [RouterLink, Icone],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="newspaper" /> Notícias</h1>
      <p>Acompanhe o que acontece no Brasil direto nos canais oficiais de notícias dos Poderes. Cada link abre a fonte original.</p>
    </header>

    <div class="chips" role="tablist" aria-label="Filtrar por categoria">
      @for (c of categorias; track c) {
        <button type="button" role="tab" class="chip" [class.ativo]="categoria() === c" [attr.aria-selected]="categoria() === c" (click)="categoria.set(c)">{{ c }}</button>
      }
    </div>

    <ul class="grade-cards">
      @for (f of visiveis(); track f.url) {
        <li>
          <a class="card card-noticia" [href]="f.url" target="_blank" rel="noopener noreferrer">
            <span class="card-noticia-icone"><app-icone [nome]="f.icone" /></span>
            <span class="tag-verde tag-p">{{ f.categoria }}</span>
            <strong>{{ f.nome }}</strong>
            <small class="texto-suave">{{ f.orgao }}</small>
            <p>{{ f.descricao }}</p>
            <span class="link-seta">Abrir fonte oficial <app-icone nome="open_in_new" /></span>
          </a>
        </li>
      }
    </ul>

    <div class="card aviso-participar">
      <app-icone nome="info" />
      <p>Em breve: notícias reunidas aqui com resumo, data, tema e status de verificação. Notícia, opinião e publicação de usuário vão aparecer sempre identificadas.</p>
      <a routerLink="/verificar" class="botao botao-verde">Verificar uma informação</a>
    </div>
  `,
})
export class NoticiasPage {
  protected readonly fontes: FonteNoticia[] = [
    { nome: 'Agência Câmara de Notícias', orgao: 'Câmara dos Deputados', categoria: 'Política', icone: 'account_balance', url: 'https://www.camara.leg.br/noticias', descricao: 'Projetos, votações e debates da Câmara dos Deputados.' },
    { nome: 'Agência Senado', orgao: 'Senado Federal', categoria: 'Política', icone: 'gavel', url: 'https://www12.senado.leg.br/noticias', descricao: 'Notícias das votações, comissões e sessões do Senado.' },
    { nome: 'Agência Brasil', orgao: 'Empresa Brasil de Comunicação (EBC)', categoria: 'Brasil', icone: 'public', url: 'https://agenciabrasil.ebc.com.br/', descricao: 'Agência pública de notícias com cobertura nacional.' },
    { nome: 'Notícias do Governo Federal', orgao: 'gov.br', categoria: 'Brasil', icone: 'flag', url: 'https://www.gov.br/pt-br/noticias', descricao: 'Comunicados oficiais de ministérios e órgãos federais.' },
    { nome: 'Notícias do TSE', orgao: 'Tribunal Superior Eleitoral', categoria: 'Eleições', icone: 'how_to_vote', url: 'https://www.tse.jus.br/comunicacao/noticias', descricao: 'Calendário eleitoral, candidaturas e regras das eleições.' },
    { nome: 'Notícias do STF', orgao: 'Supremo Tribunal Federal', categoria: 'Justiça', icone: 'balance', url: 'https://noticias.stf.jus.br/', descricao: 'Julgamentos e decisões do Supremo Tribunal Federal.' },
  ];
  protected readonly categorias = ['Todas', 'Política', 'Brasil', 'Eleições', 'Justiça'];
  protected readonly categoria = signal('Todas');
  protected readonly visiveis = computed(() =>
    this.categoria() === 'Todas' ? this.fontes : this.fontes.filter((f) => f.categoria === this.categoria()),
  );
}
