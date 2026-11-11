import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';

/** Página aberta pelo link do e-mail de recuperação (o Supabase já cria a sessão). */
@Component({
  selector: 'app-nova-senha',
  imports: [FormsModule],
  template: `
    <section class="card formulario formulario-estreito">
      <h1>Criar nova senha</h1>
      <form #f="ngForm" (ngSubmit)="f.valid && salvar()">
        <div class="campo-form">
          <label for="n-senha">Nova senha (mínimo 6 caracteres)</label>
          <input id="n-senha" name="senha" type="password" [(ngModel)]="senha" required minlength="6" autocomplete="new-password" />
        </div>
        <div class="campo-form">
          <label for="n-conf">Repita a nova senha</label>
          <input id="n-conf" name="confirmacao" type="password" [(ngModel)]="confirmacao" required autocomplete="new-password" />
        </div>
        @if (erro()) { <p class="alerta-erro" role="alert">{{ erro() }}</p> }
        <button class="botao botao-bloco" type="submit" [disabled]="f.invalid">Salvar nova senha</button>
      </form>
    </section>
  `,
})
export class NovaSenhaPage {
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected senha = '';
  protected confirmacao = '';
  protected readonly erro = signal('');

  protected async salvar() {
    if (this.senha !== this.confirmacao) {
      this.erro.set('As senhas não são iguais.');
      return;
    }
    try {
      await this.auth.definirNovaSenha(this.senha);
      this.avisos.mostrar('Senha alterada!');
      this.router.navigateByUrl('/');
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao salvar.');
    }
  }
}
