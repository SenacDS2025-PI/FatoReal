import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AvisosService } from './core/avisos.service';
import { MensagensService } from './core/mensagens.service';
import { NotificacoesService } from './core/notificacoes.service';
import { ProgressoService } from './core/progresso.service';
import { TemaService } from './core/tema.service';
import { tempoAtras } from './core/util';
import { Avatar, AvisoDemo, Icone } from './shared/componentes';

type Contador = 'comunidades' | 'mensagens';

/** Casca do app, como na apresentação: barra superior escura, menu lateral, painel claro e navegação inferior no celular. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone, Avatar, AvisoDemo],
  templateUrl: './app.html',
})
export class App {
  protected auth = inject(AuthService);
  protected avisos = inject(AvisosService);
  protected tema = inject(TemaService);
  protected progresso = inject(ProgressoService);
  protected notificacoes = inject(NotificacoesService);
  protected mensagens = inject(MensagensService);
  private router = inject(Router);

  protected readonly menuAberto = signal(false);
  protected readonly notifAberto = signal(false);
  protected readonly tempo = tempoAtras;
  protected readonly iconesNotif = { curtida: 'thumb_up', comentario: 'chat_bubble', mensagem: 'mail' };

  protected readonly menu: { rota: string; cor: string; icone: string; texto: string; exato?: boolean; contador?: Contador }[] = [
    { rota: '/', cor: '#00c27a', icone: 'home', texto: 'Início', exato: true },
    { rota: '/noticias', cor: '#1e6bff', icone: 'newspaper', texto: 'Notícias' },
    { rota: '/politicos', cor: '#7c4dff', icone: 'person', texto: 'Candidatos' },
    { rota: '/base-da-politica', cor: '#ffb000', icone: 'school', texto: 'Base da Política' },
    { rota: '/comunidades', cor: '#ff7a1a', icone: 'groups', texto: 'Comunidades', contador: 'comunidades' },
    { rota: '/fatobot', cor: '#00b8d9', icone: 'smart_toy', texto: 'IA FatoBot' },
    { rota: '/verificar', cor: '#00c27a', icone: 'fact_check', texto: 'Verificar Informação' },
    { rota: '/mensagens', cor: '#ff3d7f', icone: 'chat', texto: 'Mensagens', contador: 'mensagens' },
    { rota: '/perfil', cor: '#1e6bff', icone: 'account_circle', texto: 'Meu Perfil' },
  ];

  protected readonly abas = [
    { rota: '/', texto: 'Início', exato: true },
    { rota: '/noticias', texto: 'Notícias', exato: false },
    { rota: '/comunidades', texto: 'Comunidades', exato: false },
    { rota: '/fatobot', texto: 'IA', exato: false },
    { rota: '/base-da-politica', texto: 'Base da Política', exato: false },
  ];

  constructor() {
    // Atualiza os números vermelhos ao trocar de página e ao entrar/sair da conta
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuAberto.set(false);
      this.notifAberto.set(false);
      this.notificacoes.atualizar();
    });
    effect(() => {
      this.auth.usuario();
      this.notificacoes.atualizar();
    });
  }

  protected contador(c?: Contador): number {
    if (!c) return 0;
    if (c === 'mensagens') return this.mensagens.naoLidas();
    return this.notificacoes.novasNasComunidades();
  }

  /** Sino: abre o painel com as últimas notificações (ou manda entrar, se não estiver logado). */
  protected async alternarNotificacoes(): Promise<void> {
    if (!this.auth.logado()) {
      this.router.navigate(['/entrar'], { queryParams: { voltar: '/notificacoes' } });
      return;
    }
    this.menuAberto.set(false);
    if (this.notifAberto()) {
      this.notifAberto.set(false);
      return;
    }
    await this.notificacoes.atualizar();
    this.notifAberto.set(true);
  }

  protected fecharNotificacoes(): void {
    this.notifAberto.set(false);
    this.notificacoes.marcarComoVistas();
  }

  protected buscar(termo: string): void {
    this.router.navigate(['/politicos'], { queryParams: termo.trim() ? { q: termo.trim() } : {} });
  }

  protected async sair(): Promise<void> {
    this.menuAberto.set(false);
    await this.auth.sair();
    this.avisos.mostrar('Você saiu da sua conta.');
    this.router.navigateByUrl('/');
  }

  @HostListener('document:keydown.escape')
  protected fecharMenu(): void {
    this.menuAberto.set(false);
    if (this.notifAberto()) this.fecharNotificacoes();
  }
}
