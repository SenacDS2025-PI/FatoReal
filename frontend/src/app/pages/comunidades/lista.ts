import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Comunidade } from '../../core/modelos';
import { Icone, PluralPipe } from '../../shared/componentes';
import { VistosService } from '../../core/vistos.service';
import { NotificacoesService } from '../../core/notificacoes.service';
import { capaComunidade, avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';

@Component({
  selector: 'app-comunidades',
  imports: [FormsModule, RouterLink, Icone, PluralPipe],
  templateUrl: './lista.html',
})
export class ComunidadesPage implements OnInit {
  private service = inject(ComunidadesService);
  protected auth = inject(AuthService);
  protected termo = '';
  protected readonly capa = capaComunidade;
  protected readonly corTema = COR_TEMA;
  protected readonly avatar = avatarComunidade;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly lista = signal<Comunidade[]>([]);
  protected readonly erro = signal('');

  private vistos = inject(VistosService);
  private notificacoes = inject(NotificacoesService);

  ngOnInit() {
    this.vistos.marcar('comunidades');
    this.notificacoes.novasNasComunidades.set(0);
    this.carregar();
  }

  protected async carregar() {
    try {
      this.erro.set('');
      this.lista.set(await this.service.listar(this.termo));
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    }
  }
}
