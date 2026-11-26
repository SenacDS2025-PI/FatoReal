import { DatePipe } from '@angular/common';
import { Component, HostListener, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { rotaPolitico } from '../../core/politicos.service';
import { AuthService } from '../../core/auth.service';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Autor, Comunidade, PerfilPublico, Publicacao } from '../../core/modelos';
import { CAPAS, PerfisService } from '../../core/perfis.service';
import { avatarComunidade, COR_TEMA, ICONE_TEMA } from '../../core/visual';
import { Avatar, Icone } from '../../shared/componentes';
import { RedesSociais, REDES, linkDaRede } from '../../shared/redes-sociais';
import { FormsModule } from '@angular/forms';
import { imagemSegura, linkSeguro } from '../../core/util';
import { PublicacaoCard } from '../../shared/publicacao-card';
import { Favoritar } from '../../shared/favoritar';
import { Favorito, FavoritosService, TipoFavorito } from '../../core/favoritos.service';

type Aba = 'publicacoes' | 'curtidas' | 'salvos';
type Filtro = 'todas' | 'verificadas' | 'usuario';

interface Conquista {
  titulo: string;
  icone: string;
  requisito: string;
  ok: boolean;
}

/** Perfil no estilo Orkut + LinkedIn (mesma estrutura do perfil dos políticos). Serve para "/perfil" (o meu) e "/pessoas/:id" (de outra pessoa). */
@Component({
  selector: 'app-perfil',
  imports: [RouterLink, DatePipe, FormsModule, Avatar, Icone, PublicacaoCard, RedesSociais, Favoritar],
  templateUrl: './perfil.html',
})
export class PerfilPage {
  protected auth = inject(AuthService);
  private perfis = inject(PerfisService);
  private comunidadesService = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private rota = inject(ActivatedRoute);

  /** Vem da URL /pessoas/:id. Vazio em /perfil. */
  readonly id = input<string>();

  protected readonly perfil = signal<PerfilPublico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly aba = signal<Aba>('publicacoes');
  protected readonly favoritos = inject(FavoritosService);
  protected readonly iconeSalvo: Record<TipoFavorito, string> = { politico: 'account_balance', projeto: 'description', noticia: 'newspaper', publicacao: 'dynamic_feed', comunidade: 'groups' };
  protected readonly nomeSalvo: Record<TipoFavorito, string> = { politico: 'Político', projeto: 'Projeto', noticia: 'Notícia', publicacao: 'Publicação', comunidade: 'Comunidade' };
  /** Rota interna do item salvo (político e comunidade abrem dentro do site). */
  protected rotaSalvo(f: Favorito): (string | number)[] | null {
    if (f.tipo === 'politico') {
      // Favoritos salvos como "tse-<id>" e "senado-<id>" (formato antigo, mantido); o resto é deputado
      if (f.ref_id.startsWith('tse-')) return rotaPolitico({ id: f.ref_id.slice(4), casa: 'tse' });
      return f.ref_id.startsWith('senado-') ? rotaPolitico({ id: f.ref_id.slice(7), casa: 'senado' }) : rotaPolitico({ id: f.ref_id });
    }
    if (f.tipo === 'comunidade') return ['/comunidades', f.ref_id];
    return null;
  }
  protected readonly publicacoes = signal<Publicacao[]>([]);
  protected readonly curtidas = signal<Publicacao[]>([]);
  protected readonly comunidades = signal<Comunidade[]>([]);
  protected readonly seguidores = signal<Autor[]>([]);
  protected readonly seguindo = signal<Autor[]>([]);
  protected readonly sugestoes = signal<Autor[]>([]);
  protected readonly lista = signal<'seguidores' | 'seguindo' | null>(null);
  protected readonly ocupado = signal(false);

  protected readonly corTema = COR_TEMA;
  protected readonly iconeTema = ICONE_TEMA;
  protected readonly avatarComunidade = avatarComunidade;

