import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';

@Component({
  selector: 'app-entrar',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="card formulario formulario-estreito">
      <h1>Entrar</h1>
      <p class="texto-suave">Use sua conta para participar das comunidades.</p>
      <form #f="ngForm" (ngSubmit)="f.valid && entrar()">
        <div class="campo-form">
          <label for="e-email">E-mail</label>
          <input id="e-email" name="email" type="email" [(ngModel)]="email" required email autocomplete="email" />
        </div>
        <div class="campo-form">
          <label for="e-senha">Senha</label>
          <input id="e-senha" name="senha" type="password" [(ngModel)]="senha" required minlength="6" autocomplete="current-password" />
        </div>
        @if (erro()) { <p class="alerta-erro" role="alert">{{ erro() }}</p> }
        <button class="botao botao-bloco" type="submit" [disabled]="f.invalid || enviando()">{{ enviando() ? 'Entrando...' : 'Entrar' }}</button>
      </form>
      <p class="links-formulario">
        <a routerLink="/recuperar-senha">Esqueci minha senha</a>
        <span>Não tem conta? <a routerLink="/cadastrar">Criar conta</a></span>
      </p>
    </section>
  `,
})
export class EntrarPage {
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  private rota = inject(ActivatedRoute);
  protected email = '';
  protected senha = '';
  protected readonly erro = signal('');
  protected readonly enviando = signal(false);

  protected async entrar() {
    this.enviando.set(true);
    this.erro.set('');
    try {
      await this.auth.entrar(this.email.trim(), this.senha);
      this.avisos.mostrar('Que bom te ver por aqui!');
      const voltar = this.rota.snapshot.queryParamMap.get('voltar');
      this.router.navigateByUrl(voltar?.startsWith('/') ? voltar : '/');
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao entrar.');
    } finally {
      this.enviando.set(false);
    }
  }
}
