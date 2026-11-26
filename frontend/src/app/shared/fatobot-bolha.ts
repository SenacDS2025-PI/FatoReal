import { Component, Directive, ElementRef, HostListener, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { FatoBotConversa } from '../core/fatobot-conversa.service';
import { FonteDado, Icone } from './componentes';
import { SeloStatus } from './selo-status';

/** Coloque [perguntarFatobot]="'pergunta'" em qualquer botão para abrir a bolinha já com a pergunta. */
@Directive({ selector: '[perguntarFatobot]', host: { '(click)': 'abrir($event)' } })
export class PerguntarFatobot {
  private conversa = inject(FatoBotConversa);
  readonly perguntarFatobot = input<string | null | undefined>('');
  protected abrir(e: Event) {
    e.preventDefault();
    this.conversa.abrir(this.perguntarFatobot() ?? '');
  }
}

/** Dica que o FatoBot mostra num balão: pode ter um botão que pergunta algo ou leva a uma página. */
export interface Fala { chave: string; titulo: string; texto: string; acao?: string; pergunta?: string; rota?: string }

/** Parte do reconhecimento de voz do navegador que o FatoBot usa. */
interface Reconhecedor {
  lang: string;
  interimResults: boolean;
  onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (ev: { error: string }) => void;
  onend: () => void;
  start(): void;
  stop(): void;
}

/** FatoBot em bolinha flutuante: acompanha a pessoa por toda a rede social, dá dicas por página e ouve pelo microfone. */
@Component({
  selector: 'app-fatobot-bolha',
  imports: [FormsModule, RouterLink, Icone, FonteDado, SeloStatus],
  template: `
    @if (!naPaginaDoBot()) {
      @if (conversa.aberto()) {
        <section class="bolha-painel" role="dialog" aria-label="Conversa com o FatoBot">
          <header class="bolha-topo">
            <img src="img/fatobot-rosto.svg" alt="" width="40" height="40" />
            <div><strong>FatoBot</strong><small><span class="bolha-online"></span> Online · responde com fontes oficiais</small></div>
            @if (conversa.mensagens().length) { <button type="button" class="botao-icone" (click)="conversa.limpar()" aria-label="Nova conversa" title="Nova conversa"><app-icone nome="refresh" /></button> }
            <a routerLink="/fatobot" class="botao-icone" aria-label="Abrir em tela cheia" title="Tela cheia" (click)="conversa.aberto.set(false)"><app-icone nome="open_in_full" /></a>
            <button type="button" class="botao-icone" (click)="conversa.aberto.set(false)" aria-label="Minimizar"><app-icone nome="close" /></button>
          </header>
          <div class="bolha-mensagens" #lista>
            @if (!conversa.mensagens().length) {
              <div class="bolha-boasvindas">
                <p>Olá! Sou o <strong>FatoBot</strong>. Pergunte sobre leis, votações, políticos ou notícias. Eu respondo com fontes e, se não houver evidência, eu digo.</p>
                <span class="texto-suave">Sugestões para esta página:</span>
                @for (s of sugestoes(); track s) { <button type="button" class="bolha-sugestao" (click)="conversa.enviar(s)">{{ s }}</button> }
              </div>
            }
            @for (m of conversa.mensagens(); track $index) {
              <div class="bolha-msg" [class.bolha-voce]="m.autor === 'voce'">
                @if (m.autor === 'bot') { <img src="img/fatobot-rosto.svg" alt="" width="28" height="28" /> }
                <div class="bolha-balao">
                  <p>{{ m.texto }}</p>
                  @if (m.resposta; as r) {
                    @if (r.sem_evidencia) { <app-selo tipo="insuficiente" /> }
                    @else if (r.fontes.length) { <app-selo tipo="verificado" texto="Com fonte oficial" /> }
                    @for (f of r.fontes; track f.url) { <app-fonte [fonte]="f" rotulo="data" /> }
                  }
                </div>
              </div>
            }
            @if (conversa.pensando()) { <div class="bolha-msg"><img src="img/fatobot-rosto.svg" alt="" width="28" height="28" /><div class="bolha-balao bolha-digitando"><span></span><span></span><span></span></div></div> }
          </div>
          @if (ouvindo()) { <p class="bolha-ouvindo" role="status"><span class="bolha-onda"><i></i><i></i><i></i><i></i></span> Ouvindo... fale sua pergunta</p> }
          @if (erroVoz()) { <p class="bolha-ouvindo bolha-erro-voz" role="alert">{{ erroVoz() }}</p> }
          <form class="bolha-form" (submit)="$event.preventDefault(); enviar()">
            <label for="bolha-texto" class="sr-only">Pergunte ao FatoBot</label>
            <input id="bolha-texto" name="pergunta" [(ngModel)]="pergunta" [placeholder]="ouvindo() ? 'Ouvindo...' : 'Pergunte ao FatoBot...'" autocomplete="off" maxlength="500" />
            @if (temVoz) {
              <button type="button" class="bolha-mic" [class.ativo]="ouvindo()" (click)="ouvindo() ? pararDeOuvir() : ouvir()" [attr.aria-label]="ouvindo() ? 'Parar de ouvir' : 'Falar com o FatoBot'" [attr.aria-pressed]="ouvindo()"><app-icone [nome]="ouvindo() ? 'stop' : 'mic'" /></button>
            }
            <button type="submit" class="bolha-enviar" [disabled]="!pergunta.trim() || conversa.pensando()" aria-label="Enviar"><app-icone nome="send" /></button>
          </form>
          <small class="bolha-aviso">O FatoBot pode errar. Confira sempre as fontes.</small>
        </section>
      }
      @if (fala(); as f) {
        @if (!conversa.aberto()) {
          <div class="bolha-fala" role="status">
            <button type="button" class="bolha-dica-fechar" (click)="fecharFala()" aria-label="Fechar dica"><app-icone nome="close" /></button>
            <strong>{{ f.titulo }}</strong>
            <span>{{ f.texto }}</span>
            @if (f.acao) {
              <div class="bolha-fala-botoes">
                <button type="button" class="bolha-fala-sim" (click)="aceitar(f)">{{ f.acao }}</button>
                <button type="button" class="bolha-fala-nao" (click)="fecharFala()">Agora não</button>
              </div>
            }
            <button type="button" class="link-sutil bolha-desligar" (click)="desligarDicas()">Não mostrar mais dicas</button>
          </div>
        }
      }
      <button type="button" class="bolha-botao" [class.aberta]="conversa.aberto()" (click)="alternar()" [attr.aria-expanded]="conversa.aberto()" [attr.aria-label]="conversa.aberto() ? 'Fechar o FatoBot' : 'Abrir o FatoBot'">
        @if (conversa.aberto()) { <app-icone nome="keyboard_arrow_down" /> } @else { <img src="img/fatobot-rosto.svg" alt="" width="58" height="58" /> }
        @if (naoLidas() && !conversa.aberto()) { <span class="bolha-contador">{{ naoLidas() }}</span> }
      </button>
    }
  `,
})
export class FatoBotBolha {
  protected conversa = inject(FatoBotConversa);
  private router = inject(Router);
  private lista = viewChild<ElementRef<HTMLElement>>('lista');
  protected pergunta = '';
  private readonly url = signal(this.router.url);
  protected readonly naPaginaDoBot = computed(() => this.url().startsWith('/fatobot'));
  /** Balão de dica que o FatoBot mostra sozinho (conforme a página). */
  protected readonly fala = signal<Fala | null>(null);
  private timerFala?: ReturnType<typeof setTimeout>;
  private ultimaFala = 0;
  /** Microfone: reconhecimento de voz do navegador (Chrome, Edge...). Sem suporte, o botão some. */
  protected readonly temVoz = typeof window !== 'undefined' && !!((window as unknown as Record<string, unknown>)['SpeechRecognition'] || (window as unknown as Record<string, unknown>)['webkitSpeechRecognition']);
  protected readonly ouvindo = signal(false);
  protected readonly erroVoz = signal('');
  private reconhecimento: { stop(): void } | null = null;
  private vistas = signal(this.conversa.mensagens().length);
  protected readonly naoLidas = computed(() => Math.max(0, this.conversa.mensagens().filter((m) => m.autor === 'bot').length - this.vistas()));

  protected readonly sugestoes = computed(() => {
    const u = this.url();
    const titulo = this.tituloDaPagina();
    if (/^\/politicos\/(senado\/)?\d+/.test(u) && titulo) return [`O que se sabe sobre a atuação de ${titulo}?`, `Quais projetos ${titulo} apresentou?`, 'Como funciona a cota parlamentar?'];
    if (u.startsWith('/politicos')) return ['Qual é a função de um deputado federal?', 'Qual a diferença entre deputado e senador?', 'Como funciona a cota parlamentar?'];
    if (u.startsWith('/congresso')) return ['Como funciona uma votação nominal?', 'O que é uma medida provisória?', 'Como um projeto vira lei?'];
    if (u.startsWith('/verificar') || u.startsWith('/fato-ou-fake')) return ['Como identificar uma notícia falsa?', 'Voto em branco ajuda quem está ganhando?', 'A urna eletrônica é conectada à internet?'];
    if (u.startsWith('/comunidades')) return ['Como debater política com respeito?', 'Como citar uma fonte confiável?', 'O que é desinformação?'];
    if (u.startsWith('/base-da-politica')) return ['O que faz o Senado?', 'O que é uma PEC?', 'Como funciona o processo legislativo?'];
    return ['Como funciona uma votação no Congresso?', 'Qual é a função de um deputado federal?', 'Quantos deputados tem a Câmara?'];
  });
  private titulo = signal('');
  private tituloDaPagina() {
    return this.titulo();
  }

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.url.set(this.router.url);
      this.agendarFala();
      setTimeout(() => this.titulo.set(document.querySelector('main h1')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''), 1500);
    });
    effect(() => {
      this.conversa.mensagens();
      this.conversa.pensando();
      if (this.conversa.aberto()) {
        this.vistas.set(this.conversa.mensagens().filter((m) => m.autor === 'bot').length);
        setTimeout(() => this.lista()?.nativeElement.scrollTo({ top: 1e6, behavior: 'smooth' }));
      }
    });
  }

  protected alternar() {
    this.conversa.aberto.update((a) => !a);
    this.fecharFala();
    if (this.conversa.aberto()) setTimeout(() => document.getElementById('bolha-texto')?.focus(), 50);
  }

  /** Agenda a dica da página: só com dicas ligadas, uma vez por página por visita e no máximo uma a cada 90 s. */
  private agendarFala() {
    clearTimeout(this.timerFala);
    this.fala.set(null);
    this.timerFala = setTimeout(() => {
      const f = this.dicaDaPagina();
      if (!f || !this.podeFalar()) return;
      const chave = 'fatoreal-dica:' + f.chave;
      try {
        if (sessionStorage.getItem(chave)) return;
        sessionStorage.setItem(chave, '1');
      } catch {
        /* sem armazenamento */
      }
      this.mostrarFala(f);
    }, 6000);
  }

  private podeFalar() {
    let silencio = false;
    try {
      silencio = !!sessionStorage.getItem('fatoreal-dica-bot');
    } catch {
      /* sem armazenamento */
    }
    return this.conversa.dicasLigadas() && !this.conversa.aberto() && !silencio && Date.now() - this.ultimaFala > 90_000;
  }

  private mostrarFala(f: Fala) {
    this.ultimaFala = Date.now();
    this.fala.set(f);
  }

  /** Outras telas podem pedir uma dica: window.dispatchEvent(new CustomEvent('fatobot-dica', { detail: fala })). */
  @HostListener('window:fatobot-dica', ['$event'])
  protected aoPedirDica(e: Event) {
    // Dica causada por algo que a pessoa fez: passa na frente da dica geral da página
    const f = (e as CustomEvent<Fala>).detail;
    if (f && this.conversa.dicasLigadas() && !this.conversa.aberto()) this.mostrarFala(f);
  }

  private dicaDaPagina(): Fala | null {
    const u = this.url().split('?')[0];
    const nome = this.titulo();
    if (/^\/politicos\/(senado\/)?\d+/.test(u) && nome) return { chave: u, titulo: 'Quer um resumo?', texto: `Posso contar o que se sabe sobre ${nome}, com as fontes oficiais.`, acao: 'Quero ver', pergunta: `O que se sabe sobre a atuação de ${nome}?` };
    if (u === '/politicos/gastos') return { chave: u, titulo: 'Dúvida sobre a cota?', texto: 'Quer que eu explique o que é a cota parlamentar e por que uns gastam mais?', acao: 'Me explica', pergunta: 'Como funciona a cota parlamentar?' };
    if (u === '/politicos') return { chave: u, titulo: 'Dica do FatoBot', texto: 'Escolha um cargo e toque num político para ver gastos, votações e projetos. Quer saber o que faz um deputado?', acao: 'Me explica', pergunta: 'Qual é a função de um deputado federal?' };
    if (u.startsWith('/congresso')) return { chave: u, titulo: 'Curiosidade', texto: 'Você sabe como um projeto vira lei? Eu explico em poucas linhas.', acao: 'Quero saber', pergunta: 'Como um projeto vira lei?' };
    if (u.startsWith('/fato-ou-fake')) return { chave: u, titulo: 'Estou aqui para ajudar', texto: 'Cole a mensagem que você recebeu e eu confiro nas fontes oficiais.' };
    if (u.startsWith('/base-da-politica')) return { chave: u, titulo: 'Ficou com dúvida?', texto: 'Se algum termo não ficou claro, me pergunte. Por exemplo: o que é uma PEC?', acao: 'O que é PEC?', pergunta: 'O que é uma PEC?' };
    if (u.startsWith('/noticias')) return { chave: u, titulo: 'Dica do FatoBot', texto: 'Em cada notícia tem o botão “Entender com o FatoBot”: eu explico o assunto de um jeito simples.' };
    if (u.startsWith('/comunidades')) return { chave: u, titulo: 'Lembrete amigo', texto: 'Nas comunidades, opinião é bem-vinda; fato precisa de fonte. Quer dicas de como citar uma?', acao: 'Quero', pergunta: 'Como citar uma fonte confiável?' };
    if (u === '/') return { chave: u, titulo: 'Oi! 👋', texto: 'Recebeu alguma mensagem estranha hoje? Eu ajudo a conferir antes de você compartilhar.', acao: 'Conferir agora', rota: '/fato-ou-fake' };
    return null;
  }

  protected aceitar(f: Fala) {
    this.fecharFala();
    if (f.pergunta) this.conversa.abrir(f.pergunta);
    else if (f.rota) this.router.navigateByUrl(f.rota);
  }

  protected fecharFala() {
    this.fala.set(null);
  }

  protected desligarDicas() {
    this.conversa.definir('dicas', false);
    this.fala.set(null);
  }

  protected ouvir() {
    const w = window as unknown as Record<string, new () => Reconhecedor>;
    const SR = w['SpeechRecognition'] || w['webkitSpeechRecognition'];
    if (!SR) return;
    this.conversa.aberto.set(true);
    this.fecharFala();
    this.erroVoz.set('');
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.onresult = (ev) => (this.pergunta = Array.from(ev.results).map((r) => r[0].transcript).join(' '));
    rec.onerror = (ev) => this.erroVoz.set(ev.error === 'not-allowed' ? 'Permita o uso do microfone no navegador para falar com o FatoBot.' : 'Não consegui ouvir. Tente de novo ou escreva sua pergunta.');
    rec.onend = () => {
      this.ouvindo.set(false);
      this.reconhecimento = null;
      const p = this.pergunta.trim();
      if (p) {
        this.pergunta = '';
        this.conversa.enviarPorVoz(p);
      }
    };
    this.reconhecimento = rec;
    this.ouvindo.set(true);
    rec.start();
  }

  protected pararDeOuvir() {
    this.reconhecimento?.stop();
  }

  protected enviar() {
    const p = this.pergunta;
    this.pergunta = '';
    this.conversa.enviar(p);
  }

  @HostListener('document:keydown.escape')
  protected esc() {
    if (this.conversa.aberto()) this.conversa.aberto.set(false);
  }
}
