import { Conferindo } from '../../shared/conferindo';
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisosService } from '../../core/avisos.service';
import { EstadoVerificacao, FatoBotService, ResultadoVerificacao } from '../../core/fatobot.service';
import { linkSeguro } from '../../core/util';
import { ChecagensService } from '../../core/checagens.service';
import { AFIRMACOES, Afirmacao, rodadaDaSemana, semanaDoAno } from '../../core/fato-ou-fake';
import { compartilharCartao } from '../../shared/cartao-compartilhar';
import { AvisoIa, FonteDado, Icone } from '../../shared/componentes';
import { SELOS, SeloStatus, TipoSelo, seloDoEstado } from '../../shared/selo-status';

type TipoAnexo = 'imagem' | 'video' | 'documento';

interface Anexo {
  arquivo: File;
  tipo: TipoAnexo;
  /** Endereço temporário para mostrar a miniatura (fotos e vídeos). */
  previa: string | null;
}

interface Item {
  afirmacao: string;
  link: string | null;
  anexos: { nome: string; tipo: TipoAnexo; tamanho: string }[];
  resultado: ResultadoVerificacao;
}

const MB = 1024 * 1024;
const LIMITE: Record<TipoAnexo, number> = { imagem: 10 * MB, documento: 10 * MB, video: 50 * MB };
const MAX_ANEXOS = 5;
const DOCUMENTOS = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

