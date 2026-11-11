import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { modoDemo } from '../../core/supabase';
import { Icone } from '../../shared/componentes';

@Component({
  selector: 'app-configuracoes',
  imports: [RouterLink, Icone],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="settings" /> Configurações</h1>
      <p>Conta e privacidade.</p>
    </header>

    <div class="grade-2">
      <section class="card">
        <h2><app-icone nome="manage_accounts" /> Conta</h2>
        @if (auth.usuario(); as u) {
          <p class="texto-suave">Conectado como <strong>{{ u.nome }}</strong> ({{ u.email }}).</p>
          <ul class="lista-links">
            <li><a routerLink="/perfil/editar"><app-icone nome="edit" /> Editar perfil e foto</a></li>
            <li><a routerLink="/recuperar-senha"><app-icone nome="key" /> Trocar senha</a></li>
            <li><a routerLink="/perfil/editar"><app-icone nome="delete" /> Excluir minha conta</a></li>
          </ul>
          <button type="button" class="botao botao-fantasma" (click)="sair()"><app-icone nome="logout" /> Sair</button>
        } @else {
          <p class="texto-suave">Você não está conectado.</p>
          <a routerLink="/entrar" class="botao botao-verde">Entrar</a>
        }
      </section>

      <section class="card">
        <h2><app-icone nome="shield_person" /> Privacidade (LGPD)</h2>
        <p class="texto-suave">Guardamos só nome, e-mail, foto (se você colocar) e o que você publica. Nunca pedimos sua preferência política.</p>
        <ul class="lista-links">
          <li><a routerLink="/privacidade"><app-icone nome="policy" /> Política de privacidade</a></li>
          <li><a routerLink="/termos"><app-icone nome="description" /> Termos de uso</a></li>
          <li><a routerLink="/regras"><app-icone nome="gavel" /> Regras da comunidade</a></li>
          <li><a routerLink="/contato"><app-icone nome="mail" /> Falar com a equipe</a></li>
        </ul>
      </section>

      @if (demo) {
        <section class="card">
          <h2><app-icone nome="science" /> Modo demonstração</h2>
          <p class="texto-suave">Os dados de teste ficam só neste navegador. Apague para começar do zero.</p>
          <button type="button" class="botao botao-perigo" (click)="limparDemo()"><app-icone nome="restart_alt" /> Apagar dados de teste</button>
        </section>
      }
    </div>
  `,
})
export class ConfiguracoesPage {
  protected auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected readonly demo = modoDemo;

  protected async sair() {
    await this.auth.sair();
    this.router.navigateByUrl('/');
  }

  protected limparDemo() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('fatoreal')).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* sem localStorage */
    }
    this.avisos.mostrar('Dados de teste apagados.');
    setTimeout(() => location.reload(), 600);
  }
}
