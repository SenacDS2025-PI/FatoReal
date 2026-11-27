import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { AlertaJuridico, Politico, TipoAlerta } from '../../core/modelos';
import { BemDeclarado, CARGOS_MUNICIPAIS, adicionarAlerta, alertasDe, bensDe, obterTse, removerAlerta, situacaoCurta } from '../../core/politicos.service';
import { SeguidosService } from '../../core/seguidos.service';
import { modoDemo } from '../../core/supabase';
import { Avatar, Icone } from '../../shared/componentes';
import { PerguntarFatobot } from '../../shared/fatobot-bolha';
import { Favoritar } from '../../shared/favoritar';
import { nomeEstado } from '../../shared/mapa-brasil';

/**
 * Perfil de um eleito do TSE (presidente, governador, deputado estadual, prefeito, vereador e vices).
 * Mesma base do perfil de deputado (cabeçalho, cartões, polêmicas, fontes), mas só com o que o TSE publica.
 * Texto honesto: o TSE mostra quem FOI ELEITO, não quem está no cargo hoje.
 */
@Component({
  selector: 'app-perfil-tse',
  imports: [RouterLink, FormsModule, DatePipe, CurrencyPipe, DecimalPipe, Avatar, Icone, PerguntarFatobot, Favoritar],
  template: `
    <a routerLink="/politicos" [queryParams]="voltar()" class="link-voltar"><app-icone nome="arrow_back" /> Voltar para Políticos</a>

    @if (carregando()) {
      <div class="card perfil-cabecalho" aria-busy="true">
        <span class="esqueleto esqueleto-foto"></span>
        <div class="esqueleto-linhas"><span class="esqueleto" style="width: 40%"></span><span class="esqueleto" style="width: 25%"></span></div>
      </div>
    } @else if (erro()) {
      <div class="card alerta-erro" role="alert"><app-icone nome="error" /> {{ erro() }} <button type="button" class="botao botao-fantasma" (click)="carregar()">Tentar de novo</button></div>
    } @else if (politico(); as p) {
      <article class="perfil">
        <header class="card perfil-slide">
          <div class="ps-topo">
            <app-avatar class="avatar-oficial ps-foto" [nome]="p.nome" [url]="p.foto_url" [tamanho]="148" />
            <div class="ps-id">
              <h1>{{ p.nome }}</h1>
              <p class="ps-cargo">{{ p.cargo }} • {{ local(p) }}</p>
              <div class="ps-chips">
                @if (p.partido) { <span class="ps-partido"><span class="ps-sigla">{{ p.partido.slice(0, 2) }}</span> {{ p.partido }}</span> }
                <a class="etiqueta etiqueta-verde" [href]="p.fonte_url" target="_blank" rel="noopener noreferrer"><span class="ponto"></span>{{ situacaoCurta(p) }} — fonte: TSE</a>
              </div>
              <dl class="ps-info">
                <div><dt>Cargo disputado</dt><dd>{{ p.cargo }}</dd></div>
                <div><dt>{{ municipal(p) ? 'Cidade' : 'Onde' }}</dt><dd>{{ local(p) }}</dd></div>
                <div><dt>Nome completo</dt><dd>{{ p.nome_civil || '—' }}</dd></div>
                <div><dt>Escolaridade</dt><dd>{{ p.escolaridade || '—' }}</dd></div>
                @if (p.numero_urna) { <div><dt>Número na urna</dt><dd>{{ p.numero_urna }}</dd></div> }
                @if (p.ocupacao) { <div><dt>Ocupação declarada</dt><dd>{{ p.ocupacao }}</dd></div> }
                @if (p.data_nascimento) { <div><dt>Nascimento</dt><dd>{{ p.data_nascimento | date: 'dd/MM/yyyy' : 'UTC' }}@if (idade(p) !== null) { ({{ idade(p) }} anos) }@if (p.municipio_nascimento) { · {{ p.municipio_nascimento }} }</dd></div> }
              </dl>
            </div>
          </div>
          <div class="perfil-acoes ps-acoes">
            <button type="button" class="botao botao-verde" [perguntarFatobot]="pergunta(p)"><app-icone nome="smart_toy" /> Perguntar ao FatoBot</button>
            <button type="button" class="botao botao-fantasma" [class.botao-seguindo-politico]="seguidos.sigo(p)" (click)="seguidos.alternar(p)">
              <app-icone [nome]="seguidos.sigo(p) ? 'notifications_active' : 'person_add'" /> {{ seguidos.sigo(p) ? 'Seguindo' : 'Seguir' }}
            </button>
            <app-favoritar tipo="politico" [refId]="'tse-' + p.id" [titulo]="p.nome + ' (' + p.cargo + (p.partido ? ', ' + p.partido : '') + ')'" [url]="p.fonte_url || null" />
            <a class="botao botao-fantasma" [href]="p.fonte_url" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Dados no TSE</a>
          </div>
        </header>

        <section class="card ps-cartao">
          <h2 class="ps-titulo"><span class="ps-icone"><app-icone nome="info" /></span> O que estes dados mostram</h2>
          <p class="texto-p">O TSE publica quem <strong>venceu a eleição</strong> ({{ situacaoCurta(p).toLowerCase() }}). Isso não garante que a pessoa esteja no cargo hoje: pode ter havido renúncia, cassação, licença ou posse do vice.</p>
          <p class="texto-p">Para este cargo não existe uma fonte nacional com votações, gastos ou projetos do mandato. Confira no site oficial {{ ondeConferir(p) }}.</p>
        </section>

        <!-- Candidatura (TSE) -->
        <section class="card ps-cartao" aria-labelledby="pt-candidatura">
          <h2 id="pt-candidatura" class="ps-titulo"><span class="ps-icone"><app-icone nome="how_to_vote" /></span> Candidatura</h2>
          <dl class="pt-dados">
            <div><dt>Votos recebidos</dt><dd>@if (p.votos !== null && p.votos !== undefined) { {{ p.votos | number: '1.0-0' : 'pt-BR' }} votos@if (p.turno) { no {{ p.turno }}º turno } } @else { <span class="texto-suave">Sem dados</span> }</dd></div>
            <div><dt>Coligação ou federação</dt><dd>@if (p.coligacao) { {{ p.coligacao }} } @else if (p.coligacao === null && temDetalhes(p)) { Partido sozinho } @else { <span class="texto-suave">Sem dados</span> }</dd></div>
            <div><dt>Tentou a reeleição?</dt><dd>@if (p.reeleicao === true) { Sim } @else if (p.reeleicao === false) { Não } @else { <span class="texto-suave">Sem dados</span> }</dd></div>
          </dl>
          <p class="pt-fonte"><app-icone nome="verified" /> Fonte: <a [href]="p.fonte_url" target="_blank" rel="noopener noreferrer">TSE — candidatos eleitos em {{ ano(p) }}</a>. Votos nominais no turno em que venceu.</p>
        </section>

        <!-- Bens declarados (TSE) -->
        <section class="card ps-cartao" aria-labelledby="pt-bens">
          <h2 id="pt-bens" class="ps-titulo"><span class="ps-icone"><app-icone nome="account_balance_wallet" /></span> Bens declarados na candidatura</h2>
          @if (carregandoBens()) {
            <p class="texto-suave">Carregando os bens...</p>
          } @else if (p.bens_total === null || p.bens_total === undefined) {
            <p class="texto-suave">Sem dados de bens para esta pessoa.</p>
          } @else if (p.bens_total === 0 && !bens().length) {
            <p class="texto-p">Declarou <strong>não ter bens</strong> na candidatura de {{ ano(p) }}.</p>
          } @else {
            <p class="pt-total"><span>Total declarado</span><strong>{{ p.bens_total | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong></p>
            @if (bens().length) {
              <ol class="pt-bens">
                @for (b of bensVisiveis(); track b.ano + '-' + b.ordem) {
                  <li>
                    <span><strong>{{ b.tipo || 'Bem' }}</strong>@if (b.descricao) { <small>{{ b.descricao }}</small> }</span>
                    <span class="pt-valor">@if (b.valor !== null) { {{ b.valor | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }} } @else { — }</span>
                  </li>
                }
              </ol>
              @if (bens().length > LIMITE_BENS) {
                <button type="button" class="botao botao-fantasma" (click)="todosBens.set(!todosBens())">
                  <app-icone [nome]="todosBens() ? 'expand_less' : 'expand_more'" /> {{ todosBens() ? 'Mostrar menos' : 'Ver todos os ' + bens().length + ' bens' }}
                </button>
              }
            }
          }
          <p class="pt-fonte"><app-icone nome="info" /> São os bens que a pessoa <strong>declarou ao TSE ao se candidatar</strong> em {{ ano(p) }}, não o patrimônio de hoje. Fonte: <a [href]="p.fonte_url" target="_blank" rel="noopener noreferrer">TSE — bens declarados na candidatura {{ ano(p) }}</a>.</p>
        </section>

        <!-- Polêmicas e problemas na Justiça (cadastradas pela moderação, sempre com fonte) -->
        @if (!carregandoAlertas()) {
          <section class="card polemicas" [class.com-registros]="alertas().length" aria-labelledby="titulo-polemicas">
            <header class="polemicas-topo">
              <span class="polemicas-icone"><app-icone [nome]="alertas().length ? 'report' : 'gpp_maybe'" /></span>
              <div>
                <h2 id="titulo-polemicas">Polêmicas e problemas na Justiça</h2>
                @if (alertas().length) {
                  <p>{{ alertas().length }} {{ alertas().length === 1 ? 'registro' : 'registros' }} com fonte. Leia cada um e abra a fonte antes de tirar conclusões.</p>
                } @else {
                  <p>Nenhum registro cadastrado pela moderação para {{ p.nome }}. Isso não garante que não existam: confira nas fontes oficiais abaixo.</p>
                }
              </div>
              @if (auth.moderador() && !adicionando()) {
                <button type="button" class="botao botao-fantasma polemicas-add" (click)="adicionando.set(true)"><app-icone nome="add" /> Adicionar registro</button>
              }
            </header>

            @if (alertas().length) {
              <ol class="polemicas-lista">
                @for (a of alertas(); track a.id) {
                  <li [attr.data-gravidade]="gravidade[a.tipo]">
                    <div class="polemica-linha">
                      <span class="alerta-tipo">{{ a.tipo }}</span>
                      @if (a.data) { <time>{{ a.data | date: 'MM/yyyy' }}</time> }
                      @if (auth.moderador() && !a.verificado) {
                        <button type="button" class="polemica-remover" (click)="remover(a)" [attr.aria-label]="'Remover ' + a.titulo" title="Remover"><app-icone nome="delete" /></button>
                      }
                    </div>
                    <strong>{{ a.titulo }}</strong>
                    <p>{{ a.descricao }}</p>
                    <a class="polemica-fonte" [href]="a.fonte_url" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Fonte: {{ a.orgao }}</a>
                  </li>
                }
              </ol>
              <p class="polemicas-nota"><app-icone nome="balance" /> <span>Processo ou investigação em andamento não é condenação: todos têm direito à presunção de inocência até decisão final. Viu um registro errado? Avise pelo <a routerLink="/contato">contato</a>.</span></p>
            }

            @if (adicionando()) {
              <form class="polemicas-form" #f="ngForm" (ngSubmit)="f.valid && fonteValida() && salvarRegistro()">
                <h3>Novo registro (moderação)</h3>
                <div class="linha-campos">
                  <div class="campo-form">
                    <label for="pt-tipo">Tipo</label>
                    <select id="pt-tipo" name="tipo" [(ngModel)]="novo.tipo">
                      @for (t of tipos; track t) { <option [value]="t">{{ t }}</option> }
                    </select>
                  </div>
                  <div class="campo-form">
                    <label for="pt-data">Data do fato</label>
                    <input id="pt-data" name="data" type="date" [(ngModel)]="novo.data" />
                  </div>
                </div>
                <div class="campo-form">
                  <label for="pt-titulo">Título</label>
                  <input id="pt-titulo" name="titulo" [(ngModel)]="novo.titulo" required minlength="5" maxlength="140" placeholder="Resumo em uma linha, sem adjetivos" />
                </div>
                <div class="campo-form">
                  <label for="pt-desc">O que aconteceu</label>
                  <textarea id="pt-desc" name="descricao" rows="3" [(ngModel)]="novo.descricao" required minlength="20" maxlength="600" placeholder="Descreva só o que a fonte diz, com fatos e datas."></textarea>
                </div>
                <div class="linha-campos">
                  <div class="campo-form">
                    <label for="pt-orgao">Quem publicou</label>
                    <input id="pt-orgao" name="orgao" [(ngModel)]="novo.orgao" required maxlength="80" placeholder="Ex.: STF, TSE, Agência Brasil" />
                  </div>
                  <div class="campo-form campo-largo">
                    <label for="pt-fonte">Link da fonte (obrigatório)</label>
                    <input id="pt-fonte" name="fonte" type="url" [(ngModel)]="novo.fonte_url" required placeholder="https://..." />
                    @if (novo.fonte_url && !fonteValida()) { <small class="erro-campo">Use o endereço completo, começando com https://</small> }
                  </div>
                </div>
                <p class="texto-p"><app-icone nome="info" /> Só registre o que estiver publicado em fonte confiável (decisão judicial, órgão oficial ou veículo de imprensa). Sem fonte, não publique.</p>
                <div class="modal-acoes">
                  <button type="button" class="botao botao-fantasma" (click)="adicionando.set(false)">Cancelar</button>
                  <button type="submit" class="botao botao-perigo" [disabled]="f.invalid || !fonteValida() || salvando()">{{ salvando() ? 'Salvando...' : 'Publicar registro' }}</button>
                </div>
              </form>
            }

            <ul class="consultas-oficiais">
              @for (c of consultas; track c.url) { <li><a [href]="c.url" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> {{ c.nome }}</a></li> }
            </ul>
          </section>
        }

        <section class="card ps-cartao">
          <h2 class="ps-titulo"><span class="ps-icone"><app-icone nome="verified" /></span> Fontes</h2>
          <ul class="consultas-oficiais">
            <li><a [href]="p.fonte_url" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> TSE: dados abertos dos candidatos eleitos</a></li>
            <li><a href="https://divulgacandcontas.tse.jus.br/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> TSE: DivulgaCandContas (candidatura, bens e contas de campanha)</a></li>
          </ul>
          @if (p.data_coleta) { <p class="texto-suave">Dados importados em {{ p.data_coleta | date: 'dd/MM/yyyy' }}.</p> }
        </section>
      </article>
    } @else {
      <div class="card vazio">
        <app-icone nome="database" />
        <strong>Sem dados por enquanto</strong>
        <span>
          @if (demo) { Esta é a versão de demonstração (sem banco): os eleitos do TSE não estão disponíveis aqui. O Fato Real não inventa dados. }
          @else { Não encontramos este político nos dados importados do TSE. }
        </span>
        <a class="botao botao-fantasma" href="https://divulgacandcontas.tse.jus.br/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Consultar no TSE (DivulgaCandContas)</a>
      </div>
    }
  `,
})
export class PerfilTsePage implements OnInit {
  readonly id = input.required<string>();
  protected auth = inject(AuthService);
  protected seguidos = inject(SeguidosService);
  private avisos = inject(AvisosService);
  protected readonly demo = modoDemo;

