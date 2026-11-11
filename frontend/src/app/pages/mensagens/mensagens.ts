import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { Conversa, ConversaGrupo, Mensagem, MensagemGrupo, MensagensService } from '../../core/mensagens.service';
import { Autor, Comunidade } from '../../core/modelos';
import { tempoAtras } from '../../core/util';
import { avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone } from '../../shared/componentes';

type Filtro = 'todas' | 'pessoas' | 'comunidades';

/** Uma linha da caixa de entrada: conversa privada ou grupo de comunidade. */
interface Item {
  chave: string;
  tipo: 'pessoa' | 'grupo';
  nome: string;
  pessoa?: Autor;
  comunidade?: Comunidade;
  previa: string;
  data: string;
  naoLidas: number;
}

/** Caixa de mensagens: conversas privadas e grupos das comunidades de que a pessoa participa. */
@Component({
  selector: 'app-mensagens',
  imports: [FormsModule, RouterLink, Avatar, Icone],
  template: `
    <header class="cabecalho-pagina cabecalho-com-acao">
      <div>
        <h1><app-icone nome="forum" /> Mensagens</h1>
        <p>Converse em particular com outras pessoas e nos grupos das comunidades de que você participa.</p>
      </div>
      <div class="nova-conversa">
        <label for="contato" class="sr-only">Nova conversa com</label>
        <select id="contato" name="contato" [(ngModel)]="novoContato" (ngModelChange)="abrirNova()">
          <option [ngValue]="null">Nova conversa...</option>
          @for (c of contatos(); track c.id) { <option [ngValue]="c">{{ c.nome }}</option> }
        </select>
      </div>
    </header>

    <div class="card chat-duplo" [class.com-conversa]="aberto()">
      <div class="caixa-entrada">
        <div class="filtro-mensagens" role="tablist" aria-label="Filtrar conversas">
          @for (f of filtros; track f.valor) {
            <button type="button" role="tab" [attr.aria-selected]="filtro() === f.valor" (click)="filtro.set(f.valor)">
              {{ f.texto }} @if (naoLidasDe(f.valor); as n) { <span class="contador">{{ n }}</span> }
            </button>
          }
        </div>
        <ul class="lista-conversas" aria-label="Conversas">
          @for (it of visiveis(); track it.chave) {
            <li>
              <button type="button" [class.ativa]="aberto()?.chave === it.chave" [class.nao-lida]="it.naoLidas" (click)="abrir(it)">
                @if (it.tipo === 'grupo') {
                  <span class="avatar-grupo" [style.--cor-tema]="corTema[it.comunidade!.tema]">
                    @if (avatarComunidade(it.comunidade!.slug); as img) { <img [src]="img" alt="" /> }
                    @else { <app-icone [nome]="iconeTema[it.comunidade!.tema] || 'groups'" /> }
                  </span>
                } @else {
                  <app-avatar [nome]="it.nome" [url]="it.pessoa!.foto_url" [tamanho]="44" />
                }
                <span>
                  <strong>{{ it.nome }} @if (it.tipo === 'grupo') { <small class="etiqueta-grupo">Comunidade</small> }</strong>
                  <small>{{ it.previa }}</small>
                </span>
                <span class="conversa-meta">
                  @if (it.data) { <small>{{ tempo(it.data) }}</small> }
                  @if (it.naoLidas) { <span class="contador">{{ it.naoLidas }}</span> }
                </span>
              </button>
            </li>
          } @empty {
            <li class="texto-suave vazio-lista">
              @if (filtro() === 'comunidades') { Entre em uma comunidade para participar do grupo dela. <a routerLink="/comunidades">Ver comunidades</a> }
              @else { Nenhuma conversa ainda. Escolha alguém em “Nova conversa”. }
            </li>
          }
        </ul>
      </div>

      <section class="conversa" aria-live="polite">
        @if (aberto(); as it) {
          <header class="conversa-topo">
            <button type="button" class="botao-icone so-celular" aria-label="Voltar para as conversas" (click)="aberto.set(null)"><app-icone nome="arrow_back" /></button>
            @if (it.tipo === 'grupo') {
              <span class="avatar-grupo avatar-grupo-p" [style.--cor-tema]="corTema[it.comunidade!.tema]">
                @if (avatarComunidade(it.comunidade!.slug); as img) { <img [src]="img" alt="" /> }
                @else { <app-icone [nome]="iconeTema[it.comunidade!.tema] || 'groups'" /> }
              </span>
              <span class="conversa-titulo">
                <a [routerLink]="['/comunidades', it.comunidade!.slug]"><strong>{{ it.nome }}</strong></a>
                <small>{{ it.comunidade!.total_membros }} {{ it.comunidade!.total_membros === 1 ? 'membro' : 'membros' }} · grupo da comunidade</small>
              </span>
            } @else {
              <a [routerLink]="['/pessoas', it.pessoa!.id]" class="conversa-pessoa"><app-avatar [nome]="it.nome" [url]="it.pessoa!.foto_url" [tamanho]="40" /><strong>{{ it.nome }}</strong></a>
            }
          </header>
          <ol class="chat-mensagens">
            @if (it.tipo === 'grupo') {
              @for (m of mensagensGrupo(); track m.id; let i = $index) {
                @let minha = m.autor.id === meuId();
                @let mesmoAutor = i > 0 && mensagensGrupo()[i - 1].autor.id === m.autor.id;
                <li class="msg-grupo" [class.minha]="minha">
                  @if (!minha) {
                    @if (!mesmoAutor) { <a [routerLink]="['/pessoas', m.autor.id]" class="msg-grupo-foto"><app-avatar [nome]="m.autor.nome" [url]="m.autor.foto_url" [tamanho]="32" /></a> }
                    @else { <span class="msg-grupo-foto"></span> }
                  }
                  <div class="msg" [class.msg-voce]="minha">
                    @if (!minha && !mesmoAutor) { <span class="msg-autor-grupo">{{ m.autor.nome }}</span> }
                    <p>{{ m.texto }}</p>
                    <small>{{ tempo(m.criado_em) }}</small>
                  </div>
                </li>
              } @empty {
                <li class="texto-suave">Ninguém escreveu no grupo ainda. Que tal começar a conversa?</li>
              }
            } @else {
              @for (m of mensagens(); track m.id) {
                <li class="msg" [class.msg-voce]="m.remetente_id === meuId()">
                  <p>{{ m.texto }}</p>
                  <small>{{ tempo(m.criado_em) }}</small>
                </li>
              } @empty {
                <li class="texto-suave">Comece a conversa com respeito. Mensagens ofensivas podem ser denunciadas.</li>
              }
            }
          </ol>
          <form class="chat-form" (submit)="$event.preventDefault(); enviar()">
            <label for="msg-texto" class="sr-only">Mensagem</label>
            <input id="msg-texto" name="texto" [(ngModel)]="texto" maxlength="1000" [placeholder]="it.tipo === 'grupo' ? 'Escreva para o grupo...' : 'Escreva uma mensagem...'" autocomplete="off" />
            <button class="botao botao-verde" type="submit" [disabled]="!texto.trim()"><app-icone nome="send" /> Enviar</button>
          </form>
        } @else {
          <div class="vazio conversa-vazia"><app-icone nome="chat" /><p>Escolha uma conversa ou um grupo para ler e responder.</p></div>
        }
      </section>
    </div>
  `,
})
export class MensagensPage implements OnInit {
  private service = inject(MensagensService);
  private avisos = inject(AvisosService);
  private auth = inject(AuthService);

