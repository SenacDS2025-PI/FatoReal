import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { DetalhesPolitico, alertasDe, detalhesCamara, rotaPolitico, todosDoCargo } from '../../core/politicos.service';
import { Avatar, Icone } from '../../shared/componentes';
import { Faixa } from '../../shared/faixa';

interface Lado {
  politico: Politico | null;
  detalhes: DetalhesPolitico | null;
  registros: number | null;
  carregando: boolean;
}

const VAZIO: Lado = { politico: null, detalhes: null, registros: null, carregando: false };

/** Compara dois deputados federais lado a lado, só com dados oficiais (sem dizer quem é "melhor"). */
@Component({
  selector: 'app-comparar',
  imports: [FormsModule, RouterLink, Avatar, Icone, Faixa],
  template: `
    <a routerLink="/eleicoes" class="link-voltar"><app-icone nome="arrow_back" /> Voltar para Eleições</a>
    <app-faixa sobretitulo="Eleições · Comparar" icone="compare_arrows" titulo="Dois deputados, lado a lado"
      texto="Escolha dois deputados federais e veja os dados oficiais da atuação deles na legislatura atual. Aqui ninguém diz quem é melhor: você tira suas conclusões."
      imagem="img/capa-camara-e-senado-em-pauta.svg" fonte="Fonte: Câmara dos Deputados" [cores]="['#881337', '#be123c', '#fb7185']" />

    <datalist id="lista-deputados">
      @for (d of todos(); track d.id) { <option [value]="d.nome + ' (' + d.partido + '-' + d.uf + ')'"></option> }
    </datalist>

    <div class="cmp-duelo">
      @for (i of [0, 1]; track i) {
        @let l = lados()[i];
        <section class="card cmp-lado" [attr.data-lado]="i" [class.vazio-lado]="!l.politico">
          @if (l.politico; as p) {
            <a [routerLink]="rotaPolitico(p)" class="cmp-foto"><app-avatar class="avatar-oficial" [nome]="p.nome" [url]="p.foto_url" [tamanho]="104" /></a>
            <strong class="cmp-nome">{{ p.nome }}</strong>
            <span class="cmp-chips"><span>{{ p.partido }}</span><span>{{ p.uf }}</span><span>Deputado(a) federal</span></span>
          } @else {
            <span class="cmp-silhueta" aria-hidden="true"><app-icone nome="person_search" /></span>
            <strong class="cmp-nome">{{ i === 0 ? 'Escolha o primeiro' : 'Escolha o segundo' }}</strong>
          }
          <div class="campo-com-icone cmp-busca">
            <app-icone nome="search" />
            <label [for]="'cmp-' + i" class="sr-only">{{ i === 0 ? 'Primeiro deputado' : 'Segundo deputado' }}</label>
            <input [id]="'cmp-' + i" list="lista-deputados" [placeholder]="carregandoLista() ? 'Carregando lista...' : 'Digite um nome'"
              [value]="l.politico?.nome ?? ''" (change)="escolher(i, $any($event.target).value)" autocomplete="off" />
          </div>
        </section>
        @if (i === 0) { <span class="cmp-vs" aria-hidden="true">VS</span> }
      }
    </div>

    <div class="cmp-metricas">
      @for (m of metricas; track m.chave) {
        <section class="card cmp-metrica" [style.--cor]="m.cor">
          <h2><span class="icone-tile"><app-icone [nome]="m.icone" /></span> {{ m.rotulo }}</h2>
          <p class="texto-suave">{{ m.explica }}</p>
          @for (l of lados(); track $index; let i = $index) {
            <div class="cmp-barra-linha" [attr.data-lado]="i">
              <span class="cmp-quem">{{ l.politico ? primeiroNome(l.politico.nome) : (i === 0 ? '1º' : '2º') }}</span>
              <span class="cmp-trilha">
                @if (l.carregando) { <span class="esqueleto"></span> }
                @else { <span class="cmp-enche" [style.width.%]="largura(m.chave, i)"></span> }
              </span>
              <strong>{{ l.carregando ? '...' : l.politico ? valor(m.chave, l) : '—' }}</strong>
            </div>
          }
        </section>
      }
    </div>
    <p class="nota-fontes"><app-icone nome="verified" /> Dados: API de Dados Abertos da Câmara (proposições desde fevereiro de 2023, comissões atuais e cota parlamentar no ano) e registros verificados com fonte oficial. Números não medem sozinhos a qualidade de um mandato. Processo não é condenação.</p>
  `,
})
export class CompararPage implements OnInit {
  private rota = inject(ActivatedRoute);
  private router = inject(Router);
  protected readonly rotaPolitico = rotaPolitico;
  protected readonly todos = signal<Politico[]>([]);
  protected readonly carregandoLista = signal(true);
  protected readonly lados = signal<Lado[]>([{ ...VAZIO }, { ...VAZIO }]);
  private readonly moeda = new CurrencyPipe('pt-BR');