/** Verificação assistida: avaliação preliminar baseada nas fontes consultadas, nunca certificação automática. */
@Component({
  selector: 'app-verificar',
  imports: [Conferindo, FormsModule, DatePipe, Icone, FonteDado, AvisoIa, SeloStatus],
  template: `
    <header class="cabecalho-pagina ff-hero">
      <div>
        <h1>Fato <span>ou</span> fake?</h1>
        <p>Recebeu uma mensagem, um link, um print ou um vídeo sobre política? Cole aqui antes de compartilhar e veja se é fato ou fake. A resposta é uma avaliação preliminar, baseada só nas fontes consultadas.</p>
      </div>
      <img src="img/fatobot.svg" alt="" width="150" height="170" />
    </header>

    <div class="layout-comunidade">
      <div class="coluna-central">
        <form class="card form-verificar" (submit)="$event.preventDefault(); verificar()">
          <div class="campo-form">
            <label for="afirmacao">O que você quer verificar?</label>
            <textarea id="afirmacao" name="afirmacao" [(ngModel)]="afirmacao" rows="4" maxlength="1000" [attr.aria-invalid]="textoCurto()" aria-describedby="afirmacao-ajuda"
              placeholder="Ex.: A Câmara dos Deputados tem 513 deputados."></textarea>
            @if (textoCurto()) { <small id="afirmacao-ajuda" class="erro-campo">Escreva pelo menos {{ minimo }} letras para dar para verificar.</small> }
            @else { <small id="afirmacao-ajuda" class="texto-suave">De {{ minimo }} a 1000 letras.</small> }
          </div>

          <div class="campo-form">
            <label for="link-verificar">Link <small class="texto-suave">(opcional)</small></label>
            <div class="campo-com-icone">
              <app-icone nome="link" />
              <input id="link-verificar" name="link" type="url" inputmode="url" [(ngModel)]="link" placeholder="Cole a URL da notícia, post ou vídeo (https://...)" autocomplete="off" />
            </div>
            @if (link.trim() && !linkValido()) { <small class="erro-campo">Use um endereço completo, começando com https://</small> }
          </div>

          <div class="campo-form">
            <span class="rotulo">Anexos <small class="texto-suave">(opcional · até {{ maxAnexos }} arquivos)</small></span>
            <label class="zona-anexo" [class.arrastando]="arrastando()" (dragover)="$event.preventDefault(); arrastando.set(true)"
              (dragleave)="arrastando.set(false)" (drop)="$event.preventDefault(); arrastando.set(false); adicionar($event.dataTransfer?.files ?? null)">
              <input type="file" multiple [accept]="aceitos" (change)="adicionar(seletor.files); seletor.value = ''" #seletor />
              <app-icone nome="upload_file" />
              <span class="zona-bot" aria-hidden="true"><img src="img/fatobot-rosto.svg" alt="" /> Pode soltar, eu confiro!</span>
              <strong>Arraste aqui ou clique para escolher</strong>
              <span class="zona-anexo-tipos">
                <span><app-icone nome="image" /> Fotos e prints</span>
                <span><app-icone nome="movie" /> Vídeos</span>
                <span><app-icone nome="description" /> Documentos</span>
              </span>
              <small>JPG, PNG, WEBP ou GIF até 10 MB · MP4, WEBM ou MOV até 50 MB · PDF, DOC, DOCX ou TXT até 10 MB</small>
            </label>
            <p class="texto-p"><app-icone nome="info" /> Os anexos não são enviados nem guardados: a verificação automática usa só o texto da afirmação. Para checar fotos, vídeos e documentos, procure a publicação original ou uma agência de checagem.</p>
            @if (recebendo(); as r) {
              <app-conferindo modo="arquivo" [arquivos]="r.nomes" (fim)="aoCarregar(r.id)" />
            }
            @if (anexos().length) {
              <ul class="lista-anexos">
                @for (a of anexos(); track a.previa ?? a.arquivo.name + $index; let i = $index) {
                  <li>
                    <span class="anexo-previa" [attr.data-tipo]="a.tipo">
                      @if (a.tipo === 'imagem' && a.previa) { <img [src]="a.previa" alt="" /> }
                      @else if (a.tipo === 'video' && a.previa) { <video [src]="a.previa" muted preload="metadata"></video><app-icone nome="play_circle" class="anexo-play" /> }
                      @else { <app-icone nome="description" /> }
                    </span>
                    <span class="anexo-info"><strong>{{ a.arquivo.name }}</strong><small>{{ rotuloTipo[a.tipo] }} · {{ tamanho(a.arquivo.size) }}</small></span>
                    <button type="button" class="botao-seta" (click)="remover(i)" [attr.aria-label]="'Remover ' + a.arquivo.name"><app-icone nome="close" /></button>
                  </li>
                }
              </ul>
            }
          </div>

          <div class="form-verificar-rodape">
            <small class="texto-suave"><app-icone nome="lock" /> Não envie documentos com dados pessoais de outras pessoas (LGPD).</small>
            <button class="botao botao-verde" type="submit" [disabled]="!podeEnviar() || verificando()">
              <app-icone nome="search_check" /> {{ verificando() ? 'Enviando...' : 'Verificar' }}
            </button>
          </div>
        </form>

        <!-- Jornada da evidência (animação enquanto verifica) -->
        @if (verificando() || etapa() > 0) {
          <section class="card jornada" aria-live="polite" [attr.aria-busy]="verificando()">
            <h2 class="ps-titulo"><span class="ps-icone"><app-icone nome="route" /></span> {{ verificando() ? 'Verificando...' : 'Verificação concluída' }}</h2>
            <ol class="jornada-passos">
              @for (e of etapas; track e.titulo; let i = $index) {
                <li [class.feito]="etapa() > i" [class.atual]="etapa() === i && verificando()">
                  <span class="jornada-num">{{ (i + 1).toString().padStart(2, '0') }}</span>
                  <span class="jornada-icone"><app-icone [nome]="e.icone" /></span>
                  <strong>{{ e.titulo }}</strong>
                  <small>{{ e.texto }}</small>
                  <span class="jornada-status">
                    @if (etapa() > i && puladas()[i]) { <app-icone nome="do_not_disturb_on" /> {{ puladas()[i] }} }
                    @else if (etapa() > i) { <app-icone nome="check_circle" /> {{ e.feito }} } @else if (etapa() === i && verificando()) { <span class="jornada-giro"></span> Em andamento } @else { Aguardando }
                  </span>
                </li>
              }
            </ol>
            @if (verificando() && fatoDaVez(); as f) {
              <div class="jornada-fato">
                <span class="texto-suave"><app-icone nome="lightbulb" /> Enquanto verificamos, um fato rápido:</span>
                <article class="fato-card fato-card-largo" [class.revelado]="fatoRevelado()" [attr.data-fato]="f.fato">
                  <p class="fato-frase">“{{ f.texto }}”</p>
                  <span class="fato-carimbo"><app-icone [nome]="f.fato ? 'check_circle' : 'cancel'" /> {{ f.fato ? 'FATO' : 'FAKE' }}</span>
                  <p class="fato-exp">{{ resumo(f.explicacao) }}</p>
                </article>
              </div>
            }
          </section>
        }

        @for (it of historico(); track $index; let primeiro = $first) {
          <article class="card registro" [class.registro-novo]="primeiro">
            <header class="registro-topo">
              <div>
                <p class="sobretitulo">Registro contextualizado</p>
                <h2>Resultado da verificação</h2>
              </div>
              <app-selo [tipo]="selo(it.resultado.estado)" [grande]="true" />
            </header>
            <ul class="registro-campos">
              @if (it.afirmacao) { <li><span class="icone-tile" style="--c: #16a34a"><app-icone nome="format_quote" /></span><span><small>Afirmação</small><strong>“{{ it.afirmacao }}”</strong></span></li> }
              @if (it.link) { <li><span class="icone-tile" style="--c: #0891b2"><app-icone nome="link" /></span><span><small>Link enviado</small><a [href]="it.link" target="_blank" rel="noopener noreferrer nofollow">{{ it.link }}</a></span></li> }
              @if (it.anexos.length) {
                <li><span class="icone-tile" style="--c: #7c3aed"><app-icone nome="attach_file" /></span><span><small>Anexos</small>
                  <span class="registro-anexos">@for (a of it.anexos; track $index) { <span><app-icone [nome]="iconeTipo[a.tipo]" /> {{ a.nome }} <em>({{ a.tamanho }})</em></span> }</span></span></li>
              }
              <li><span class="icone-tile" style="--c: #2563eb"><app-icone nome="account_balance" /></span><span><small>Fonte primária</small><strong>{{ it.resultado.contexto?.fonte || it.resultado.fontes[0]?.titulo || 'Ainda sem fonte encontrada' }}</strong></span></li>
              <li><span class="icone-tile" style="--c: #9333ea"><app-icone nome="calendar_month" /></span><span><small>Data da consulta</small><strong>{{ it.resultado.consultado_em | date: "dd 'de' MMMM 'de' yyyy, HH:mm" : '' : 'pt-BR' }}</strong></span></li>
              <li><span class="icone-tile" style="--c: #d97706"><app-icone nome="category" /></span><span><small>Categoria</small><strong>{{ it.resultado.contexto?.categoria || categoria(it.afirmacao) }}</strong></span></li>
            </ul>
            <div class="registro-classes" role="list" aria-label="Classificação">
              @for (c of classes; track c) {
                <span role="listitem" class="registro-classe" [attr.data-selo]="c" [class.ativa]="selo(it.resultado.estado) === c" [attr.aria-current]="selo(it.resultado.estado) === c">
                  <app-icone [nome]="selos[c].icone" /> {{ selos[c].texto }}
                </span>
              }
            </div>
            <p class="registro-explicacao">{{ it.resultado.explicacao }}</p>
            @for (f of it.resultado.fontes; track f.url) { <app-fonte [fonte]="f" rotulo="data" /> }
            <div class="resultado-rodape">
              <small class="texto-suave">Avaliação preliminar, baseada só nas fontes consultadas.</small>
              <button type="button" class="botao botao-fantasma botao-p" (click)="compartilhar(it)"><app-icone nome="ios_share" /> Compartilhar card</button>
            </div>
            <app-aviso-ia />
          </article>
        }
        <!-- Fatos rápidos: leitura automática; o desafio é opcional -->
        <section class="card fatos-rapidos">
          <header class="fatos-topo">
            <h2 class="ps-titulo"><span class="ps-icone"><app-icone nome="bolt" /></span> Fatos rápidos da semana</h2>
            <label class="fatos-desafio"><input type="checkbox" [checked]="desafio()" (change)="alternarDesafio()" /> Modo desafio <small class="texto-suave">(esconde as respostas)</small></label>
          </header>
          <p class="texto-p">{{ desafio() ? 'Toque em Fato ou Fake em cada cartão. Acertando 5, você ganha o selo "Caçador de fake news" no seu perfil.' : 'Boatos e verdades que circulam por aí, já checados com fonte oficial. Mudam toda segunda-feira.' }}</p>
          <div class="fatos-grade">
            @for (f of rodada; track f.id; let i = $index) {
              @let r = respostas()[f.id];
              <article class="fato-card" [class.revelado]="!desafio() || r !== undefined" [attr.data-fato]="f.fato" [class.acertou]="desafio() && r === f.fato" [class.errou]="desafio() && r !== undefined && r !== f.fato" [style.animation-delay.ms]="i * 120">
                <p class="fato-frase">“{{ f.texto }}”</p>
                @if (!desafio() || r !== undefined) {
                  <span class="fato-carimbo"><app-icone [nome]="f.fato ? 'check_circle' : 'cancel'" /> {{ f.fato ? 'FATO' : 'FAKE' }}</span>
                  @if (desafio()) { <small class="fato-resultado">{{ r === f.fato ? 'Você acertou!' : 'Não foi dessa vez.' }}</small> }
                  <p class="fato-exp">{{ resumo(f.explicacao) }}</p>
                  <a class="fato-fonte" [href]="f.fonte.url" target="_blank" rel="noopener noreferrer"><app-icone nome="verified" /> {{ f.fonte.titulo }}</a>
                } @else {
                  <div class="fato-botoes">
                    <button type="button" class="fato-sim" (click)="responder(f.id, true)"><app-icone nome="check_circle" /> Fato</button>
                    <button type="button" class="fato-nao" (click)="responder(f.id, false)"><app-icone nome="cancel" /> Fake</button>
                  </div>
                }
              </article>
            }
          </div>
          @if (desafio()) { <p class="fatos-placar"><app-icone nome="emoji_events" /> {{ acertos() }} de {{ rodada.length }} nesta semana · {{ totalAcertos() }} acertos no total</p> }
        </section>
      </div>

      <aside class="coluna-direita">
        <section class="card bloco">
          <h2><app-icone nome="rule" /> O que cada resultado quer dizer</h2>
          <dl class="estados">
            @for (c of legenda; track c) {
              <div><dt><app-selo [tipo]="c" /></dt><dd>{{ selos[c].explicacao }}</dd></div>
            }
          </dl>
        </section>
        <section class="card bloco">
          <h2><app-icone nome="travel_explore" /> Agências de checagem</h2>
          <ul class="lista-links">
            <li><a href="https://www.agencialupa.org/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Agência Lupa</a></li>
            <li><a href="https://www.aosfatos.org/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Aos Fatos</a></li>
            <li><a href="https://projetocomprova.com.br/" target="_blank" rel="noopener noreferrer"><app-icone nome="open_in_new" /> Projeto Comprova</a></li>
          </ul>
        </section>
      </aside>
    </div>
  `,
})
export class VerificarPage implements OnDestroy {
  private bot = inject(FatoBotService);
  private avisos = inject(AvisosService);
  private checagens = inject(ChecagensService);
  protected afirmacao = '';
  protected link = '';
  protected readonly anexos = signal<Anexo[]>([]);
  protected readonly arrastando = signal(false);
  protected readonly maxAnexos = MAX_ANEXOS;
  protected readonly aceitos = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.txt';
  protected readonly rotuloTipo: Record<TipoAnexo, string> = { imagem: 'Foto', video: 'Vídeo', documento: 'Documento' };
  protected readonly iconeTipo: Record<TipoAnexo, string> = { imagem: 'image', video: 'movie', documento: 'description' };
  protected readonly verificando = signal(false);
  // Jornada da evidência (slide 2): cada etapa acende enquanto a verificação acontece
  protected readonly etapa = signal(0);
  protected readonly etapas = [
    { titulo: 'Recebida', icone: 'inbox', texto: 'Seu pedido foi registrado.', feito: 'Recebida' },
    { titulo: 'Coleta em fontes oficiais', icone: 'travel_explore', texto: 'Câmara, Senado, TSE e dados públicos.', feito: 'Coleta concluída' },
    { titulo: 'Análise com IA', icone: 'psychology', texto: 'Compara o conteúdo com as fontes.', feito: 'Análise concluída' },
    { titulo: 'Conferência', icone: 'fact_check', texto: 'Checa datas, contexto e anexos.', feito: 'Conferida' },
    { titulo: 'Classificação', icone: 'verified', texto: 'Define o selo do resultado.', feito: 'Classificada' },
  ];
  // ---------- Fatos rápidos ----------
  protected readonly rodada: Afirmacao[] = rodadaDaSemana();
  private readonly semana = semanaDoAno();
  protected readonly desafio = signal(false);
  protected readonly respostas = signal<Record<number, boolean>>(this.lerJogo().semana === this.semana ? this.lerJogo().respostas : {});
  protected readonly totalAcertos = signal<number>(this.lerJogo().total ?? 0);
  protected readonly acertos = computed(() => this.rodada.filter((f) => this.respostas()[f.id] === f.fato).length);
  protected readonly fatoDaVez = signal<Afirmacao | null>(null);
  protected readonly fatoRevelado = signal(false);
  private relogioFato?: ReturnType<typeof setInterval>;

