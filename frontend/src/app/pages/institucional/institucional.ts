import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../../shared/componentes';

/** E-mail do canal de contato. TROCAR pelo e-mail oficial da equipe. */
const EMAIL_CONTATO = 'contato.fatoreal@exemplo.com';

/**
 * Textos institucionais (sobre, termos, privacidade, regras e contato).
 * Kelly / equipe de documentação: editem os textos direto aqui.
 */
@Component({
  selector: 'app-institucional',
  imports: [RouterLink, Icone],
  templateUrl: './institucional.html',
})
export class InstitucionalPage {
  /** Vem do "data" da rota: sobre | termos | privacidade | regras | contato */
  readonly pagina = input.required<'sobre' | 'termos' | 'privacidade' | 'regras' | 'contato'>();
  protected readonly email = EMAIL_CONTATO;
  protected readonly atualizado = '05/11/2026';
}
