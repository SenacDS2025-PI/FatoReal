import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { AvisosService } from './core/avisos.service';
import { MensagensService } from './core/mensagens.service';
import { NotificacoesService } from './core/notificacoes.service';
import { TemaService } from './core/tema.service';
import { CordinhaTema } from './shared/cordinha-tema';
import { BuscaGeralService, ResultadoBusca } from './core/busca-geral';
import { AcessibilidadeService } from './core/acessibilidade.service';
import { tempoAtras } from './core/util';
import { Avatar, AvisoDemo, Icone } from './shared/componentes';
import { BoasVindas } from './shared/boas-vindas';
import { DestaqueLateral } from './shared/destaque-lateral';
import { FatoBotBolha, PerguntarFatobot } from './shared/fatobot-bolha';
import { TawkChat } from './shared/tawk-chat';

type Contador = 'comunidades' | 'mensagens';

/** Casca do app, como na apresentação: barra superior escura, menu lateral, painel claro e navegação inferior no celular. */
@Component({
  selector: 'app-root',
  imports: [CordinhaTema, RouterOutlet, RouterLink, RouterLinkActive, Icone, Avatar, AvisoDemo, BoasVindas, FatoBotBolha, PerguntarFatobot, DestaqueLateral, TawkChat],
  templateUrl: './app.html',
})
export class App {
  protected auth = inject(AuthService);
  protected avisos = inject(AvisosService);
  protected tema = inject(TemaService);
  private acessibilidade = inject(AcessibilidadeService);
  protected notificacoes = inject(NotificacoesService);
  protected mensagens = inject(MensagensService);
  private router = inject(Router);

  protected readonly menuAberto = signal(false);
  protected readonly notifAberto = signal(false);
  protected readonly tempo = tempoAtras;
  protected readonly iconesNotif = { curtida: 'thumb_up', comentario: 'chat_bubble', mensagem: 'mail', politico: 'account_balance' };

  /** Navegação principal (com a cor de cada seção, como no desenho original). */
  protected readonly menu: { rota: string; cor: string; icone: string; texto: string; exato?: boolean; contador?: Contador; tambem?: string[] }[] = [
    { rota: '/', cor: '#00c27a', icone: 'home', texto: 'Início', exato: true },
    { rota: '/noticias', cor: '#1e6bff', icone: 'newspaper', texto: 'Notícias' },
    { rota: '/politicos', cor: '#7c4dff', icone: 'account_balance', texto: 'Políticos', tambem: ['/congresso'] },
    { rota: '/base-da-politica', cor: '#ffb000', icone: 'school', texto: 'Base da Política' },
    { rota: '/comunidades', cor: '#ff7a1a', icone: 'groups', texto: 'Comunidades', contador: 'comunidades' },
  ];
  /** Parte de baixo da navegação: o que é da pessoa. */
  protected readonly menuPessoal: { rota: string; cor: string; icone: string; texto: string; contador?: Contador }[] = [
    { rota: '/perfil', cor: '#1e6bff', icone: 'account_circle', texto: 'Meu Perfil' },
    { rota: '/mensagens', cor: '#ff3d7f', icone: 'chat', texto: 'Mensagens', contador: 'mensagens' },
  ];
  /** Rota atual, para manter "Políticos" ativo também em /congresso. */
  protected readonly rotaAtual = signal('');
  protected ativoTambem(item: { tambem?: string[] }) {
    return !!item.tambem?.some((r) => this.rotaAtual().startsWith(r));
  }

  protected readonly abas = [
    { rota: '/', texto: 'Início', exato: true },
    { rota: '/politicos', texto: 'Políticos', exato: false },
    { rota: '/noticias', texto: 'Notícias', exato: false },
    { rota: '/fato-ou-fake', texto: 'Fato ou Fake', exato: false },
    { rota: '/comunidades', texto: 'Comunidades', exato: false },
    { rota: '/base-da-politica', texto: 'Base da Política', exato: false },
    // No celular a engrenagem sai da barra de cima: Configurações fica aqui
    { rota: '/configuracoes', texto: 'Configurações', exato: false },
  ];

