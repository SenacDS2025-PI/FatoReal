import { DatePipe } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Comunidade, Publicacao } from '../../core/modelos';
import { imagemSegura, linkSeguro } from '../../core/util';
import { avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone } from '../../shared/componentes';
import { PublicacaoCard } from '../../shared/publicacao-card';

type Aba = 'publicacoes' | 'curtidas' | 'comunidades' | 'conta';

/** Perfil no estilo de rede social: capa, foto, bio, números e abas com a atividade da pessoa. */
@Component({
  selector: 'app-perfil',
  imports: [FormsModule, RouterLink, DatePipe, Avatar, Icone, PublicacaoCard],
  templateUrl: './perfil.html',
})
export class PerfilPage implements OnInit {
  protected auth = inject(AuthService);
  private comunidades = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);

  protected readonly aba = signal<Aba>('publicacoes');
  protected readonly minhas = signal<Comunidade[]>([]);
  protected readonly publicacoes = signal<Publicacao[]>([]);
  protected readonly curtidas = signal<Publicacao[]>([]);
  protected readonly carregando = signal(true);
  protected readonly confirmando = signal(false);
  protected readonly editando = signal(false);
  protected readonly salvando = signal(false);

  protected readonly corTema = COR_TEMA;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly avatarComunidade = avatarComunidade;
  protected readonly curtidasRecebidas = computed(() => this.publicacoes().reduce((t, p) => t + p.total_curtidas, 0));

  // Formulário da janela "Editar perfil"
  protected nome = '';
  protected foto = '';
  protected bio = '';
  protected readonly previa = signal<string | null>(null);

  async ngOnInit() {
    await this.carregar();
  }

  private async carregar() {
    const u = this.auth.usuario();
    if (!u) return;
    this.carregando.set(true);
    const [minhas, pubs, curtidas] = await Promise.allSettled([
      this.comunidades.minhas(),
      this.comunidades.publicacoesDe(u.id),
      this.comunidades.curtidasDe(u.id),
    ]);
    this.minhas.set(minhas.status === 'fulfilled' ? minhas.value : []);
    this.publicacoes.set(pubs.status === 'fulfilled' ? pubs.value : []);
    this.curtidas.set(curtidas.status === 'fulfilled' ? curtidas.value : []);
    this.carregando.set(false);
  }

  protected recarregar() {
    this.carregar();
  }

  protected abrirEdicao() {
    const u = this.auth.usuario();
    this.nome = u?.nome ?? '';
    this.foto = u?.foto_url ?? '';
    this.bio = u?.bio ?? '';
    this.atualizarPrevia();
    this.editando.set(true);
  }

  @HostListener('document:keydown.escape')
  protected fecharEdicao() {
    this.editando.set(false);
  }

  protected atualizarPrevia() {
    this.previa.set(imagemSegura(this.foto.trim()) ? this.foto.trim() : null);
  }

  protected async salvar() {
    const foto = this.foto.trim() ? linkSeguro(this.foto) : null;
    if (this.foto.trim() && !foto) {
      this.avisos.mostrar('O link da foto precisa começar com https://', 'erro');
      return;
    }
    this.salvando.set(true);
    try {
      await this.auth.atualizarPerfil({ nome: this.nome.trim(), foto_url: foto, bio: this.bio.trim() || null });
      this.avisos.mostrar('Perfil atualizado!');
      this.editando.set(false);
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