  private lerJogo(): { semana: number; respostas: Record<number, boolean>; total: number } {
    try {
      return { semana: 0, respostas: {}, total: 0, ...JSON.parse(localStorage.getItem('fatoreal-fato-ou-fake') ?? '{}') };
    } catch {
      return { semana: 0, respostas: {}, total: 0 };
    }
  }
  protected alternarDesafio() {
    this.desafio.update((d) => !d);
  }
  protected responder(id: number, fato: boolean) {
    const certo = this.rodada.find((f) => f.id === id)?.fato === fato;
    this.respostas.update((r) => ({ ...r, [id]: fato }));
    if (certo) this.totalAcertos.update((t) => t + 1);
    try {
      localStorage.setItem('fatoreal-fato-ou-fake', JSON.stringify({ semana: this.semana, respostas: this.respostas(), total: this.totalAcertos() }));
    } catch {
      /* sem armazenamento */
    }
  }
  /** Primeira frase da explicação, para leitura rápida. */
  protected resumo(t: string) {
    const i = t.search(/\.\s/);
    return i > 40 ? t.slice(0, i + 1) : t;
  }
  private mostrarFatos() {
    const lista = [...AFIRMACOES].sort(() => Math.random() - 0.5);
    let k = 0;
    const proximo = () => {
      this.fatoRevelado.set(false);
      this.fatoDaVez.set(lista[k++ % lista.length]);
      setTimeout(() => this.fatoRevelado.set(true), 1300);
    };
    proximo();
    this.relogioFato = setInterval(proximo, 3800);
  }