  protected readonly conversas = signal<Conversa[]>([]);
  protected readonly grupos = signal<ConversaGrupo[]>([]);
  protected readonly contatos = signal<Autor[]>([]);
  protected readonly aberto = signal<Item | null>(null);
  protected readonly mensagens = signal<Mensagem[]>([]);
  protected readonly mensagensGrupo = signal<MensagemGrupo[]>([]);
  protected readonly filtro = signal<Filtro>('todas');
  protected readonly filtros: { valor: Filtro; texto: string }[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'pessoas', texto: 'Pessoas' },
    { valor: 'comunidades', texto: 'Comunidades' },
  ];
  protected readonly meuId = () => this.auth.usuario()?.id;
  protected readonly corTema = COR_TEMA;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly avatarComunidade = avatarComunidade;
  protected novoContato: Autor | null = null;
  protected texto = '';
  protected readonly tempo = tempoAtras;

  protected readonly itens = computed<Item[]>(() => {
    const eu = this.meuId();
    const pessoas: Item[] = this.conversas().map((c) => ({
      chave: 'p:' + c.pessoa.id, tipo: 'pessoa', nome: c.pessoa.nome, pessoa: c.pessoa,
      previa: (c.ultima.remetente_id === eu ? 'Você: ' : '') + c.ultima.texto, data: c.ultima.criado_em, naoLidas: c.naoLidas,
    }));
    const grupos: Item[] = this.grupos().map((g) => ({
      chave: 'g:' + g.comunidade.id, tipo: 'grupo', nome: g.comunidade.nome, comunidade: g.comunidade,
      previa: g.ultima ? `${g.ultima.autor.id === eu ? 'Você' : (g.ultima.autor.id === 'equipe' ? g.ultima.autor.nome : g.ultima.autor.nome.split(' ')[0])}: ${g.ultima.texto}` : 'Nenhuma mensagem ainda',
      data: g.ultima?.criado_em ?? '', naoLidas: g.naoLidas,
    }));
    return [...pessoas, ...grupos].sort((a, b) => b.data.localeCompare(a.data));
  });
  protected readonly visiveis = computed(() => {
    const f = this.filtro();
    return f === 'todas' ? this.itens() : this.itens().filter((i) => (f === 'pessoas' ? i.tipo === 'pessoa' : i.tipo === 'grupo'));
  });

  protected naoLidasDe(f: Filtro): number {
    return this.itens()
      .filter((i) => f === 'todas' || (f === 'pessoas' ? i.tipo === 'pessoa' : i.tipo === 'grupo'))
      .reduce((t, i) => t + i.naoLidas, 0);
  }

  async ngOnInit() {
    try {
      const [conversas, grupos, contatos] = await Promise.all([this.service.conversas(), this.service.grupos(), this.service.contatos()]);
      this.conversas.set(conversas);
      this.grupos.set(grupos);
      this.contatos.set(contatos);
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async abrir(it: Item) {
    this.aberto.set(it);
    if (it.tipo === 'grupo') {
      this.mensagensGrupo.set(await this.service.grupo(it.comunidade!.id));
      this.grupos.set(await this.service.grupos());
    } else {
      this.mensagens.set(await this.service.conversa(it.pessoa!.id));
      this.conversas.set(await this.service.conversas());
    }
    setTimeout(() => document.querySelector('.chat-mensagens')?.lastElementChild?.scrollIntoView({ block: 'end' }));
  }

  protected abrirNova() {
    const p = this.novoContato;
    this.novoContato = null;
    if (!p) return;
    this.filtro.set('todas');
    this.abrir({ chave: 'p:' + p.id, tipo: 'pessoa', nome: p.nome, pessoa: p, previa: '', data: '', naoLidas: 0 });
  }

  protected async enviar() {
    const it = this.aberto();
    const texto = this.texto.trim();
    if (!it || !texto) return;
    try {
      if (it.tipo === 'grupo') await this.service.enviarGrupo(it.comunidade!.id, texto);
      else await this.service.enviar(it.pessoa!.id, texto);
      this.texto = '';
      await this.abrir(it);
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
