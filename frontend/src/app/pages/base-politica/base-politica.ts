import { Component } from '@angular/core';
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

    <section class="card">
      <h2><app-icone nome="menu_book" /> Glossário</h2>
      <dl class="glossario">
        @for (g of glossario; track g[0]) {
          <div><dt>{{ g[0] }}</dt><dd>{{ g[1] }}</dd></div>
        }
      </dl>
      <p class="fonte">
        <app-icone nome="verified" /> Fonte: Constituição Federal de 1988 (<a href="https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm" target="_blank" rel="noopener noreferrer">planalto.gov.br</a>)
      </p>
    </section>

    <div class="card aviso-participar">
      <app-icone nome="smart_toy" />
      <p>Ficou com dúvida? Pergunte ao FatoBot: ele explica em linguagem simples e mostra de onde veio a informação.</p>
      <a routerLink="/fatobot" class="botao botao-verde">Perguntar ao FatoBot</a>
    </div>
  `,
})
export class BasePoliticaPage {
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
  ];
}