  protected readonly selos = SELOS;
  protected readonly classes: TipoSelo[] = ['verificado', 'confiavel', 'analise', 'sem-contexto', 'insuficiente', 'falso'];
  protected readonly legenda: TipoSelo[] = ['verificado', 'confiavel', 'analise', 'sem-contexto', 'insuficiente', 'falso'];
  protected selo(e: EstadoVerificacao): TipoSelo {
    return seloDoEstado(e);
  }
  protected categoria(t: string): string {
    const x = t.toLowerCase();
    if (/sa[uú]de|sus|hospital|vacina/.test(x)) return 'Saúde pública';
    if (/escola|educa|ensino|professor/.test(x)) return 'Educação';
    if (/imposto|econom|infla|sal[aá]rio|gasto|or[cç]amento/.test(x)) return 'Economia';
    if (/elei|voto|urna|candidat|tse/.test(x)) return 'Eleições';
    if (/deputad|senad|c[aâ]mara|congresso|lei|projeto/.test(x)) return 'Política';
    return 'Não identificada';
  }
  protected readonly historico = signal<Item[]>([]);
  protected readonly estados: [EstadoVerificacao, string][] = [
    ['Evidências sustentam', 'Fontes primárias ou confiáveis confirmam o essencial da afirmação.'],
    ['Evidências contradizem', 'Fontes primárias ou confiáveis mostram que a afirmação é incorreta.'],
    ['Fora de contexto', 'Há base nos fatos, mas data, local ou sentido foram alterados ou omitidos.'],
    ['Evidência insuficiente', 'Não há fontes suficientes para confirmar nem para negar. Ausência de evidência não é prova de falsidade.'],
    ['Em análise', 'Recebida; aguardando busca de fontes ou revisão humana.'],
    ['Fonte confiável', 'O conteúdo vem direto de um site oficial.'],
  ];

