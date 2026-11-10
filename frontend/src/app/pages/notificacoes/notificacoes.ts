import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificacoesService } from '../../core/notificacoes.service';
import { VistosService } from '../../core/vistos.service';
import { tempoAtras } from '../../core/util';
import { Icone } from '../../shared/componentes';

@Component({
  selector: 'app-notificacoes',
  imports: [RouterLink, Icone],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="notifications" /> Notificações</h1>
      <p>Curtidas e comentários nas suas publicações e mensagens novas.</p>
    </header>
    <ul class="card lista-notificacoes">
      @for (n of service.lista(); track n.id) {
        <li [class.nova]="n.data > vistoAntes">
          <a [routerLink]="n.rota">
            <span class="notif-icone" [attr.data-tipo]="n.tipo"><app-icone [nome]="icones[n.tipo]" /></span>
            <span><strong>{{ n.texto }}</strong><small>{{ tempo(n.data) }}</small></span>
          </a>
        </li>
      } @empty {
        <li class="vazio"><app-icone nome="notifications_off" /><p>Nada por aqui ainda. Participe das comunidades para receber notificações.</p></li>
      }
    </ul>
  `,
})
export class NotificacoesPage implements OnInit {
  protected service = inject(NotificacoesService);
  private vistos = inject(VistosService);
  protected readonly tempo = tempoAtras;
  protected readonly icones = { curtida: 'thumb_up', comentario: 'chat_bubble', mensagem: 'mail' };
  /** Data da visita anterior: o que for mais novo aparece destacado. */
  protected vistoAntes = this.vistos.datas().notificacoes;

  async ngOnInit() {
    await this.service.atualizar();
    this.service.marcarComoVistas();
  }
}
