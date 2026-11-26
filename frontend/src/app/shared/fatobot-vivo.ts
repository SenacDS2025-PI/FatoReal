import { Component, input } from '@angular/core';

/**
 * FatoBot animado (corpo inteiro): respira, flutua e balança, a lupa brilha e ele pisca.
 * Tudo em CSS sobre a mesma imagem (img/fatobot.webp); respeita "reduzir movimento".
 * As posições do olho e da lente são em % da imagem — se a arte mudar, ajuste em styles.scss (.bot-vivo).
 */
@Component({
  selector: 'app-fatobot-vivo',
  template: `
    <span class="bot-vivo" [style.--bot-alt]="altura()" aria-hidden="true">
      <span class="bot-sombra"></span>
      <span class="bot-corpo">
        <img src="img/fatobot.webp" alt="" />
        <span class="bot-olho"></span>
        <span class="bot-lente"><span class="bot-brilho"></span></span>
      </span>
    </span>
  `,
})
export class FatobotVivo {
  /** Altura do robô, ex.: '170px'. */
  readonly altura = input('170px');
}
