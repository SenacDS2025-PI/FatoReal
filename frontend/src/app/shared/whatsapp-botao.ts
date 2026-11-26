import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/auth.service';
import { MOTIVOS_RESERVA, montarWhatsapp, motivosWhatsapp } from '../core/whatsapp.service';
import { Icone } from './componentes';

/**
 * Botão flutuante "Fale com a gente no WhatsApp" (requisito do professor).
 * Fica à esquerda da bolinha do FatoBot. Abre um formulário; o back-end monta o link do WhatsApp
 * e a pessoa confirma antes de abrir. Nada é guardado (LGPD).
 */
@Component({
  selector: 'app-whatsapp-botao',
  imports: [FormsModule, Icone],
  template: `
    @if (!flutuante()) {
      <!-- Na página de Contato: botão comum (o botão flutuante saiu do site em 26 nov. 2026, pedido do Luiz) -->
      <button type="button" class="botao botao-verde wa-botao-pagina" (click)="abrir()"><app-icone nome="chat" /> Falar pelo WhatsApp</button>
    } @else {
    <button type="button" class="wa-botao" (click)="abrir()" aria-label="Fale com a equipe pelo WhatsApp" title="Fale com a equipe pelo WhatsApp">
      <svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9.4 3 4 8.38 4 15c0 2.1.56 4.15 1.62 5.95L4 29l8.25-1.6A12 12 0 0 0 16.04 27C22.66 27 28 21.62 28 15S22.66 3 16.04 3Zm0 21.8c-1.8 0-3.56-.48-5.1-1.4l-.37-.22-4.9.95.98-4.76-.24-.38A9.75 9.75 0 0 1 6.2 15c0-5.4 4.42-9.8 9.84-9.8 5.4 0 9.8 4.4 9.8 9.8s-4.4 9.8-9.8 9.8Zm5.38-7.33c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.57-.48-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.08 1.75-.71 2-1.4.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z"/></svg>
    </button>
    }

    @if (aberto()) {
      <div class="modal-fundo" (click)="fechar()">
        <section class="modal wa-modal" role="dialog" aria-modal="true" aria-labelledby="wa-titulo" (click)="$event.stopPropagation()">
          @if (pronto(); as p) {
            <!-- Confirmação antes de abrir o WhatsApp -->
            <h2 id="wa-titulo" class="ps-titulo"><span class="ps-icone wa-icone"><app-icone nome="check_circle" /></span> Tudo certo para enviar?</h2>
            <p>Vamos abrir o WhatsApp da equipe com esta mensagem. Você ainda pode mudar o texto lá antes de enviar.</p>
            <blockquote class="wa-previa">{{ p.texto }}</blockquote>
            <p class="texto-p"><app-icone nome="shield" /> Nada fica guardado no Fato Real.</p>
            <div class="modal-acoes">
              <button type="button" class="botao botao-fantasma" (click)="pronto.set(null)">Voltar</button>
              <button type="button" class="botao botao-verde" (click)="abrirWhatsapp(p.url)"><app-icone nome="open_in_new" /> Abrir o WhatsApp</button>
            </div>
          } @else {
            <h2 id="wa-titulo" class="ps-titulo"><span class="ps-icone wa-icone"><app-icone nome="chat" /></span> Fale com a equipe</h2>
            <p class="texto-suave">Preencha e a gente abre uma conversa no WhatsApp com a sua mensagem pronta.</p>
            <form (submit)="$event.preventDefault(); enviar()">
              <div class="campo-form">
                <label for="wa-nome">Seu nome *</label>
                <input id="wa-nome" name="nome" [(ngModel)]="nome" required minlength="2" maxlength="80" autocomplete="name" />
              </div>
              <div class="campo-form">
                <label for="wa-motivo">Motivo *</label>
                <select id="wa-motivo" name="motivo" [(ngModel)]="motivo" required>
                  <option value="" disabled>Escolha um motivo</option>
                  @for (m of motivos(); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </div>
              <div class="campo-form">
                <label for="wa-link">Link <small class="texto-suave">(opcional)</small></label>
                <input id="wa-link" name="link" type="url" [(ngModel)]="link" maxlength="500" placeholder="https://..." />
              </div>
              <div class="campo-form">
                <label for="wa-msg">Mensagem <small class="texto-suave">(opcional)</small></label>
                <textarea id="wa-msg" name="mensagem" rows="3" [(ngModel)]="mensagem" maxlength="500"></textarea>
                <small class="texto-suave">{{ mensagem.length }}/500</small>
              </div>
              @if (erro()) { <p class="alerta-erro" role="alert"><app-icone nome="error" /> {{ erro() }}</p> }
              <div class="modal-acoes">
                <button type="button" class="botao botao-fantasma" (click)="fechar()">Cancelar</button>
                <button type="submit" class="botao botao-verde" [disabled]="enviando()">{{ enviando() ? 'Preparando...' : 'Continuar' }}</button>
              </div>
            </form>
          }
        </section>
      </div>
    }
  `,
})
export class WhatsappBotao {
  /** true = bolinha flutuante (não usada mais); false = botão comum dentro da página de Contato. */
  readonly flutuante = input(true);
  private auth = inject(AuthService);
  protected readonly aberto = signal(false);
  protected readonly motivos = signal<string[]>(MOTIVOS_RESERVA);
  protected readonly enviando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly pronto = signal<{ url: string; texto: string } | null>(null);
  protected nome = '';
  protected motivo = '';
  protected link = '';
  protected mensagem = '';

  protected abrir() {
    this.aberto.set(true);
    this.erro.set(null);
    this.pronto.set(null);
    if (!this.nome) this.nome = this.auth.usuario()?.nome ?? '';
    motivosWhatsapp().then((m) => this.motivos.set(m));
  }

  protected fechar() {
    this.aberto.set(false);
  }

  protected async enviar() {
    const nome = this.nome.trim();
    const link = this.link.trim();
    if (nome.length < 2 || nome.length > 80) return this.erro.set('Escreva seu nome (de 2 a 80 letras).');
    if (!this.motivos().includes(this.motivo)) return this.erro.set('Escolha um motivo da lista.');
    if (link && !/^https?:\/\//i.test(link)) return this.erro.set('O link precisa começar com http:// ou https://');
    this.erro.set(null);
    this.enviando.set(true);
    try {
      this.pronto.set(await montarWhatsapp({ nome, motivo: this.motivo, link, mensagem: this.mensagem.trim() }));
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Não deu certo agora. Tente de novo.');
    } finally {
      this.enviando.set(false);
    }
  }

  /** Abre no clique (e não logo depois da resposta), para o navegador não bloquear a nova aba. */
  protected abrirWhatsapp(url: string) {
    window.open(url, '_blank', 'noopener');
    this.aberto.set(false);
    this.pronto.set(null);
    this.mensagem = '';
    this.link = '';
  }
}