  protected async compartilhar(it: Item) {
    const cores: Record<string, string> = {
      'Evidências sustentam': '#0e8a5f', 'Evidências contradizem': '#c0262d', 'Fora de contexto': '#b07a00', 'Evidência insuficiente': '#2f6fb0', 'Fonte confiável': '#2563eb',
    };
    try {
      const r = await compartilharCartao({
        rotulo: 'Checagem de informação',
        titulo: it.afirmacao ? `“${it.afirmacao}”` : it.link || 'Conteúdo enviado',
        selo: { texto: SELOS[this.selo(it.resultado.estado)].texto, cor: cores[it.resultado.estado] ?? '#0b2a4a' },
        subtitulo: it.resultado.explicacao,
        fonte: it.resultado.fontes[0]?.titulo,
        nomeArquivo: 'fatoreal-checagem',
      });
      if (r === 'baixado') this.avisos.mostrar('Card baixado! Compartilhe e ajude a combater fake news.');
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected icone(e: EstadoVerificacao): string {
    return {
      'Evidências sustentam': 'check_circle',
      'Evidências contradizem': 'cancel',
      'Fora de contexto': 'error',
      'Evidência insuficiente': 'help',
      'Em análise': 'hourglass_top',
      'Fonte confiável': 'shield',
    }[e];
  }

  protected linkValido(): boolean {
    return !!linkSeguro(this.link.trim());
  }

  /** A API exige de 5 a 1000 letras na afirmação. */
  protected readonly minimo = 5;
  protected textoCurto(): boolean {
    const t = this.afirmacao.trim();
    return t.length > 0 && t.length < this.minimo;
  }

  protected podeEnviar(): boolean {
    const link = this.link.trim();
    if (link && !this.linkValido()) return false;
    return this.afirmacao.trim().length >= this.minimo;
  }

  /** Etapas que NÃO aconteceram (texto do motivo), para nunca mostrar "Análise com IA concluída" sem IA. */
  protected readonly puladas = signal<(string | null)[]>([]);

  protected adicionar(lista: FileList | null) {
    if (!lista) return;
    const novos: Anexo[] = [];
    for (const arquivo of Array.from(lista)) {
      if (this.anexos().length + novos.length >= MAX_ANEXOS) {
        this.avisos.mostrar(`Você pode anexar até ${MAX_ANEXOS} arquivos.`, 'erro');
        break;
      }
      const tipo = tipoDe(arquivo);
      if (!tipo) {
        this.avisos.mostrar(`"${arquivo.name}" não é um formato aceito.`, 'erro');
        continue;
      }
      if (arquivo.size > LIMITE[tipo]) {
        this.avisos.mostrar(`"${arquivo.name}" passa do limite de ${LIMITE[tipo] / MB} MB.`, 'erro');
        continue;
      }
      novos.push({ arquivo, tipo, previa: tipo === 'documento' ? null : URL.createObjectURL(arquivo) });
    }
    if (novos.length) {
      this.anexos.update((l) => [...l, ...novos]);
      // Animação curta do FatoBot "carregando" o arquivo
      this.recebendo.set({ id: Date.now(), nomes: novos.map((n) => n.arquivo.name) });
    }
  }

  /** Arquivo(s) chegando: mostra a faixa do FatoBot carregando. */
  protected readonly recebendo = signal<{ id: number; nomes: string[] } | null>(null);
  protected aoCarregar(id: number) {
    setTimeout(() => { if (this.recebendo()?.id === id) this.recebendo.set(null); }, 1800);
  }

  protected remover(i: number) {
    const a = this.anexos()[i];
    if (a?.previa) URL.revokeObjectURL(a.previa);
    this.anexos.update((l) => l.filter((_, j) => j !== i));
  }

  protected tamanho(bytes: number): string {
    return bytes >= MB ? `${(bytes / MB).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  ngOnDestroy() {
    clearInterval(this.relogioFato);
    for (const a of this.anexos()) if (a.previa) URL.revokeObjectURL(a.previa);
  }

  protected async verificar() {
    if (!this.podeEnviar()) return;
    const afirmacao = this.afirmacao.trim();
    const link = this.link.trim() ? linkSeguro(this.link.trim()) : null;
    const anexos = this.anexos();
    this.verificando.set(true);
    this.etapa.set(0);
    this.puladas.set([]);
    const passo = 1100;
    // Enquanto espera a resposta, só "Recebida" pode ficar pronta: o resto depende do que a API fizer de verdade
    const relogio = setInterval(() => this.etapa.update((e) => Math.min(e + 1, 1)), passo);
    this.mostrarFatos();
    try {
      const [resultado] = await Promise.all([
        this.bot.verificar({ afirmacao, link, anexos: anexos.map((a) => a.arquivo) }),
        new Promise((ok) => setTimeout(ok, passo * 2)),
      ]);
      clearInterval(relogio);
      if (resultado.demonstracao) {
        const motivo = 'Não feita (modo demonstração)';
        this.puladas.set([null, motivo, motivo, motivo, motivo]);
      } else {
        // Sem IA a API devolve "Em análise"; sem fonte relacionada, "Evidência insuficiente": nos dois casos a IA não classificou
        const semIa = resultado.estado === 'Em análise' || resultado.estado === 'Evidência insuficiente';
        this.puladas.set([null, null, semIa ? 'Sem análise de IA nesta checagem' : null, semIa ? 'Sem conferência automática' : null, null]);
      }
      this.etapa.set(this.etapas.length);
      this.checagens.registrar({
        afirmacao: afirmacao || link || anexos.map((a) => a.arquivo.name).join(', '), estado: resultado.estado,
        resumo: resultado.explicacao.slice(0, 160), fonte: resultado.fontes[0] ? { titulo: resultado.fontes[0].titulo, url: resultado.fontes[0].url } : null,
        criado_em: resultado.consultado_em,
      });
      this.historico.update((h) => [
        { afirmacao, link, anexos: anexos.map((a) => ({ nome: a.arquivo.name, tipo: a.tipo, tamanho: this.tamanho(a.arquivo.size) })), resultado },
        ...h,
      ]);
      this.afirmacao = '';
      this.link = '';
      for (const a of anexos) if (a.previa) URL.revokeObjectURL(a.previa);
      this.anexos.set([]);
    } catch (e) {
      this.etapa.set(0);
      this.avisos.erro(e);
    } finally {
      clearInterval(relogio);
      clearInterval(this.relogioFato);
      this.verificando.set(false);
    }
  }
}

function tipoDe(arquivo: File): TipoAnexo | null {
  if (/^image\/(jpeg|png|webp|gif)$/.test(arquivo.type)) return 'imagem';
  if (/^video\/(mp4|webm|quicktime)$/.test(arquivo.type)) return 'video';
  if (DOCUMENTOS.includes(arquivo.type) || /\.(pdf|docx?|txt)$/i.test(arquivo.name)) return 'documento';
  return null;
}
