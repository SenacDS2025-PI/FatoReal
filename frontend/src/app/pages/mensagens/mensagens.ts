import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisosService } from '../../core/avisos.service';
import { Conversa, Mensagem, MensagensService } from '../../core/mensagens.service';
import { AuthService } from '../../core/auth.service';
import { Autor } from '../../core/modelos';
import { tempoAtras } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';

@Component({
  selector: 'app-mensagens',
  imports: [FormsModule, Avatar, Icone],
  template: `
    <header class="cabecalho-pagina cabecalho-com-acao">
      <div>
        <h1><app-icone nome="forum" /> Mensagens</h1>
        <p>Converse em particular com quem participa das mesmas comunidades que você.</p>
      </div>
      <div class="nova-conversa">
        <label for="contato" class="sr-only">Nova conversa com</label>
        <select id="contato" name="contato" [(ngModel)]="novoContato" (ngModelChange)="abrirNova()">
          <option [ngValue]="null">Nova conversa...</option>
          @for (c of contatos(); track c.id) { <option [ngValue]="c">{{ c.nome }}</option> }
        </select>
      </div>
    </header>

    <div class="card chat-duplo" [class.com-conversa]="aberta()">
      <ul class="lista-conversas" aria-label="Conversas">
        @for (c of conversas(); track c.pessoa.id) {
          <li>
            <button type="button" [class.ativa]="aberta()?.id === c.pessoa.id" (click)="abrir(c.pessoa)">
              <app-avatar [nome]="c.pessoa.nome" [url]="c.pessoa.foto_url" [tamanho]="44" />
              <span>
                <strong>{{ c.pessoa.nome }}</strong>
                <small>{{ c.ultima.texto }}</small>
              </span>
              <span class="conversa-meta">
                <small>{{ tempo(c.ultima.criado_em) }}</small>
                @if (c.naoLidas) { <span class="contador">{{ c.naoLidas }}</span> }
              </span>
            </button>
          </li>
        } @empty {
          <li class="texto-suave vazio-lista">Nenhuma conversa ainda. Escolha alguém em “Nova conversa”.</li>
        }
      </ul>

      <section class="conversa" aria-live="polite">
        @if (aberta(); as p) {
          <header class="conversa-topo">
            <button type="button" class="botao-icone so-celular" aria-label="Voltar para as conversas" (click)="aberta.set(null)"><app-icone nome="arrow_back" /></button>
            <app-avatar [nome]="p.nome" [url]="p.foto_url" [tamanho]="40" />
            <strong>{{ p.nome }}</strong>
          </header>
          <ol class="chat-mensagens">
            @for (m of mensagens(); track m.id) {
              <li class="msg" [class.msg-voce]="m.remetente_id === meuId()">
                <p>{{ m.texto }}</p>
                <small>{{ tempo(m.criado_em) }}</small>
              </li>
            } @empty {
              <li class="texto-suave">Comece a conversa com respeito. Mensagens ofensivas podem ser denunciadas.</li>
            }
          </ol>
          <form class="chat-form" (submit)="$event.preventDefault(); enviar()">
            <label for="msg-texto" class="sr-only">Mensagem</label>
            <input id="msg-texto" name="texto" [(ngModel)]="texto" maxlength="1000" placeholder="Escreva uma mensagem..." autocomplete="off" />
            <button class="botao botao-verde" type="submit" [disabled]="!texto.trim()"><app-icone nome="send" /> Enviar</button>
          </form>
        } @else {
          <div class="vazio conversa-vazia"><app-icone nome="chat" /><p>Escolha uma conversa para ler e responder.</p></div>
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
  protected readonly contatos = signal<Autor[]>([]);
  protected readonly aberta = signal<Autor | null>(null);
  protected readonly mensagens = signal<Mensagem[]>([]);
  protected readonly meuId = () => this.auth.usuario()?.id;
  protected novoContato: Autor | null = null;
  protected texto = '';
  protected readonly tempo = tempoAtras;

  async ngOnInit() {
    try {
      const [conversas, contatos] = await Promise.all([this.service.conversas(), this.service.contatos()]);
      this.conversas.set(conversas);
      this.contatos.set(contatos);
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async abrir(p: Autor) {
    this.aberta.set(p);
    this.mensagens.set(await this.service.conversa(p.id));
    this.conversas.set(await this.service.conversas());
  }

  protected abrirNova() {
    if (this.novoContato) this.abrir(this.novoContato);
    this.novoContato = null;
  }

  protected async enviar() {
    const p = this.aberta();
    const texto = this.texto.trim();
    if (!p || !texto) return;
    try {
      await this.service.enviar(p.id, texto);
      this.texto = '';
      await this.abrir(p);
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
