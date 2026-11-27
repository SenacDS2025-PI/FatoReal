import { CaixaPublicar } from '../../shared/caixa-publicar';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Autor, Comunidade, Publicacao } from '../../core/modelos';
import { linkSeguro } from '../../core/util';
import { avatarComunidade, capaComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone } from '../../shared/componentes';
import { PublicacaoCard } from '../../shared/publicacao-card';
import { PluralPipe } from '../../shared/plural';

@Component({
  selector: 'app-comunidade',
  imports: [PluralPipe, CaixaPublicar, FormsModule, RouterLink, Avatar, Icone, PublicacaoCard],
  templateUrl: './comunidade.html',
})
export class ComunidadePage implements OnInit {
  private service = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);
  protected auth = inject(AuthService);
  protected readonly avatarComunidade = avatarComunidade;
  protected readonly capaComunidade = capaComunidade;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly corTema = COR_TEMA;

  /** Vem da URL /comunidades/:slug */
  readonly slug = input.required<string>();

  protected readonly comunidade = signal<Comunidade | null>(null);
  protected readonly carregando = signal(true);
  protected readonly membro = signal(false);
  protected readonly membros = signal<(Autor & { papel: string })[]>([]);
  protected readonly mural = signal<Publicacao[]>([]);
  protected readonly aba = signal<'mural' | 'regras' | 'membros'>('mural');
  protected readonly erroMural = signal(false);
  protected readonly entrando = signal(false);

  protected trackIndice = (i: number) => i;

  async ngOnInit() {
    try {
      const c = await this.service.obter(this.slug());
      this.comunidade.set(c);
      if (c) await this.recarregar();
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.carregando.set(false);
    }
  }

  protected async recarregar() {
    const c = this.comunidade();
    if (!c) return;
    // Cada parte carrega sozinha: se o mural falhar, a página ainda sabe que a pessoa participa
    const [membro, membros, mural, atual] = await Promise.allSettled([
      this.service.ehMembro(c.id),
      this.service.membros(c.id),
      this.service.publicacoes(c.id),
      this.service.obter(c.slug),
    ]);
    if (membro.status === 'fulfilled') this.membro.set(membro.value);
    if (membros.status === 'fulfilled') this.membros.set(membros.value);
    this.erroMural.set(mural.status === 'rejected');
    if (mural.status === 'fulfilled') this.mural.set(mural.value);
    if (atual.status === 'fulfilled' && atual.value) this.comunidade.set(atual.value);
  }

  protected async alternarMembro() {
    const c = this.comunidade();
    if (!c) return;
    if (!this.auth.logado()) {
      this.router.navigate(['/entrar'], { queryParams: { voltar: this.router.url } });
      return;
    }
    if (this.entrando()) return; // evita clique duplo
    this.entrando.set(true);
    try {
      if (this.membro()) {
        await this.service.sair(c.id);
        this.membro.set(false);
        this.avisos.mostrar('Você saiu da comunidade.');
      } else {
        const novo = await this.service.entrar(c.id);
        this.membro.set(true);
        this.avisos.mostrar(novo ? `Bem-vindo(a) à ${c.nome}!` : `Você já participa de ${c.nome}.`);
      }
      await this.recarregar();
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.entrando.set(false);
    }
  }

  protected async aoPublicar() {
    const c = this.comunidade();
    if (c) this.mural.set(await this.service.publicacoes(c.id));
  }
}
