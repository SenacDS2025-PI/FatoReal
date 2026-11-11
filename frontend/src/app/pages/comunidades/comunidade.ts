import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Autor, Comunidade, Publicacao } from '../../core/modelos';
import { linkSeguro } from '../../core/util';
import { avatarComunidade, capaComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone, PluralPipe } from '../../shared/componentes';
import { PublicacaoCard } from '../../shared/publicacao-card';

@Component({
  selector: 'app-comunidade',
  imports: [FormsModule, RouterLink, Avatar, Icone, PublicacaoCard, PluralPipe],
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

  protected novoTexto = '';
  protected novoLink = '';
  protected mostrarLink = false;

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
    const [membro, membros, mural, atual] = await Promise.all([
      this.service.ehMembro(c.id),
      this.service.membros(c.id),
      this.service.publicacoes(c.id),
      this.service.obter(c.slug),
    ]);
    this.membro.set(membro);
    this.membros.set(membros);
    this.mural.set(mural);
    if (atual) this.comunidade.set(atual);
  }

  protected async alternarMembro() {
    const c = this.comunidade();
    if (!c) return;
    if (!this.auth.logado()) {
      this.router.navigate(['/entrar'], { queryParams: { voltar: this.router.url } });
      return;
    }
    try {
      if (this.membro()) {
        await this.service.sair(c.id);
        this.avisos.mostrar('Você saiu da comunidade.');
      } else {
        await this.service.entrar(c.id);
        this.avisos.mostrar(`Bem-vindo(a) à ${c.nome}!`);
      }
      await this.recarregar();
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  protected async publicar() {
    const c = this.comunidade();
    const texto = this.novoTexto.trim();
    if (!c || !texto) return;
    const link = this.novoLink.trim() ? linkSeguro(this.novoLink) : null;
    if (this.novoLink.trim() && !link) {
      this.avisos.mostrar('O link precisa começar com http:// ou https://', 'erro');
      return;
    }
    try {
      await this.service.publicar(c.id, texto, link);
      this.novoTexto = this.novoLink = '';
      this.mostrarLink = false;
      this.avisos.mostrar('Publicado no mural!');
      this.mural.set(await this.service.publicacoes(c.id));
    } catch (e) {
      this.avisos.erro(e);
    }
  }
}