  protected readonly politico = signal<Politico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  protected readonly alertas = signal<AlertaJuridico[]>([]);
  protected readonly bens = signal<BemDeclarado[]>([]);
  protected readonly carregandoBens = signal(false);
  protected readonly todosBens = signal(false);
  protected readonly LIMITE_BENS = 8;
  protected readonly bensVisiveis = computed(() => (this.todosBens() ? this.bens() : this.bens().slice(0, this.LIMITE_BENS)));
  protected readonly situacaoCurta = situacaoCurta;
  protected readonly carregandoAlertas = signal(true);

  protected readonly consultas = [
    { nome: 'STF: consulta de processos', url: 'https://portal.stf.jus.br/' },
    { nome: 'CNJ: condenações por improbidade', url: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php' },
    { nome: 'TSE: candidaturas e certidões', url: 'https://divulgacandcontas.tse.jus.br/' },
    { nome: 'Portal da Transparência: sanções (CEIS/CNEP)', url: 'https://portaldatransparencia.gov.br/sancoes' },
  ];
  protected readonly gravidade: Record<TipoAlerta, 'alta' | 'media' | 'neutra'> = {
    'Condenação': 'alta', 'Inelegibilidade': 'alta', 'Cassação': 'alta',
    'Processo em andamento': 'media', 'Investigação': 'media', 'Sanção administrativa': 'media', 'Polêmica': 'media',
    'Absolvição ou arquivamento': 'neutra',
  };
  protected readonly tipos = Object.keys(this.gravidade) as TipoAlerta[];

  /** "Voltar" leva para a lista do mesmo cargo (e estado/cidade, se for municipal). */
  protected readonly voltar = computed(() => {
    const p = this.politico();
    if (!p?.cargo) return {};
    return { cargo: p.cargo, uf: p.uf && p.uf !== 'BR' ? p.uf : null, cidade: p.municipio ?? null };
  });

  protected municipal(p: Politico): boolean {
    return CARGOS_MUNICIPAIS.includes(p.cargo ?? '');
  }
  protected local(p: Politico): string {
    if (p.municipio) return `${p.municipio}/${p.uf}`;
    if (p.uf === 'BR') return 'Brasil';
    return p.uf ? `${nomeEstado(p.uf)}/${p.uf}` : '—';
  }
  /** Ano da eleição (2022 ou 2024), tirado da situação ou do link da fonte. */
  protected ano(p: Politico): string {
    return p.situacao?.match(/\d{4}/)?.[0] ?? p.fonte_url?.match(/\d{4}/)?.[0] ?? '';
  }
  /** Idade hoje, pela data de nascimento do TSE. */
  protected idade(p: Politico): number | null {
    if (!p.data_nascimento) return null;
    const n = new Date(p.data_nascimento + 'T00:00:00Z');
    if (isNaN(n.getTime())) return null;
    const h = new Date();
    let i = h.getUTCFullYear() - n.getUTCFullYear();
    if (h.getUTCMonth() < n.getUTCMonth() || (h.getUTCMonth() === n.getUTCMonth() && h.getUTCDate() < n.getUTCDate())) i--;
    return i >= 18 && i < 120 ? i : null;
  }
  /** Já veio da importação nova (com os campos de candidatura)? Serve para diferenciar "sem coligação" de "sem dados". */
  protected temDetalhes(p: Politico): boolean {
    return p.numero_urna !== null && p.numero_urna !== undefined;
  }
  /** "da Presidência da República", "do governo do estado", "da prefeitura"... */
  protected ondeConferir(p: Politico): string {
    const c = p.cargo ?? '';
    if (c === 'Vereador(a)') return 'da Câmara Municipal da cidade';
    if (c === 'Deputado(a) Estadual') return p.uf === 'DF' ? 'da Câmara Legislativa do DF' : 'da Assembleia Legislativa do estado';
    if (c.includes('prefeito')) return 'da prefeitura';
    if (c.includes('overnador')) return 'do governo do estado';
    return 'da Presidência da República';
  }
  protected pergunta(p: Politico): string {
    return `O que se sabe, com fonte oficial, sobre ${p.nome} (${p.cargo}${p.partido ? ', ' + p.partido : ''}, ${this.local(p)})?`;
  }

  ngOnInit() {
    this.carregar();
  }

  protected async carregar() {
    this.carregando.set(true);
    this.erro.set('');
    try {
      const id = Number(this.id());
      const p = Number.isSafeInteger(id) && id > 0 ? await obterTse(id) : null;
      this.politico.set(p);
      if (p) {
        this.carregandoBens.set(true);
        bensDe(p.id).then((l) => this.bens.set(l)).catch(() => this.bens.set([])).finally(() => this.carregandoBens.set(false));
        this.carregandoAlertas.set(true);
        this.alertas.set(await alertasDe(p).catch(() => []));
        this.carregandoAlertas.set(false);
      }
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      this.carregando.set(false);
    }
  }

  // Formulário da moderação ("Adicionar registro")
  protected readonly adicionando = signal(false);
  protected readonly salvando = signal(false);
  protected novo = this.registroVazio();

  private registroVazio() {
    return { tipo: 'Polêmica' as TipoAlerta, titulo: '', descricao: '', orgao: '', data: '', fonte_url: '' };
  }

  protected fonteValida(): boolean {
    return /^https:\/\/[^\s]+\.[^\s]+/.test(this.novo.fonte_url.trim());
  }

  protected async salvarRegistro() {
    const p = this.politico();
    if (!p || !this.fonteValida()) return;
    this.salvando.set(true);
    try {
      await adicionarAlerta(p, {
        tipo: this.novo.tipo, titulo: this.novo.titulo.trim(), descricao: this.novo.descricao.trim(),
        orgao: this.novo.orgao.trim(), data: this.novo.data || null, fonte_url: this.novo.fonte_url.trim(),
      });
      this.alertas.set(await alertasDe(p));
      this.novo = this.registroVazio();
      this.adicionando.set(false);
      this.avisos.mostrar('Registro adicionado.');
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async remover(a: AlertaJuridico) {
    const p = this.politico();
    if (!p || !confirm(`Remover o registro "${a.titulo}"?`)) return;
    try {
      await removerAlerta(p, a.id);
      this.alertas.set(await alertasDe(p));
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