  protected readonly ehMeu = computed(() => {
    const eu = this.auth.usuario();
    return !!eu && (!this.id() || this.id() === eu.id);
  });
  protected readonly euSigo = computed(() => this.seguidores().some((p) => p.id === this.auth.usuario()?.id));
  protected readonly capa = computed(() => CAPAS[this.perfil()?.capa ?? ''] ?? CAPAS['verde']);
  protected readonly curtidasRecebidas = computed(() => this.publicacoes().reduce((t, p) => t + p.total_curtidas, 0));
  protected readonly primeiroNome = computed(() => (this.perfil()?.nome ?? '').split(' ')[0]);

  protected readonly conquistas = computed<Conquista[]>(() => {
    const pubs = this.publicacoes().length;
    const lista: Conquista[] = [
      { titulo: 'Primeira publicação', icone: 'edit', requisito: 'Publicar em uma comunidade', ok: pubs >= 1 },
      { titulo: 'Voz ativa', icone: 'campaign', requisito: 'Fazer 5 publicações', ok: pubs >= 5 },
      { titulo: 'Bem recebido', icone: 'thumb_up', requisito: 'Receber 5 curtidas', ok: this.curtidasRecebidas() >= 5 },
      { titulo: 'Participativo', icone: 'groups', requisito: 'Participar de 3 comunidades', ok: this.comunidades().length >= 3 },
      { titulo: 'Conectado', icone: 'person_add', requisito: 'Seguir 3 pessoas', ok: this.seguindo().length >= 3 },
    ];
    if (this.perfil()?.moderador) lista.unshift({ titulo: 'Moderação', icone: 'shield_person', requisito: 'Ser moderador(a)', ok: true });
    if (this.ehMeu()) {
      let total = 0;
      try {
        total = JSON.parse(localStorage.getItem('fatoreal-fato-ou-fake') ?? '{}').total ?? 0;
      } catch {
        /* sem armazenamento */
      }
      lista.push({ titulo: 'Caçador de fake news', icone: 'policy', requisito: 'Acertar 5 no modo desafio do Fato ou Fake', ok: total >= 5 });
    }
    return lista;
  });
  protected readonly conquistasFeitas = computed(() => this.conquistas().filter((c) => c.ok).length);

  // ---------- Cabeçalho ----------
  protected readonly capaImagem = computed(() => imagemSegura(this.perfil()?.capa_url ?? null));
  protected readonly nivel = computed(() => {
    const n = this.conquistasFeitas();
    return n >= 5 ? 'Referência' : n >= 3 ? 'Engajado(a)' : n >= 1 ? 'Participante' : 'Iniciante';
  });
  protected readonly verificadas = computed(() => this.publicacoes().filter((p) => p.verificada).length);
  protected readonly temRedes = computed(() => REDES.some((r) => !!linkDaRede(r.chave, this.perfil()?.redes?.[r.chave])));
  /** Amigos no estilo Orkut: quem segue e é seguido, depois os demais. */
  protected readonly amigos = computed(() => {
    const vistos = new Set<string>();
    const mutuos = this.seguidores().filter((s) => this.seguindo().some((x) => x.id === s.id));
    return [...mutuos, ...this.seguindo(), ...this.seguidores()].filter((a) => !vistos.has(a.id) && !!vistos.add(a.id));
  });

  // ---------- "Perfil pronto para as comunidades" ----------
  protected readonly passos = computed(() => {
    const p = this.perfil();
    return [
      { nome: 'Foto de perfil', ok: !!p?.foto_url },
      { nome: 'Capa', ok: !!p?.capa_url || (!!p?.capa && p.capa !== 'verde') },
      { nome: 'Bio', ok: !!p?.bio },
      { nome: 'Cidade e estado', ok: !!p?.cidade && !!p?.uf },
      { nome: 'Profissão', ok: !!p?.profissao },
      { nome: 'Interesses', ok: (p?.interesses?.length ?? 0) > 0 },
      { nome: 'Uma rede social', ok: this.temRedes() },
    ];
  });
  protected readonly completo = computed(() => Math.round((this.passos().filter((x) => x.ok).length / this.passos().length) * 100));