  constructor() {
    // Atualiza os números vermelhos ao trocar de página e ao entrar/sair da conta
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.menuAberto.set(false);
      this.rotaAtual.set(this.router.url);
      this.notifAberto.set(false);
      this.notificacoes.atualizar();
      this.mensagens.atualizarContagem();
    });
    effect(() => {
      this.auth.usuario();
      this.notificacoes.atualizar();
      this.mensagens.atualizarContagem();
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

  // ---------- Busca do topo com sugestões ----------
  private buscaGeral = inject(BuscaGeralService);
  protected readonly sugestoes = signal<ResultadoBusca[]>([]);
  protected readonly sugestoesAbertas = signal(false);
  protected readonly sugestaoAtiva = signal(-1);
  private esperaBusca?: ReturnType<typeof setTimeout>;
  private pedidoBusca = 0;

  protected digitarBusca(termo: string) {
    clearTimeout(this.esperaBusca);
    this.esperaBusca = setTimeout(async () => {
      const meu = ++this.pedidoBusca;
      const r = await this.buscaGeral.buscar(termo, 3);
      if (meu !== this.pedidoBusca) return;
      this.sugestoes.set(r.slice(0, 8));
      this.sugestaoAtiva.set(-1);
      this.sugestoesAbertas.set(r.length > 0);
    }, 220);
  }

  protected moverSugestao(passo: number) {
    const n = this.sugestoes().length;
    if (!n) return;
    this.sugestoesAbertas.set(true);
    this.sugestaoAtiva.update((i) => (i + passo + n) % n);
  }

  protected enterBusca(e: Event, campo: HTMLInputElement) {
    const r = this.sugestoes()[this.sugestaoAtiva()];
    if (this.sugestoesAbertas() && r) {
      e.preventDefault();
      this.abrirSugestao(r, campo);
    }
  }

  protected abrirSugestao(r: ResultadoBusca, campo: HTMLInputElement) {
    this.sugestoesAbertas.set(false);
    campo.blur();
    if (r.externo) window.open(r.externo, '_blank', 'noopener');
    else this.router.navigate(r.rota ?? ['/'], { queryParams: r.query });
  }

  protected fecharSugestoesDepois() {
    setTimeout(() => this.sugestoesAbertas.set(false), 150);
  }

  /** Dica do campo de busca: vai trocando para mostrar o que dá para pesquisar. */
  private readonly dicas = [
    'Pesquise um político, partido ou estado...',
    'Ex.: deputados de Pernambuco',
    'Ex.: PT, PL, MDB...',
    'Ex.: saúde, educação, SUS',
    'Ex.: comunidade Memes da Política',
    'Ex.: o que é medida provisória?',
  ];
  protected readonly dicaBusca = signal(this.dicas[0]);
  private indiceDica = 0;
  private relogioDica = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : setInterval(() => {
    if (document.activeElement?.id === 'busca-topo') return;
    this.indiceDica = (this.indiceDica + 1) % this.dicas.length;
    this.dicaBusca.set(this.dicas[this.indiceDica]);
  }, 4000);

  /** Atalho: apertar "/" em qualquer lugar leva para a busca. */
  @HostListener('document:keydown', ['$event'])
  protected atalhoBusca(e: KeyboardEvent) {
    const alvo = e.target as HTMLElement;
    if (e.key !== '/' || /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName) || alvo.isContentEditable) return;
    const campo = document.getElementById('busca-topo') as HTMLInputElement | null;
    if (campo && campo.offsetParent) { e.preventDefault(); campo.focus(); }
  }

  protected buscar(termo: string): void {
    this.sugestoesAbertas.set(false);
    if (termo.trim()) this.router.navigate(['/busca'], { queryParams: { q: termo.trim() } });
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
