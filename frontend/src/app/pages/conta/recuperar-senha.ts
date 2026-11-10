import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-recuperar-senha',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card formulario formulario-estreito">
      <h1>Recuperar senha</h1>
      @if (enviado()) {
        <p>Se existir uma conta com <strong>{{ email }}</strong>, você vai receber um link para criar uma nova senha.</p>
        <a routerLink="/entrar" class="botao botao-bloco">Voltar para o login</a>
      } @else {
        <p class="texto-suave">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
        <form #f="ngForm" (ngSubmit)="f.valid && enviar()">
          <div class="campo-form">
            <label for="r-email">E-mail</label>
            <input id="r-email" name="email" type="email" [(ngModel)]="email" required email autocomplete="email" />
          </div>
          @if (erro()) { <p class="alerta-erro" role="alert">{{ erro() }}</p> }
          <button class="botao botao-bloco" type="submit" [disabled]="f.invalid">Enviar link</button>
        </form>
      }
    </section>
  `,
})
export class RecuperarSenhaPage {
  private auth = inject(AuthService);
  protected email = '';
  protected readonly enviado = signal(false);
  protected readonly erro = signal('');

  protected async enviar() {
    try {
      await this.auth.recuperarSenha(this.email.trim());
      this.enviado.set(true);
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao enviar.');
    }
  }
}
