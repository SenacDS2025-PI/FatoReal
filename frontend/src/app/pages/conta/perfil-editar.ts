import { DeputadosCep, buscarCep, deputadosDoCep, soNumerosCep } from '../../core/cep.service';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { rotaPolitico } from '../../core/politicos.service';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { CAPAS } from '../../core/perfis.service';
import { imagemSegura, linkSeguro, UFS } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';
import { REDES, RedesSociais, linkDaRede } from '../../shared/redes-sociais';
import { reduzirImagem } from '../../shared/imagem-reduzida';
import { COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Redes } from '../../core/modelos';

/** Página própria para editar o perfil (com prévia ao vivo) e cuidar da conta. */
@Component({
  selector: 'app-perfil-editar',
  imports: [FormsModule, RouterLink, Avatar, Icone, RedesSociais],
  template: `
    @if (auth.usuario(); as u) {
      <div class="perfil-editar">
        <header class="perfil-editar-topo">
          <a routerLink="/perfil" class="link-voltar"><app-icone nome="arrow_back" /> Voltar ao perfil</a>
          <h1>Editar perfil</h1>
        </header>

        <form #f="ngForm" (ngSubmit)="f.valid && salvar()">
          <!-- Prévia ao vivo -->
          <section class="card perfil-pessoa perfil-editar-previa" aria-label="Prévia do perfil">
            <div class="pp-capa" [style.background]="previaCapa() ? 'center / cover no-repeat url(' + previaCapa() + ')' : capas[capa()].fundo"></div>
            <div class="pp-corpo">
              <div class="pp-topo">
                <app-avatar class="pp-foto" [nome]="nome() || u.nome" [url]="previaFoto()" [tamanho]="110" />
                <div class="pp-id">
                  <h1>{{ nome() || 'Seu nome' }}</h1>
                  <p class="pp-linha">@if (profissao()) { <span>{{ profissao() }}</span> } @if (cidade() || uf()) { <span><app-icone nome="location_on" /> {{ cidade() }}{{ cidade() && uf() ? ', ' : '' }}{{ uf() }}</span> }</p>
                  @if (bio()) { <p class="pp-bio">{{ bio() }}</p> }
                  <app-redes [redes]="redesLimpas()" />
                </div>
              </div>
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
            <div class="envio-imagens">
              <div class="envio-imagem">
                <span class="rotulo">Foto de perfil</span>
                <div class="envio-linha">
                  <app-avatar [nome]="nome() || u.nome" [url]="previaFoto()" [tamanho]="64" />
                  <label class="botao botao-fantasma botao-p"><app-icone nome="add_a_photo" /> Enviar foto<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="enviar($event, 'foto')" /></label>
                  @if (foto()) { <button type="button" class="link-discreto" (click)="foto.set('')">Remover</button> }
                </div>
              </div>
              @if (auth.aceita('capa_url')) {
                <div class="envio-imagem">
                  <span class="rotulo">Imagem de capa</span>
                  <div class="envio-linha">
                    <span class="envio-capa" [style.background]="previaCapa() ? 'center / cover url(' + previaCapa() + ')' : capas[capa()].fundo"></span>
                    <label class="botao botao-fantasma botao-p"><app-icone nome="wallpaper" /> Enviar capa<input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="enviar($event, 'capa')" /></label>
                    @if (capaUrl()) { <button type="button" class="link-discreto" (click)="capaUrl.set('')">Usar cor</button> }
                  </div>
                </div>
              }
            </div>
            <details class="campo-form">
              <summary class="texto-p">Prefere colar um link de imagem?</summary>
              <label for="e-foto">Link da foto</label>
              <input id="e-foto" name="foto" type="url" [ngModel]="foto().startsWith('data:') || avatarDoSite(foto()) ? '' : foto()" (ngModelChange)="foto.set($event)" placeholder="https://..." />
            </details>
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
            @if (auth.aceita('profissao')) {
              <div class="campo-form">
                <label for="e-prof">Profissão ou ocupação</label>
                <input id="e-prof" name="profissao" maxlength="60" [ngModel]="profissao()" (ngModelChange)="profissao.set($event)" placeholder="Ex.: Estudante de Direito, Professora, Técnico em TI" />
              </div>
            }
            @if (!auth.aceita('profissao') || !auth.aceita('interesses')) {
              <!-- Some quando o banco ganha as colunas (supabase/perfil-campos-extras.sql) -->
              <p class="texto-suave"><app-icone nome="info" /> Profissão e temas de interesse ainda não estão disponíveis nesta versão do site.</p>
            }
            @if (auth.aceita('interesses')) {
              <fieldset class="campo-form">
                <legend>Temas de interesse</legend>
                <div class="bv-temas">
                  @for (t of temas; track t) {
                    <button type="button" [attr.aria-pressed]="interesses().includes(t)" [class.ativo]="interesses().includes(t)" [style.--cor]="corTema[t]" (click)="alternarInteresse(t)"><app-icone [nome]="iconeTema[t]" /> {{ t }}</button>
                  }
                </div>
              </fieldset>
            }
            @if (auth.aceita('cidade') || auth.aceita('uf')) {
              <div class="campo-form cep-campo">
                <label for="e-cep">CEP <small class="texto-suave">(opcional: preenche cidade e estado)</small></label>
                <input id="e-cep" name="cep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000"
                  [ngModel]="cep()" (ngModelChange)="cep.set($event)" (blur)="aoSairDoCep()" />
                @if (statusCep(); as st) { <small [class.alerta-erro]="st.erro" [class.texto-suave]="!st.erro" role="status">@if (st.erro) { <app-icone nome="error" /> } @else { <app-icone nome="check_circle" /> } {{ st.texto }}</small> }
                <small class="texto-suave">O CEP não é guardado: serve só para achar sua cidade.</small>
              </div>
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
              @if (deputadosEstado(); as d) {
                <div class="cep-deputados">
                  <strong>Deputados do seu estado ({{ d.uf }}): {{ d.total }}</strong>
                  <ul>
                    @for (dep of d.dados.slice(0, 8); track dep.id) {
                      <li><a [routerLink]="rotaPolitico(dep)" [title]="dep.nome + ' (' + dep.partido + ')'">
                        <app-avatar [nome]="dep.nome" [url]="dep.foto" [tamanho]="40" /><span>{{ dep.nome }}</span></a></li>
                    }
                  </ul>
                  <a [routerLink]="['/politicos']" [queryParams]="{ uf: d.uf }" class="link-seta">Ver todos de {{ d.uf }} <app-icone nome="arrow_forward" /></a>
                  <small class="texto-suave">Fonte: {{ d.fonte }}</small>
                </div>
              }
            }
          </section>

          @if (auth.aceita('redes')) {
            <section class="card">
              <h2 class="titulo-secao">Redes sociais</h2>
              <p class="texto-p">Aparecem como ícones clicáveis no seu perfil. Use o nome de usuário ou cole o link. No WhatsApp, coloque o número com DDD.</p>
              <div class="redes-campos">
                @for (r of redes; track r.chave) {
                  <div class="campo-form">
                    <label [for]="'e-' + r.chave">{{ r.nome }}</label>
                    <input [id]="'e-' + r.chave" [name]="r.chave" maxlength="120" [ngModel]="valoresRedes()[r.chave] ?? ''" (ngModelChange)="mudarRede(r.chave, $event)" [placeholder]="r.dica" autocomplete="off" />
                    @if (valoresRedes()[r.chave] && !linkRede(r.chave)) { <small class="erro-campo">Não reconhecemos esse {{ r.chave === 'whatsapp' ? 'número' : 'usuário ou link' }}.</small> }
                  </div>
                }
              </div>
              <p class="texto-p"><app-icone nome="lock" /> Só coloque o WhatsApp se quiser que qualquer pessoa possa te chamar.</p>
            </section>
          }

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
          <p class="texto-suave">Guardamos só o que você preenche aqui (nome, e-mail, foto, capa, bio, cidade, profissão, interesses e redes) e o que você publica (LGPD). Você pode sair ou excluir sua conta quando quiser.</p>
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
  protected readonly rotaPolitico = rotaPolitico;

  protected readonly capas = CAPAS;
  protected readonly chavesCapa = Object.keys(CAPAS);
  protected readonly ufs = UFS;

  private readonly u = this.auth.usuario();
  protected readonly nome = signal(this.u?.nome ?? '');
  protected readonly foto = signal(this.u?.foto_url ?? '');
  protected readonly bio = signal(this.u?.bio ?? '');
  protected readonly cidade = signal(this.u?.cidade ?? '');
  protected readonly uf = signal(this.u?.uf ?? '');

  // CEP: só preenche cidade e UF (não é salvo). GET {API_URL}/cep/<cep>?politicos=0
  protected readonly cep = signal('');
  protected readonly statusCep = signal<{ texto: string; erro: boolean } | null>(null);
  protected readonly deputadosEstado = signal<DeputadosCep | null>(null);
  private ultimoCep = '';

  protected async aoSairDoCep() {
    const texto = this.cep().trim();
    if (!texto) return this.statusCep.set(null);
    const cep = soNumerosCep(texto);
    if (!cep) return this.statusCep.set({ texto: 'CEP inválido: informe 8 números.', erro: true });
    if (cep === this.ultimoCep) return;
    this.ultimoCep = cep;
    this.cep.set(`${cep.slice(0, 5)}-${cep.slice(5)}`);
    this.statusCep.set({ texto: 'Procurando o CEP...', erro: false });
    try {
      const e = await buscarCep(cep);
      if (e.cidade) this.cidade.set(e.cidade);
      if (e.uf && this.ufs.includes(e.uf)) this.uf.set(e.uf);
      this.statusCep.set({ texto: `${e.cidade} – ${e.uf} preenchidos.`, erro: false });
      // Extra: deputados do estado (não trava a tela se falhar)
      deputadosDoCep(cep).then((d) => this.deputadosEstado.set(d && d.total ? d : null));
    } catch (err) {
      this.ultimoCep = '';
      this.statusCep.set({ texto: err instanceof Error ? err.message : 'Não deu para buscar o CEP agora.', erro: true });
    }
  }
  protected readonly capa = signal(this.u?.capa && CAPAS[this.u.capa] ? this.u.capa : 'verde');
  protected readonly previaFoto = computed(() => imagemSegura(this.foto().trim()));
  protected readonly profissao = signal(this.u?.profissao ?? '');
  protected readonly interesses = signal<string[]>(this.u?.interesses ?? []);
  protected readonly capaUrl = signal(this.u?.capa_url ?? '');
  protected readonly previaCapa = computed(() => imagemSegura(this.capaUrl().trim()));
  protected readonly valoresRedes = signal<Redes>({ ...(this.u?.redes ?? {}) });
  protected readonly redes = REDES;
  protected readonly temas = Object.keys(ICONE_TEMA);
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly corTema = COR_TEMA;
  /** Só as redes com valor válido (para a prévia e para salvar). */
  protected readonly redesLimpas = computed<Redes>(() => {
    const r: Redes = {};
    for (const x of REDES) {
      const v = this.valoresRedes()[x.chave]?.trim();
      if (v && linkDaRede(x.chave, v)) r[x.chave] = v;
    }
    return r;
  });

  protected linkRede(c: keyof Redes) {
    return linkDaRede(c, this.valoresRedes()[c]);
  }
  protected mudarRede(c: keyof Redes, v: string) {
    this.valoresRedes.update((r) => ({ ...r, [c]: v }));
  }
  protected alternarInteresse(t: string) {
    this.interesses.update((l) => (l.includes(t) ? l.filter((x) => x !== t) : [...l, t]));
  }
  protected async enviar(e: Event, tipo: 'foto' | 'capa') {
    const input = e.target as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    try {
      if (tipo === 'foto') this.foto.set(await reduzirImagem(arquivo, 400, 400));
      else this.capaUrl.set(await reduzirImagem(arquivo, 1200, 360));
    } catch (err) {
      this.avisos.erro(err);
    }
  }
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal(false);

  /** Avatar padrão do próprio site (ex.: img/avatares/a5.svg, dado na criação da conta): não é um link digitado. */
  protected avatarDoSite(f: string): boolean {
    return /^img\/avatares\/a\d{1,2}\.svg$/.test(f.trim());
  }

  protected async salvar() {
    const f = this.foto().trim();
    const foto = f ? (this.avatarDoSite(f) ? f : f.startsWith('data:') ? imagemSegura(f) : linkSeguro(f)) : null;
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
        profissao: this.profissao().trim() || null,
        interesses: this.interesses().length ? this.interesses() : null,
        redes: Object.keys(this.redesLimpas()).length ? this.redesLimpas() : null,
        capa_url: this.previaCapa() || null,
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
