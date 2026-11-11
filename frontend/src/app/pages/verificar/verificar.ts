import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AvisosService } from '../../core/avisos.service';
import { EstadoVerificacao, FatoBotService, ResultadoVerificacao } from '../../core/fatobot.service';
import { linkSeguro } from '../../core/util';
import { AvisoIa, FonteDado, Icone } from '../../shared/componentes';

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
  imports: [FormsModule, DatePipe, Icone, FonteDado, AvisoIa],
  template: `
    <header class="cabecalho-pagina">
      <h1><app-icone nome="fact_check" /> Verificar informação</h1>
      <p>Recebeu uma afirmação, um link, um print, um vídeo ou um documento sobre política? Envie aqui antes de compartilhar. A resposta é uma avaliação preliminar, baseada só nas fontes consultadas.</p>
    </header>

    <div class="layout-comunidade">
      <div class="coluna-central">
        <form class="card form-verificar" (submit)="$event.preventDefault(); verificar()">
          <div class="campo-form">
            <label for="afirmacao">O que você quer verificar?</label>
            <textarea id="afirmacao" name="afirmacao" [(ngModel)]="afirmacao" rows="4" maxlength="1000"
              placeholder="Ex.: A Câmara dos Deputados tem 513 deputados."></textarea>
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
              <strong>Arraste aqui ou clique para escolher</strong>
              <span class="zona-anexo-tipos">
                <span><app-icone nome="image" /> Fotos e prints</span>
                <span><app-icone nome="movie" /> Vídeos</span>
                <span><app-icone nome="description" /> Documentos</span>
              </span>
              <small>JPG, PNG, WEBP ou GIF até 10 MB · MP4, WEBM ou MOV até 50 MB · PDF, DOC, DOCX ou TXT até 10 MB</small>
            </label>
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

        @for (it of historico(); track $index) {
          <article class="card resultado-verificacao">
            @if (it.afirmacao) { <blockquote>“{{ it.afirmacao }}”</blockquote> }
            @if (it.link) { <a class="resultado-link" [href]="it.link" target="_blank" rel="noopener noreferrer nofollow"><app-icone nome="link" /> {{ it.link }}</a> }
            @if (it.anexos.length) {
              <ul class="resultado-anexos">
                @for (a of it.anexos; track $index) { <li><app-icone [nome]="iconeTipo[a.tipo]" /> {{ a.nome }} <small>({{ a.tamanho }})</small></li> }
              </ul>
            }
            <span class="estado" [attr.data-estado]="it.resultado.estado">
              <app-icone [nome]="icone(it.resultado.estado)" /> {{ it.resultado.estado }}
            </span>
            <p>{{ it.resultado.explicacao }}</p>
            @for (f of it.resultado.fontes; track f.url) { <app-fonte [fonte]="f" rotulo="data" /> }
            <small class="texto-suave">Consultado em {{ it.resultado.consultado_em | date: 'dd/MM/yyyy HH:mm' }}</small>
            <app-aviso-ia />
          </article>
        }
      </div>

      <aside class="coluna-direita">
        <section class="card bloco">
          <h2><app-icone nome="rule" /> O que cada resultado quer dizer</h2>
          <dl class="estados">
            @for (e of estados; track e[0]) {
              <div><dt><span class="estado" [attr.data-estado]="e[0]"><app-icone [nome]="icone(e[0])" /> {{ e[0] }}</span></dt><dd>{{ e[1] }}</dd></div>
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
  protected afirmacao = '';
  protected link = '';
  protected readonly anexos = signal<Anexo[]>([]);
  protected readonly arrastando = signal(false);
  protected readonly maxAnexos = MAX_ANEXOS;
  protected readonly aceitos = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.txt';
  protected readonly rotuloTipo: Record<TipoAnexo, string> = { imagem: 'Foto', video: 'Vídeo', documento: 'Documento' };
  protected readonly iconeTipo: Record<TipoAnexo, string> = { imagem: 'image', video: 'movie', documento: 'description' };
  protected readonly verificando = signal(false);
  protected readonly historico = signal<Item[]>([]);
  protected readonly estados: [EstadoVerificacao, string][] = [
    ['Evidências sustentam', 'Fontes primárias ou confiáveis confirmam o essencial da afirmação.'],
    ['Evidências contradizem', 'Fontes primárias ou confiáveis mostram que a afirmação é incorreta.'],
    ['Fora de contexto', 'Há base nos fatos, mas data, local ou sentido foram alterados ou omitidos.'],
    ['Evidência insuficiente', 'Não há fontes suficientes para confirmar nem para negar. Ausência de evidência não é prova de falsidade.'],
    ['Em análise', 'Recebida; aguardando busca de fontes ou revisão humana.'],
  ];

  protected icone(e: EstadoVerificacao): string {
    return {
      'Evidências sustentam': 'check_circle',
      'Evidências contradizem': 'cancel',
      'Fora de contexto': 'error',
      'Evidência insuficiente': 'help',
      'Em análise': 'hourglass_top',
    }[e];
  }

  protected linkValido(): boolean {
    return !!linkSeguro(this.link.trim());
  }

  protected podeEnviar(): boolean {
    const link = this.link.trim();
    if (link && !this.linkValido()) return false;
    return !!(this.afirmacao.trim() || link || this.anexos().length);
  }

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
    if (novos.length) this.anexos.update((l) => [...l, ...novos]);
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
    for (const a of this.anexos()) if (a.previa) URL.revokeObjectURL(a.previa);
  }

  protected async verificar() {
    if (!this.podeEnviar()) return;
    const afirmacao = this.afirmacao.trim();
    const link = this.link.trim() ? linkSeguro(this.link.trim()) : null;
    const anexos = this.anexos();
    this.verificando.set(true);
    try {
      const resultado = await this.bot.verificar({ afirmacao, link, anexos: anexos.map((a) => a.arquivo) });
      this.historico.update((h) => [
        { afirmacao, link, anexos: anexos.map((a) => ({ nome: a.arquivo.name, tipo: a.tipo, tamanho: this.tamanho(a.arquivo.size) })), resultado },
        ...h,
      ]);
      this.afirmacao = '';
      this.link = '';
      for (const a of anexos) if (a.previa) URL.revokeObjectURL(a.previa);
      this.anexos.set([]);
    } catch (e) {
      this.avisos.erro(e);
    } finally {
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