  protected readonly metricas = [
    { chave: 'proposicoes', rotulo: 'Proposições apresentadas', icone: 'description', cor: '#4f46e5', explica: 'Projetos de lei, emendas e requerimentos desde 2023.' },
    { chave: 'comissoes', rotulo: 'Comissões atuais', icone: 'groups', cor: '#0369a1', explica: 'Grupos onde os projetos são discutidos antes do plenário.' },
    { chave: 'cota', rotulo: 'Cota parlamentar no ano', icone: 'payments', cor: '#d97706', explica: 'Verba do mandato. Gastar mais não quer dizer irregularidade.' },
    { chave: 'registros', rotulo: 'Polêmicas e Justiça', icone: 'report', cor: '#be123c', explica: 'Registros com fonte oficial (STF, TSE, CNJ...).' },
  ];

  protected primeiroNome(n: string) {
    return n.split(' ')[0];
  }

  /** Número da métrica, para o tamanho da barra (null = sem dado). */
  private numero(chave: string, l: Lado): number | null {
    const d = l.detalhes;
    switch (chave) {
      case 'proposicoes': return d?.totalProposicoes ?? null;
      case 'comissoes': return d ? d.comissoes.length : null;
      case 'cota': return d?.despesas?.total ?? null;
      case 'registros': return l.registros;
    }
    return null;
  }

  protected largura(chave: string, i: number): number {
    const vs = this.lados().map((l) => this.numero(chave, l) ?? 0);
    const max = Math.max(...vs);
    return max ? Math.max(4, (vs[i] / max) * 100) : 0;
  }

  async ngOnInit() {
    const q = this.rota.snapshot.queryParamMap;
    try {
      this.todos.set(await todosDoCargo('Deputado(a) Federal'));
    } finally {
      this.carregandoLista.set(false);
    }
    const ids = [Number(q.get('a')), Number(q.get('b'))];
    ids.forEach((id, i) => {
      const p = this.todos().find((x) => x.id === id);
      if (p) this.carregarLado(i, p);
    });
  }

  protected escolher(i: number, texto: string) {
    const nome = texto.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
    const p = this.todos().find((x) => x.nome.toLowerCase() === nome);
    if (p) this.carregarLado(i, p);
  }

  private async carregarLado(i: number, p: Politico) {
    this.atualizar(i, { politico: p, detalhes: null, registros: null, carregando: true });
    this.router.navigate([], { queryParams: { [i === 0 ? 'a' : 'b']: p.id }, queryParamsHandling: 'merge', replaceUrl: true });
    const [det, reg] = await Promise.allSettled([detalhesCamara(p.id), alertasDe(p)]);
    this.atualizar(i, {
      politico: p, carregando: false,
      detalhes: det.status === 'fulfilled' ? det.value : null,
      registros: reg.status === 'fulfilled' ? reg.value.length : null,
    });
  }

  private atualizar(i: number, l: Lado) {
    this.lados.update((ls) => ls.map((x, j) => (j === i ? l : x)));
  }

  protected valor(chave: string, l: Lado): string {
    const d = l.detalhes;
    switch (chave) {
      case 'partido': return `${l.politico?.partido ?? 'n/d'} · ${l.politico?.uf ?? 'n/d'}`;
      case 'proposicoes': return d?.totalProposicoes != null ? String(d.totalProposicoes) : 'sem dados';
      case 'comissoes': return d ? String(d.comissoes.length) : 'sem dados';
      case 'cota': return d?.despesas ? `${this.moeda.transform(d.despesas.total, 'BRL', 'symbol', '1.0-0')} (${d.despesas.ano}${d.despesas.parcial ? ', parcial' : ''})` : 'sem dados';
      case 'registros': return l.registros == null ? 'sem dados' : l.registros === 0 ? 'nenhum registro' : `${l.registros} ${l.registros === 1 ? 'registro' : 'registros'}`;
    }
    return '';
  }
}
