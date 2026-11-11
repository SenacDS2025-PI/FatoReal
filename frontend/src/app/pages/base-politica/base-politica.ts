import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, computed, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/componentes';

interface Topico {
  pergunta: string;
  resposta: string;
}
interface Termo {
  termo: string;
  categoria: string;
  icone: string;
  definicao: string;
  /** Exemplo concreto, para a ideia ficar clara. */
  exemplo: string;
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

    <section class="card glossario-carrossel" aria-roledescription="carrossel" aria-labelledby="titulo-glossario"
      (mouseenter)="pausado.set(true)" (mouseleave)="pausado.set(false)" (focusin)="aoFocar($event)" (focusout)="pausado.set(false)">
      <div class="glossario-topo">
        <div>
          <h2 id="titulo-glossario"><app-icone nome="menu_book" /> Glossário</h2>
          <p class="glossario-sub">{{ glossario.length }} termos que aparecem no noticiário político, explicados em uma frase.</p>
        </div>
        <div class="glossario-controles">
          <span class="glossario-contador" aria-live="polite">{{ visiveis() > 1 && termos().length > 1 ? atual() + 1 + '–' + min(atual() + visiveis(), termos().length) : atual() + 1 }} de {{ termos().length }}</span>
          <button type="button" class="botao-seta" (click)="ir(atual() - 1)" [disabled]="atual() === 0" aria-label="Termo anterior"><app-icone nome="chevron_left" /></button>
          <button type="button" class="botao-seta" (click)="ir(atual() + 1)" [disabled]="atual() >= ultimaPosicao()" aria-label="Próximo termo"><app-icone nome="chevron_right" /></button>
        </div>
      </div>

      <div class="glossario-filtros" role="tablist" aria-label="Filtrar por categoria">
        @for (c of categorias; track c) {
          <button type="button" role="tab" [attr.aria-selected]="categoria() === c" (click)="filtrar(c)">{{ c }}</button>
        }
      </div>

