import { Component, input } from '@angular/core';
import { Icone } from './componentes';

/** Moldura das telas de conta (entrar, criar conta, senha): ilustração e frase do Fato Real ao lado do formulário. */
@Component({
  selector: 'app-conta-moldura',
  imports: [Icone],
  template: `
    <div class="conta-tela">
      <aside class="conta-arte" aria-hidden="true">
        <img src="img/fatobot.webp" alt="" class="conta-robo" />
        <p class="conta-k">Fato Real</p>
        <h2>{{ frase() }}</h2>
        <ul>
          <li><app-icone nome="verified" /> Informação política com fonte oficial</li>
          <li><app-icone nome="groups" /> Comunidades para debater com respeito</li>
          <li><app-icone nome="fact_check" /> Confira boatos antes de compartilhar</li>
        </ul>
      </aside>
      <div class="conta-form"><ng-content /></div>
    </div>
  `,
})
export class ContaMoldura {
  readonly frase = input('Informação de verdade, conversa de verdade.');
}
