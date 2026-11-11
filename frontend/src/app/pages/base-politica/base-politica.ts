import { AfterViewInit, Component, ElementRef, HostListener, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/componentes';

interface Topico {
  pergunta: string;
  resposta: string;
}
interface Trilha {
  titulo: string;
  icone: string;
  cor: string;
  topicos: Topico[];
}

/** Base da Política: área educativa para quem está começando. Tom didático e apartidário. */
@Component({
  selector: 'app-base-politica',
  imports: [RouterLink, Icone],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="school" /> Base da Política</h1>
      <p>Aprender política sem precisar já entender de política. Explicações curtas sobre como o Brasil funciona, com link para a fonte oficial.</p>
    </header>

    <section class="card glossario-carrossel" aria-roledescription="carrossel" aria-labelledby="titulo-glossario">
      <div class="glossario-topo">
        <h2 id="titulo-glossario"><app-icone nome="menu_book" /> Glossário</h2>
        <div class="glossario-controles">
          <span class="glossario-contador" aria-live="polite">{{ visiveis() > 1 ? atual() + 1 + '–' + (atual() + visiveis()) : atual() + 1 }} de {{ glossario.length }}</span>
          <button type="button" class="botao-seta" (click)="ir(atual() - 1)" [disabled]="atual() === 0" aria-label="Termo anterior"><app-icone nome="chevron_left" /></button>
          <button type="button" class="botao-seta" (click)="ir(atual() + 1)" [disabled]="atual() >= ultimaPosicao()" aria-label="Próximo termo"><app-icone nome="chevron_right" /></button>
        </div>
      </div>
      <ul #trilho class="glossario-trilho" (scroll)="aoRolar()" tabindex="0" aria-label="Termos do glossário" (keydown.arrowRight)="$event.preventDefault(); ir(atual() + 1)" (keydown.arrowLeft)="$event.preventDefault(); ir(atual() - 1)">
        @for (g of glossario; track g[0]; let i = $index) {
          <li class="glossario-item" [attr.aria-label]="(i + 1) + ' de ' + glossario.length">
            <span class="glossario-letra" aria-hidden="true">{{ g[0].charAt(0) }}</span>
            <dl><dt>{{ g[0] }}</dt><dd>{{ g[1] }}</dd></dl>
          </li>
        }
      </ul>
      <div class="glossario-pontos" role="tablist" aria-label="Escolher termo">
        @for (i of posicoes(); track i) {
          <button type="button" role="tab" [attr.aria-selected]="i === atual()" [attr.aria-label]="'A partir de ' + glossario[i][0]" (click)="ir(i)"></button>
        }
      </div>
      <p class="fonte">
        <app-icone nome="verified" /> <span>Fonte: Constituição Federal de 1988 (<a href="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" target="_blank" rel="noopener noreferrer">planalto.gov.br</a>)</span>
      </p>
    </section>

    <div class="trilhas">
      @for (t of trilhas; track t.titulo) {
        <section class="card trilha" [style.--cor-trilha]="t.cor">
          <h2><app-icone [nome]="t.icone" /> {{ t.titulo }}</h2>
          @for (tp of t.topicos; track tp.pergunta) {
            <details>
              <summary>{{ tp.pergunta }}</summary>
              <p>{{ tp.resposta }}</p>
            </details>
          }
        </section>
      }
    </div>

    <div class="card aviso-participar">
      <app-icone nome="smart_toy" />
      <p>Ficou com dúvida? Pergunte ao FatoBot: ele explica em linguagem simples e mostra de onde veio a informação.</p>
      <a routerLink="/fatobot" class="botao botao-verde">Perguntar ao FatoBot</a>
    </div>
  `,
})
export class BasePoliticaPage implements AfterViewInit {
  private readonly trilho = viewChild.required<ElementRef<HTMLUListElement>>('trilho');
  /** Índice do primeiro termo visível. */
  protected readonly atual = signal(0);
  /** Quantos termos cabem na tela ao mesmo tempo (3 no computador, 1 no celular). */
  protected readonly visiveis = signal(1);
  protected readonly ultimaPosicao = computed(() => Math.max(0, this.glossario.length - this.visiveis()));
  protected readonly posicoes = computed(() => Array.from({ length: this.ultimaPosicao() + 1 }, (_, i) => i));

  ngAfterViewInit() {
    this.medir();
  }

  @HostListener('window:resize')
  protected medir() {
    const lista = this.trilho().nativeElement;
    const passo = this.passo(lista);
    this.visiveis.set(Math.max(1, Math.round((lista.clientWidth + this.gap(lista)) / passo)));
    this.aoRolar();
  }

  /** Rola o carrossel até a posição i (com limite nas pontas). */
  protected ir(i: number) {
    const lista = this.trilho().nativeElement;
    const destino = Math.max(0, Math.min(i, this.ultimaPosicao()));
    lista.scrollTo({ left: destino * this.passo(lista), behavior: 'smooth' });
  }

  /** Atualiza o contador conforme a pessoa arrasta ou rola o carrossel. */
  protected aoRolar() {
    const lista = this.trilho().nativeElement;
    const i = Math.round(lista.scrollLeft / this.passo(lista));
    this.atual.set(Math.max(0, Math.min(i, this.ultimaPosicao())));
  }

  private gap(lista: HTMLElement): number {
    return parseFloat(getComputedStyle(lista).columnGap) || 0;
  }

  private passo(lista: HTMLElement): number {
    return ((lista.children[0] as HTMLElement | undefined)?.offsetWidth ?? 1) + this.gap(lista);
  }

  protected readonly trilhas: Trilha[] = [
    {
      titulo: 'Começar pelo básico', icone: 'lightbulb', cor: '#14a370',
      topicos: [
        { pergunta: 'O que é política?', resposta: 'É a forma como uma sociedade toma decisões coletivas: quais leis valem, como o dinheiro público é usado e quais serviços o Estado oferece. Ela acontece nas eleições, mas também no dia a dia, quando as pessoas debatem, se organizam e cobram seus representantes.' },
        { pergunta: 'O que é democracia?', resposta: 'É o regime em que o poder vem do povo. No Brasil, a Constituição diz que todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente (por plebiscito, referendo e projetos de lei de iniciativa popular).' },
        { pergunta: 'Quais são os três Poderes?', resposta: 'Legislativo (faz as leis e fiscaliza), Executivo (administra e executa as políticas públicas) e Judiciário (julga conflitos e garante o cumprimento das leis). A Constituição diz que eles são independentes e harmônicos entre si.' },
        { pergunta: 'Como o Estado brasileiro é organizado?', resposta: 'O Brasil é uma federação formada pela União, pelos 26 estados, pelo Distrito Federal e pelos municípios. Cada um tem autonomia e responsabilidades próprias definidas pela Constituição.' },
      ],
    },
    {
      titulo: 'Entender o Brasil', icone: 'account_balance', cor: '#eec043',
      topicos: [
        { pergunta: 'Presidência e ministérios', resposta: 'O presidente da República chefia o Executivo federal, é eleito para mandato de 4 anos e pode ser reeleito uma vez seguida. Os ministros são escolhidos pelo presidente e cuidam de áreas como saúde, educação e economia.' },
        { pergunta: 'Câmara dos Deputados e Senado', resposta: 'Juntos formam o Congresso Nacional. A Câmara tem 513 deputados federais, eleitos para 4 anos em número proporcional à população de cada estado. O Senado tem 81 senadores (3 por estado e 3 pelo DF), eleitos para 8 anos, com renovação de um terço e dois terços alternadamente a cada 4 anos.' },
        { pergunta: 'Governos estaduais', resposta: 'Cada estado tem um governador (Executivo) e uma Assembleia Legislativa formada por deputados estaduais. No Distrito Federal, o Legislativo é a Câmara Legislativa, com deputados distritais.' },
        { pergunta: 'Prefeituras e câmaras municipais', resposta: 'Cada município tem um prefeito (Executivo) e uma Câmara Municipal com vereadores (Legislativo), todos eleitos para mandatos de 4 anos.' },
      ],
    },
    {
      titulo: 'Aprender na prática', icone: 'checklist', cor: '#2f6fb0',
      topicos: [
        { pergunta: 'Como uma lei é criada?', resposta: 'Um projeto de lei é apresentado, passa por comissões e é votado no plenário da Câmara e do Senado. Se aprovado nas duas Casas, vai para o presidente, que pode sancionar (aprovar) ou vetar. O Congresso pode derrubar o veto.' },
        { pergunta: 'Como acompanhar um político?', resposta: 'Use a busca do Fato Real para ver dados oficiais e abra o link da Câmara para ver projetos, votações e presença. Sempre confira a data de atualização da informação.' },
        { pergunta: 'Como checar uma notícia antes de compartilhar?', resposta: 'Veja quem publicou, procure a fonte original (documento, votação, órgão oficial), confira a data e se o conteúdo não está fora de contexto. Na dúvida, use a página Verificar Informação.' },
      ],
    },
  ];

  protected readonly glossario: [string, string][] = [
    ['Projeto de lei (PL)', 'Proposta de nova lei ou de mudança em uma lei existente.'],
    ['PEC', 'Proposta de Emenda à Constituição. Precisa ser aprovada em dois turnos em cada Casa do Congresso, por pelo menos três quintos dos votos.'],
    ['Medida provisória', 'Ato do presidente com força de lei imediata, em casos de relevância e urgência. Perde a validade se o Congresso não a aprovar em até 60 dias, prorrogáveis por mais 60.'],
    ['Sanção e veto', 'Sanção é a aprovação de um projeto pelo chefe do Executivo; veto é a recusa, total ou parcial.'],
    ['Plenário', 'Reunião de todos os parlamentares de uma Casa para votar.'],
    ['Comissão', 'Grupo menor de parlamentares que analisa projetos sobre um tema antes do plenário.'],
    ['CPI', 'Comissão Parlamentar de Inquérito. Investiga um fato determinado, por prazo certo, e é criada com a assinatura de um terço dos membros da Casa.'],
    ['Lei complementar', 'Lei que regulamenta assuntos que a Constituição manda tratar dessa forma. Precisa de maioria absoluta para ser aprovada.'],
    ['Quórum', 'Número mínimo de parlamentares presentes, ou de votos, exigido para abrir uma votação ou aprovar uma proposta.'],
    ['Legislatura', 'Período de quatro anos de trabalho do Congresso, que coincide com o mandato dos deputados federais.'],
    ['Emenda parlamentar', 'Indicação feita por deputados e senadores de onde aplicar uma parte do Orçamento federal, como obras e serviços nos estados e municípios.'],
    ['Cota parlamentar', 'Verba para despesas do mandato, como passagens, combustível e divulgação. Os gastos de cada deputado são públicos.'],
    ['Federação partidária', 'União de partidos que atuam juntos, como se fossem um só, por pelo menos quatro anos.'],
  ];
}