      <ul #trilho class="glossario-trilho" (scroll)="aoRolar()" tabindex="0" aria-label="Termos do glossário" (keydown.arrowRight)="$event.preventDefault(); ir(atual() + 1)" (keydown.arrowLeft)="$event.preventDefault(); ir(atual() - 1)">
        @for (g of termos(); track g.termo; let i = $index) {
          <li class="glossario-item" [attr.aria-label]="(i + 1) + ' de ' + termos().length" [attr.data-cor]="i % 3">
            <div class="glossario-cabeca">
              <span class="glossario-icone" aria-hidden="true"><app-icone [nome]="g.icone" /></span>
              <span class="glossario-categoria">{{ g.categoria }}</span>
            </div>
            <h3>{{ g.termo }}</h3>
            <p class="glossario-def">{{ g.definicao }}</p>
            <div class="glossario-pratica"><strong><app-icone nome="lightbulb" /> Na prática</strong><span>{{ g.exemplo }}</span></div>
            <a class="glossario-bot" routerLink="/fatobot" [queryParams]="{ p: 'O que é ' + g.termo + ' e como funciona no Brasil?' }" [attr.tabindex]="i >= atual() && i < atual() + visiveis() ? 0 : -1">
              <app-icone nome="smart_toy" /> Perguntar ao FatoBot
            </a>
          </li>
        }
      </ul>
      <div class="glossario-pontos" role="tablist" aria-label="Escolher termo">
        @for (i of posicoes(); track i) {
          <button type="button" role="tab" [attr.aria-selected]="i === atual()" [attr.aria-label]="'A partir de ' + termos()[i].termo" (click)="ir(i)">
            <span [style.animation-play-state]="pausado() ? 'paused' : 'running'"></span>
          </button>
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
export class BasePoliticaPage implements AfterViewInit, OnDestroy {
  private readonly trilho = viewChild.required<ElementRef<HTMLUListElement>>('trilho');
  /** Índice do primeiro termo visível. */
  protected readonly atual = signal(0);
  /** Quantos termos cabem na tela ao mesmo tempo (3 no computador, 1 no celular). */
  protected readonly visiveis = signal(1);
  protected readonly categoria = signal('Todos');
  protected readonly termos = computed(() =>
    this.categoria() === 'Todos' ? this.glossario : this.glossario.filter((g) => g.categoria === this.categoria()),
  );
  protected readonly ultimaPosicao = computed(() => Math.max(0, this.termos().length - this.visiveis()));
  protected readonly min = Math.min;
  protected readonly posicoes = computed(() => Array.from({ length: this.ultimaPosicao() + 1 }, (_, i) => i));

  /** Carrossel "vivo": avança sozinho a cada 3 s; pausa com o mouse em cima ou com o foco do teclado. */
  protected readonly pausado = signal(false);
  private timer?: ReturnType<typeof setInterval>;
  private decorrido = 0;
  private static readonly INTERVALO = 3;

  ngAfterViewInit() {
    this.medir();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => {
      if (this.pausado() || document.hidden) {
        this.decorrido = 0;
        return;
      }
      if (++this.decorrido >= BasePoliticaPage.INTERVALO) this.ir(this.atual() >= this.ultimaPosicao() ? 0 : this.atual() + 1);
    }, 1000);
  }

  ngOnDestroy() {
    clearInterval(this.timer);
  }

  protected filtrar(c: string) {
    this.categoria.set(c);
    this.atual.set(0);
    this.decorrido = 0;
    setTimeout(() => {
      this.trilho().nativeElement.scrollTo({ left: 0 });
      this.medir();
    });
  }

  /** Pausa quando a pessoa navega pelo teclado (Tab); um clique com o mouse não trava o carrossel. */
  protected aoFocar(e: FocusEvent) {
    if ((e.target as HTMLElement).matches(':focus-visible')) this.pausado.set(true);
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
    this.atual.set(destino);
    this.decorrido = 0;
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

  protected readonly glossario: Termo[] = [
    { termo: 'Projeto de lei (PL)', categoria: 'Leis', icone: 'description',
      definicao: 'Proposta de nova lei ou de mudança em uma lei existente.',
      exemplo: 'O texto passa por comissões e pelo plenário da Câmara e do Senado antes de ir para sanção.' },
    { termo: 'PEC', categoria: 'Leis', icone: 'menu_book',
      definicao: 'Proposta de Emenda à Constituição. Precisa ser aprovada em dois turnos em cada Casa, por três quintos dos votos.',
      exemplo: 'Mudar algo escrito na Constituição, como regras de aposentadoria, exige uma PEC.' },
    { termo: 'Lei complementar', categoria: 'Leis', icone: 'library_books',
      definicao: 'Lei que regulamenta assuntos que a Constituição manda tratar dessa forma. Precisa de maioria absoluta.',
      exemplo: 'A Lei de Responsabilidade Fiscal (LC 101/2000) é uma lei complementar.' },
    { termo: 'Medida provisória', categoria: 'Executivo', icone: 'bolt',
      definicao: 'Ato do presidente com força de lei imediata, em casos de relevância e urgência.',
      exemplo: 'Vale assim que é publicada, mas perde a validade se o Congresso não aprovar em até 60 dias, prorrogáveis por mais 60.' },
    { termo: 'Sanção e veto', categoria: 'Executivo', icone: 'approval',
      definicao: 'Sanção é a aprovação de um projeto pelo chefe do Executivo; veto é a recusa, total ou parcial.',
      exemplo: 'Depois que o Congresso aprova um projeto, o presidente tem 15 dias úteis para sancionar ou vetar.' },
    { termo: 'Plenário', categoria: 'Congresso', icone: 'groups',
      definicao: 'Reunião de todos os parlamentares de uma Casa para votar.',
      exemplo: 'É no plenário que acontece a votação final de um projeto na Câmara ou no Senado.' },
    { termo: 'Comissão', categoria: 'Congresso', icone: 'diversity_3',
      definicao: 'Grupo menor de parlamentares que analisa projetos sobre um tema antes do plenário.',
      exemplo: 'Um projeto sobre escolas costuma passar pela Comissão de Educação.' },
    { termo: 'CPI', categoria: 'Congresso', icone: 'manage_search',
      definicao: 'Comissão Parlamentar de Inquérito. Investiga um fato determinado, por prazo certo; é criada com a assinatura de um terço da Casa.',
      exemplo: 'Pode convocar pessoas para depor e pedir quebra de sigilos, mas não julga nem condena ninguém.' },
    { termo: 'Quórum', categoria: 'Congresso', icone: 'how_to_reg',
      definicao: 'Número mínimo de parlamentares presentes, ou de votos, para abrir uma votação ou aprovar uma proposta.',
      exemplo: 'Uma PEC precisa de três quintos dos votos: 308 dos 513 deputados.' },
    { termo: 'Legislatura', categoria: 'Congresso', icone: 'calendar_month',
      definicao: 'Período de quatro anos de trabalho do Congresso, igual ao mandato dos deputados federais.',
      exemplo: 'A legislatura atual começou em fevereiro de 2023 e vai até janeiro de 2027.' },
    { termo: 'Emenda parlamentar', categoria: 'Orçamento', icone: 'payments',
      definicao: 'Indicação feita por deputados e senadores de onde aplicar uma parte do Orçamento federal.',
      exemplo: 'Um deputado pode indicar verba para uma obra ou um serviço de saúde na sua região.' },
    { termo: 'Cota parlamentar', categoria: 'Orçamento', icone: 'receipt_long',
      definicao: 'Verba para despesas do mandato, como passagens, combustível e divulgação. Os gastos são públicos.',
      exemplo: 'No perfil de cada deputado, aqui no Fato Real, dá para ver esses gastos por categoria.' },
    { termo: 'Federação partidária', categoria: 'Partidos', icone: 'handshake',
      definicao: 'União de partidos que atuam juntos, como se fossem um só, por pelo menos quatro anos.',
      exemplo: 'Partidos federados disputam as eleições juntos e atuam como um bloco no Congresso.' },
  ];
  protected readonly categorias = ['Todos', 'Leis', 'Congresso', 'Executivo', 'Orçamento', 'Partidos'];
}
