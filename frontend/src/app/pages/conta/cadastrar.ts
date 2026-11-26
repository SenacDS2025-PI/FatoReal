import { ContaMoldura } from '../../shared/conta-moldura';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';

/** LGPD: pedimos só nome, e-mail e senha. Nada sobre opinião ou preferência política. */
@Component({
  selector: 'app-cadastrar',
  imports: [FormsModule, RouterLink, ContaMoldura],
  template: `
    <app-conta-moldura frase="Faça parte de uma rede onde toda informação tem fonte.">
    <section class="card formulario formulario-estreito">
      @if (confirmar()) {
        <h1>Confirme seu e-mail</h1>
        <p>Enviamos um link de confirmação para <strong>{{ email }}</strong>. Abra seu e-mail e clique no link para ativar a conta.</p>
        <a routerLink="/entrar" class="botao botao-bloco">Ir para o login</a>
      } @else {
        <h1>Criar conta</h1>
        <p class="texto-suave">Pedimos só o necessário: nome, e-mail e senha.</p>
        <form #f="ngForm" (ngSubmit)="f.valid && cadastrar()">
          <div class="campo-form">
            <label for="c-nome">Nome (pode ser apelido)</label>
            <input id="c-nome" name="nome" [(ngModel)]="nome" #cNome="ngModel" required minlength="2" maxlength="60" autocomplete="nickname"
              [attr.aria-invalid]="cNome.invalid && (cNome.touched || f.submitted)" aria-describedby="c-nome-erro" />
            @if (cNome.invalid && (cNome.touched || f.submitted)) { <small id="c-nome-erro" class="erro-campo">Escreva seu nome ou apelido com pelo menos 2 letras.</small> }
          </div>
          <div class="campo-form">
            <label for="c-email">E-mail</label>
            <input id="c-email" name="email" type="email" [(ngModel)]="email" #cEmail="ngModel" required email autocomplete="email"
              [attr.aria-invalid]="cEmail.invalid && (cEmail.touched || f.submitted)" aria-describedby="c-email-erro" />
            @if (cEmail.invalid && (cEmail.touched || f.submitted)) {
              <small id="c-email-erro" class="erro-campo">{{ cEmail.errors?.['required'] ? 'Escreva seu e-mail.' : 'Confira o e-mail: ele precisa ter @ e um endereço, como nome@exemplo.com.' }}</small>
            }
          </div>
          <div class="campo-form">
            <label for="c-senha">Senha (mínimo 6 caracteres)</label>
            <input id="c-senha" name="senha" type="password" [(ngModel)]="senha" #cSenha="ngModel" required minlength="6" autocomplete="new-password"
              [attr.aria-invalid]="cSenha.invalid && (cSenha.touched || f.submitted)" aria-describedby="c-senha-erro" />
            @if (cSenha.invalid && (cSenha.touched || f.submitted)) { <small id="c-senha-erro" class="erro-campo">A senha precisa ter pelo menos 6 caracteres.</small> }
          </div>
          <label class="opcao">
            <input type="checkbox" name="aceite" [(ngModel)]="aceite" #cAceite="ngModel" required />
            <span>Li e aceito os <a routerLink="/termos" target="_blank">termos de uso</a>, as <a routerLink="/regras" target="_blank">regras da comunidade</a> e a <a routerLink="/privacidade" target="_blank">política de privacidade</a>.</span>
          </label>
          @if (cAceite.invalid && f.submitted) { <small class="erro-campo">Para criar a conta, marque que você leu e aceita os termos.</small> }
          @if (erro()) { <p class="alerta-erro" role="alert">{{ erro() }}</p> }
          <button class="botao botao-bloco" type="submit" [disabled]="enviando()">{{ enviando() ? 'Criando...' : 'Criar conta' }}</button>
        </form>
        <p class="links-formulario"><span>Já tem conta? <a routerLink="/entrar">Entrar</a></span></p>
      }
    </section>
    </app-conta-moldura>
  `,
})
export class CadastrarPage {
  private auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected nome = '';
  protected email = '';
  protected senha = '';
  protected aceite = false;
  protected readonly erro = signal('');
  protected readonly enviando = signal(false);
  protected readonly confirmar = signal(false);

  protected async cadastrar() {
    this.enviando.set(true);
    this.erro.set('');
    try {
      const { confirmarEmail } = await this.auth.cadastrar(this.nome.trim(), this.email.trim(), this.senha);
      if (confirmarEmail) {
        this.confirmar.set(true);
      } else {
        this.avisos.mostrar('Conta criada! Bem-vindo(a) ao Fato Real.');
        this.router.navigateByUrl('/comunidades');
      }
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao cadastrar.');
    } finally {
      this.enviando.set(false);
    }
  }
}