  // ---------- Feed ----------
  protected readonly filtro = signal<Filtro>('todas');
  protected readonly feed = computed(() => {
    const f = this.filtro();
    return this.publicacoes().filter((p) => f === 'todas' || (f === 'verificadas' ? p.verificada : !p.verificada));
  });
  protected readonly minhas = signal<Comunidade[]>([]);
  protected novoTexto = '';
  protected novoLink = '';
  protected comunidadeEscolhida = '';
  protected readonly publicando = signal(false);

  protected async publicar() {
    const texto = this.novoTexto.trim();
    const id = Number(this.comunidadeEscolhida);
    if (!texto || !id) return;
    const link = this.novoLink.trim() ? linkSeguro(this.novoLink) : null;
    if (this.novoLink.trim() && !link) return this.avisos.mostrar('O link precisa começar com https://', 'erro');
    this.publicando.set(true);
    try {
      await this.comunidadesService.publicar(id, texto, link);
      this.novoTexto = this.novoLink = '';
      this.avisos.mostrar('Publicado!');
      this.recarregar();
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.publicando.set(false);
    }
  }

  constructor() {
    // Recarrega quando muda a pessoa (URL) ou quando a conta entra/sai
    effect(() => {
      const id = this.id();
      const eu = this.auth.usuario()?.id;
      untracked(() => this.carregar(id || eu));
    });
  }

  private async carregar(id?: string) {
    this.lista.set(null);
    if (!id) {
      this.perfil.set(null);
      this.carregando.set(false);
      return;
    }
    this.carregando.set(true);
    if (!this.ehMeu() && this.aba() !== 'publicacoes') this.aba.set('publicacoes');
    try {
      this.perfil.set(await this.perfis.obter(id));
    } catch (e) {
      this.avisos.erro(e);
      this.perfil.set(null);
    }
    const meu = this.ehMeu();
    const [pubs, curtidas, comunidades, seguidores, seguindo, sugestoes] = await Promise.allSettled([
      this.comunidadesService.publicacoesDe(id),
      meu ? this.comunidadesService.curtidasDe(id) : Promise.resolve([]),
      this.comunidadesService.comunidadesDe(id),
      this.perfis.seguidores(id),
      this.perfis.seguindo(id),
      meu ? this.perfis.sugestoes(3) : Promise.resolve([]),
    ]);
    const valor = <T>(r: PromiseSettledResult<T>, padrao: T) => (r.status === 'fulfilled' ? r.value : padrao);
    this.publicacoes.set(valor(pubs, []));
    this.curtidas.set(valor(curtidas, []));
    this.comunidades.set(valor(comunidades, []));
    this.seguidores.set(valor(seguidores, []));
    this.seguindo.set(valor(seguindo, []));
    this.sugestoes.set(valor(sugestoes, []));
    if (meu) {
      this.rota.fragment.subscribe((f) => {
        if (f === 'publicar') setTimeout(() => { const t = document.getElementById('pp-texto'); t?.scrollIntoView({ block: 'center' }); t?.focus(); }, 300);
      });
      const minhas = await this.comunidadesService.minhas().catch(() => []);
      this.minhas.set(minhas);
      if (!this.comunidadeEscolhida && minhas[0]) this.comunidadeEscolhida = String(minhas[0].id);
    }
    this.carregando.set(false);
  }

  protected recarregar() {
    this.carregar(this.perfil()?.id);
  }

  protected async alternarSeguir() {
    const p = this.perfil();
    if (!p) return;
    this.ocupado.set(true);
    try {
      if (this.euSigo()) await this.perfis.deixarDeSeguir(p.id);
      else await this.perfis.seguir(p.id);
      this.seguidores.set(await this.perfis.seguidores(p.id));
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Seguir alguém da lista de sugestões, direto do meu perfil. */
  protected async seguirSugestao(pessoa: Autor) {
    try {
      await this.perfis.seguir(pessoa.id);
      this.sugestoes.update((l) => l.filter((x) => x.id !== pessoa.id));
      this.seguindo.update((l) => [...l, pessoa]);
      this.avisos.mostrar(`Você agora segue ${pessoa.nome}.`);
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  @HostListener('document:keydown.escape')
  protected fecharLista() {
    this.lista.set(null);
  }
}
