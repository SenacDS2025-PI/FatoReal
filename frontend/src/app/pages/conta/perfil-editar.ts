import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { CAPAS } from '../../core/perfis.service';
import { imagemSegura, linkSeguro, UFS } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';

/** Página própria para editar o perfil (com prévia ao vivo) e cuidar da conta. */
@Component({
  selector: 'app-perfil-editar',
  imports: [FormsModule, RouterLink, Avatar, Icone],
  template: `
    @if (auth.usuario(); as u) {
      <div class="perfil-editar">
        <header class="perfil-editar-topo">
          <a routerLink="/perfil" class="link-voltar"><app-icone nome="arrow_back" /> Voltar ao perfil</a>
          <h1>Editar perfil</h1>
        </header>

        <form #f="ngForm" (ngSubmit)="f.valid && salvar()">
          <!-- Prévia ao vivo -->
          <section class="card perfil-x-cabecalho perfil-editar-previa" aria-label="Prévia do perfil">
            <div class="perfil-x-capa" [style.background]="capas[capa()].fundo"></div>
            <div class="perfil-x-corpo">
              <div class="perfil-x-linha"><app-avatar class="perfil-x-foto" [nome]="nome() || u.nome" [url]="previaFoto()" [tamanho]="104" /></div>
              <p class="perfil-x-nome">{{ nome() || 'Seu nome' }}</p>
              @if (bio()) { <p class="perfil-x-bio">{{ bio() }}</p> }
              @if (cidade() || uf()) { <p class="texto-suave"><app-icone nome="location_on" /> {{ cidade() }}{{ cidade() && uf() ? ', ' : '' }}{{ uf() }}</p> }
            </div>
          </section>

          <section class="card">
            <h2 class="titulo-secao">Aparência</h2>
            @if (auth.aceita('capa')) {
              <fieldset class="capas">
                <legend>Cor da capa</legend>
                @for (k of chavesCapa; track k) {
                  <label class="capa-opcao" [title]="capas[k].nome">
                    <input type="radio" name="capa" [value]="k" [ngModel]="capa()" (ngModelChange)="capa.set($event)" />
                    <span [style.background]="capas[k].fundo"></span>
                    <small>{{ capas[k].nome }}</small>
                  </label>
                }
              </fieldset>
            }
            <div class="campo-form">
              <label for="e-foto">Foto (link da imagem, opcional)</label>
              <input id="e-foto" name="foto" type="url" [ngModel]="foto()" (ngModelChange)="foto.set($event)" placeholder="https://..." />
            </div>
          </section>

          <section class="card">
            <h2 class="titulo-secao">Sobre você</h2>
            <div class="campo-form">
              <label for="e-nome">Nome</label>
              <input id="e-nome" name="nome" [ngModel]="nome()" (ngModelChange)="nome.set($event)" required minlength="2" maxlength="60" />
            </div>
            @if (auth.aceita('bio')) {
              <div class="campo-form">
                <label for="e-bio">Bio <small class="texto-suave">({{ bio().length }}/160)</small></label>
                <textarea id="e-bio" name="bio" rows="3" maxlength="160" [ngModel]="bio()" (ngModelChange)="bio.set($event)" placeholder="Conte em uma frase quem você é e o que te interessa em política."></textarea>
              </div>
            }
            @if (auth.aceita('cidade') || auth.aceita('uf')) {
              <div class="linha-campos">
                @if (auth.aceita('cidade')) {
                  <div class="campo-form campo-largo">
                    <label for="e-cidade">Cidade</label>
                    <input id="e-cidade" name="cidade" maxlength="60" [ngModel]="cidade()" (ngModelChange)="cidade.set($event)" placeholder="Ex.: Recife" />
                  </div>
                }
                @if (auth.aceita('uf')) {
                  <div class="campo-form">
                    <label for="e-uf">Estado</label>
                    <select id="e-uf" name="uf" [ngModel]="uf()" (ngModelChange)="uf.set($event)">
                      <option value="">—</option>
                      @for (x of ufs; track x) { <option [value]="x">{{ x }}</option> }
                    </select>
                  </div>
                }
              </div>
              <p class="texto-p">Com o estado preenchido, seu perfil mostra um atalho para os deputados de lá.</p>
            }
          </section>

          <div class="perfil-editar-acoes">
            <a routerLink="/perfil" class="botao botao-fantasma">Cancelar</a>
            <button type="submit" class="botao" [disabled]="f.invalid || salvando()">{{ salvando() ? 'Salvando...' : 'Salvar alterações' }}</button>
          </div>
        </form>

        <section class="card">
          <h2 class="titulo-secao">Conta e privacidade</h2>
          <dl class="lista-campos">
            <dt>E-mail</dt><dd>{{ u.email }} <small class="texto-suave">(não aparece no perfil)</small></dd>
          </dl>
          <p class="texto-suave">Guardamos só seu nome, e-mail, foto, bio, cidade e o que você publica (LGPD). Você pode sair ou excluir sua conta quando quiser.</p>
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
      </div>
    }
  `,
})
export class PerfilEditarPage {
  protected auth = inject(AuthService);
  private avisos = inject(AvisosService);
  private router = inject(Router);

  protected readonly capas = CAPAS;
  protected readonly chavesCapa = Object.keys(CAPAS);
  protected readonly ufs = UFS;

  private readonly u = this.auth.usuario();
  protected readonly nome = signal(this.u?.nome ?? '');
  protected readonly foto = signal(this.u?.foto_url ?? '');
  protected readonly bio = signal(this.u?.bio ?? '');
  protected readonly cidade = signal(this.u?.cidade ?? '');
  protected readonly uf = signal(this.u?.uf ?? '');
  protected readonly capa = signal(this.u?.capa && CAPAS[this.u.capa] ? this.u.capa : 'verde');
  protected readonly previaFoto = computed(() => imagemSegura(this.foto().trim()));
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal(false);

  protected async salvar() {
    const foto = this.foto().trim() ? linkSeguro(this.foto()) : null;
    if (this.foto().trim() && !foto) {
      this.avisos.mostrar('O link da foto precisa começar com https://', 'erro');
      return;
    }
    this.salvando.set(true);
    try {
      await this.auth.atualizarPerfil({
        nome: this.nome().trim(),
        foto_url: foto,
        bio: this.bio().trim() || null,
        cidade: this.cidade().trim() || null,
        uf: this.uf() || null,
        capa: this.capa(),
      });
      this.avisos.mostrar('Perfil atualizado!');
      this.router.navigateByUrl('/perfil');
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.salvando.set(false);
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
