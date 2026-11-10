import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Comunidade } from '../../core/modelos';
import { linkSeguro } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';

@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink, Avatar, Icone],
  template: `
    @if (auth.usuario(); as u) {
      <header class="card perfil-topo">
        <app-avatar [nome]="u.nome" [url]="u.foto_url" [tamanho]="96" />
        <div>
          <h1>{{ u.nome }}</h1>
          <p class="texto-suave">{{ u.email }}</p>
          @if (u.moderador) { <span class="etiqueta etiqueta-verde">moderador(a)</span> }
        </div>
      </header>

      <div class="grade-2">
        <section class="card">
          <h2>Editar perfil</h2>
          <form #f="ngForm" (ngSubmit)="f.valid && salvar()">
            <div class="campo-form">
              <label for="p-nome">Nome</label>
              <input id="p-nome" name="nome" [(ngModel)]="nome" required minlength="2" maxlength="60" />
            </div>
            <div class="campo-form">
              <label for="p-foto">Foto (link da imagem, opcional)</label>
              <input id="p-foto" name="foto" type="url" [(ngModel)]="foto" placeholder="https://..." />
            </div>
            <button class="botao" type="submit" [disabled]="f.invalid">Salvar</button>
          </form>
        </section>

        <section class="card">
          <h2>Minhas comunidades</h2>
          <ul class="lista-simples">
            @for (c of minhas(); track c.id) {
              <li><a [routerLink]="['/comunidades', c.slug]" class="item-comunidade">
                <span class="miniatura" aria-hidden="true">{{ c.nome[0] }}</span>
                <span><strong>{{ c.nome }}</strong><small>{{ c.total_membros }} membro(s)</small></span>
              </a></li>
            } @empty {
              <li class="texto-suave">Você ainda não participa de nenhuma. <a routerLink="/comunidades">Ver comunidades</a></li>
            }
          </ul>
        </section>
      </div>

      <section class="card">
        <h2>Sua conta e seus dados (LGPD)</h2>
        <p class="texto-suave">Guardamos só seu nome, e-mail, foto (se você colocar) e o que você publica. Você pode sair ou excluir sua conta quando quiser.</p>
        <div class="acoes-linha">
          <button class="botao botao-fantasma" type="button" (click)="sair()"><app-icone nome="logout" /> Sair</button>
          <button class="botao botao-perigo" type="button" (click)="confirmando.set(true)"><app-icone nome="delete" /> Excluir minha conta</button>
        </div>
        @if (confirmando()) {
          <div class="confirmacao" role="alertdialog" aria-labelledby="conf-titulo">
            <p id="conf-titulo"><strong>Excluir sua conta?</strong> Suas publicações e comentários também serão apagados. Isso não tem volta.</p>
            <div class="acoes-linha">
              <button class="botao botao-fantasma" type="button" (click)="confirmando.set(false)">Cancelar</button>
              <button class="botao botao-perigo" type="button" (click)="excluir()">Sim, excluir</button>
            </div>
          </div>
        }
      </section>
    }
  `,
})
export class PerfilPage implements OnInit {
  protected auth = inject(AuthService);
  private comunidades = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected nome = '';
  protected foto = '';
  protected readonly minhas = signal<Comunidade[]>([]);
  protected readonly confirmando = signal(false);

  async ngOnInit() {
    const u = this.auth.usuario();
    this.nome = u?.nome ?? '';
    this.foto = u?.foto_url ?? '';
    this.minhas.set(await this.comunidades.minhas());
  }

  protected async salvar() {
    const foto = this.foto.trim() ? linkSeguro(this.foto) : null;
    if (this.foto.trim() && !foto) {
      this.avisos.mostrar('O link da foto precisa começar com https://', 'erro');
      return;
    }
    try {
      await this.auth.atualizarPerfil({ nome: this.nome.trim(), foto_url: foto });
      this.avisos.mostrar('Perfil atualizado!');
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async sair() {
    await this.auth.sair();
    this.router.navigateByUrl('/');
  }

  protected async excluir() {
    try {
      await this.auth.excluirConta();
      this.avisos.mostrar('Conta excluída.');
      this.router.navigateByUrl('/');
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
