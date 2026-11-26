import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import {
  CARGOS, CARGOS_MUNICIPAIS, PRECISA_CIDADE, chaveAlerta, cidadesDoEstado, contagemAlertas, letraDe, normalizarCidade,
  politicosDoLocal, rotaPolitico, todosDoCargo, totalDoCargo,
} from '../../core/politicos.service';
import { verificadosDe } from '../../core/registros-verificados';
import { modoDemo } from '../../core/supabase';
import { UFS } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';
import { nomeEstado } from '../../shared/mapa-brasil';
import { MapaEstados } from '../../shared/mapa-estados';
import { NavPoliticos } from '../../shared/nav-politicos';
import { AuthService } from '../../core/auth.service';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const POR_VEZ = 48;

/** Políticos: todos os representantes de cada cargo, em ordem alfabética, com busca, filtros e cartões por cargo. */
@Component({
  selector: 'app-busca',
  imports: [FormsModule, RouterLink, Icone, Avatar, MapaEstados, NavPoliticos],
  templateUrl: './busca.html',
})
export class BuscaPage implements OnInit {
  private rota = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private auth = inject(AuthService);

  // ---------- Cargos: 4 cartões grandes + "outros cargos" ----------
  protected readonly cargosPrincipais = [
    { nome: 'Presidente', rotulo: 'Presidente', icone: 'flag', cor: '#e11d48' },
    { nome: 'Senador(a)', rotulo: 'Senadores', icone: 'gavel', cor: '#3b82f6' },
    { nome: 'Deputado(a) Federal', rotulo: 'Deputados federais', icone: 'account_balance', cor: '#22c55e' },
    { nome: 'Governador(a)', rotulo: 'Governadores', icone: 'location_city', cor: '#a855f7' },
  ];
  protected readonly cargosOutros = [
    { nome: 'Deputado(a) Estadual', rotulo: 'Deputados estaduais', icone: 'apartment' },
    { nome: 'Prefeito(a)', rotulo: 'Prefeitos', icone: 'holiday_village' },
    { nome: 'Vereador(a)', rotulo: 'Vereadores', icone: 'groups' },
    { nome: 'Vice-presidente', rotulo: 'Vice-presidente', icone: 'flag' },
    { nome: 'Vice-governador(a)', rotulo: 'Vice-governadores', icone: 'location_city' },
    { nome: 'Vice-prefeito(a)', rotulo: 'Vice-prefeitos', icone: 'holiday_village' },
  ];
  protected readonly explorar = [
    { titulo: 'Congresso em ação', texto: 'Agenda, votações e leis', icone: 'account_balance', rota: '/congresso', imagem: 'img/destaque-congresso.svg' },
    { titulo: 'Ranking de gastos', texto: 'Mapa da cota por estado', icone: 'payments', rota: '/politicos/gastos', imagem: 'img/capa-contas-publicas.svg' },
    { titulo: 'Presença', texto: 'Quem vai às votações', icone: 'how_to_vote', rota: '/politicos/ranking', imagem: 'img/capa-camara-e-senado-em-pauta.svg' },
    { titulo: 'Eleições', texto: 'Contagem, como votar e comparar', icone: 'ballot', rota: '/eleicoes', imagem: 'img/capa-eleicoes-e-voto.svg' },
  ];
  /** Cor do anel da foto: sempre a mesma para o mesmo partido (só enfeite, não indica nada). */
  protected corPartido(sigla: string | null | undefined): string {
    const cores = ['#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#6366f1'];
    let h = 0;
    for (const ch of sigla ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return cores[h % cores.length];
  }
  /** Quantos nomes cada cargo tem (só os que já têm fonte de dados). */
  protected readonly totais = signal<Record<string, number>>({});
  protected temDados(cargo: string) {
    return !this.demo || !!CARGOS.find((c) => c.nome === cargo)?.fonte;
  }
  protected rotuloCargo = computed(() => [...this.cargosPrincipais, ...this.cargosOutros].find((c) => c.nome === this.cargo())?.rotulo ?? this.cargo());

  // ---------- Busca com sugestões e painel de filtros ----------
  protected readonly filtrosAbertos = signal(false);
  protected readonly focoBusca = signal(false);
  protected readonly ordem = signal<'az' | 'za' | 'partido' | 'estado'>('az');
  protected readonly sugestoes = computed(() => (normalizar(this.termo()).length >= 2 ? this.filtrados().slice(0, 5) : []));
  protected readonly partidosPopulares = computed(() => {
    const m = new Map<string, number>();
    for (const p of this.todos()) if (p.partido) m.set(p.partido, (m.get(p.partido) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s);
  });
  protected readonly meuEstado = computed(() => {
    const doPerfil = this.auth.usuario()?.uf;
    if (doPerfil) return doPerfil;
    try {
      return localStorage.getItem('fatoreal-uf') ?? '';
    } catch {
      return '';
    }
  });
  protected readonly qtdFiltros = computed(() => [this.uf(), this.partido(), this.ordem() !== 'az' ? 'o' : ''].filter(Boolean).length);
  protected fecharSugestoesDepois() {
    setTimeout(() => this.focoBusca.set(false), 150);
  }
  protected ordenar(o: 'az' | 'za' | 'partido' | 'estado') {
    this.ordem.set(o);
    this.letra.set('');
    this.mudouFiltro();
  }

  protected readonly cargos = CARGOS;
  protected readonly letras = LETRAS;
  protected readonly ufs = UFS;
  protected readonly demo = modoDemo;

  protected readonly cargo = signal(CARGOS[0].nome);
  protected readonly letra = signal('');
  protected readonly termo = signal('');
  protected readonly partido = signal('');
  protected readonly uf = signal('');
  protected readonly todos = signal<Politico[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  protected readonly limite = signal(POR_VEZ);
  protected readonly visao = signal<'lista' | 'mapa'>('lista');
  protected readonly nomeEstado = nomeEstado;
  /** Quantas pessoas do cargo atual há em cada estado (para o mapa). */
  /** Texto do balão do mapa: quantos nomes do cargo cada estado tem. */
  protected readonly textosMapa = computed(() => {
    const rot = this.rotuloCargo().toLowerCase();
    return Object.fromEntries(Object.entries(this.porEstado()).map(([u, n]) => [u, `${n} ${rot}`]));
  });
  protected readonly porEstado = computed(() => {
    const mapa: Record<string, number> = {};
    for (const p of this.todos()) if (p.uf) mapa[p.uf] = (mapa[p.uf] ?? 0) + 1;
    return mapa;
  });
  /** Partidos do estado selecionado no mapa, do maior para o menor. */
  protected readonly partidosDoEstado = computed(() => {
    const uf = this.uf();
    const mapa = new Map<string, number>();
    for (const p of this.todos()) if (p.uf === uf && p.partido) mapa.set(p.partido, (mapa.get(p.partido) ?? 0) + 1);
    return [...mapa].sort((a, b) => b[1] - a[1]);
  });
  protected readonly esqueletos = Array.from({ length: 6 });
  /** Quantos registros (polêmicas/Justiça) cada político tem: etiqueta vermelha no card. */
  protected readonly registros = signal<Record<string, number>>({});
  /** Total de registros do político: os cadastrados pela moderação + os verificados no código. */
  protected totalRegistros(p: Politico): number {
    return (this.registros()[chaveAlerta(p)] ?? 0) + verificadosDe(p).length;
  }

  /** Cargo sem fonte automática no modo demonstração (governador, presidente...). */
  protected readonly semFonte = computed(() => this.demo && !CARGOS.find((c) => c.nome === this.cargo())?.fonte);

  // ---------- Prefeitos, vices e vereadores: primeiro o estado, depois a cidade ----------
  protected readonly municipal = computed(() => CARGOS_MUNICIPAIS.includes(this.cargo()));
  protected readonly precisaCidade = computed(() => PRECISA_CIDADE.includes(this.cargo()));
  /** Cidade digitada/escolhida (texto como a pessoa vê, ex.: "São José dos Campos"). */
  protected readonly cidade = signal('');
  protected readonly cidades = signal<{ nome: string; busca: string }[]>([]);
  protected readonly carregandoCidades = signal(false);
  /** Ainda falta escolher o estado (ou a cidade, para vereador): a lista não é buscada. */
  protected readonly faltaLocal = computed(() => this.municipal() && (!this.uf() || (this.precisaCidade() && !normalizarCidade(this.cidade()))));
  /** O cargo não tem nenhum nome no banco (dados do TSE ainda não importados). */
  protected readonly semDadosCargo = computed(() => this.totais()[this.cargo()] === 0);
  private localCarregado = '';
  private ufDasCidades = '';

  /** "São José dos Campos/SP", "Brasil" (presidente) ou o nome do estado. */
  protected local(p: Politico): string {
    if (p.municipio) return `${p.municipio}/${p.uf}`;
    if (p.uf === 'BR') return 'Brasil';
    return p.uf ? nomeEstado(p.uf) : 'UF n/d';
  }
  /** "Eleito(a) em 2024 · TSE": o TSE mostra quem foi eleito, não quem está no cargo hoje. */
  protected eleicao(p: Politico): string {
    const ano = p.situacao?.match(/\d{4}/)?.[0];
    return ano ? `Eleito(a) em ${ano} · fonte: TSE` : 'Eleito(a) · fonte: TSE';
  }

  /** Lista depois dos filtros de nome, partido e estado (antes da letra). */
  private readonly filtrados = computed(() => {
    const t = normalizar(this.termo());
    const partido = this.partido();
    const uf = this.uf();
    return this.todos().filter(
      (p) => (!t || normalizar(p.nome).includes(t)) && (!partido || p.partido === partido) && (!uf || p.uf === uf),
    );
  });
  protected readonly contagemLetra = computed(() => {
    const mapa: Record<string, number> = {};
    for (const p of this.filtrados()) mapa[letraDe(p.nome)] = (mapa[letraDe(p.nome)] ?? 0) + 1;
    return mapa;
  });
  protected readonly resultados = computed(() => {
    const base = this.letra() ? this.filtrados().filter((p) => letraDe(p.nome) === this.letra()) : this.filtrados();
    const o = this.ordem();
    if (o === 'az') return base;
    const nome = (a: Politico, b: Politico) => a.nome.localeCompare(b.nome, 'pt-BR');
    const lista = [...base];
    if (o === 'za') return lista.sort((a, b) => -nome(a, b));
    if (o === 'partido') return lista.sort((a, b) => (a.partido ?? '').localeCompare(b.partido ?? '') || nome(a, b));
    return lista.sort((a, b) => (a.uf ?? '').localeCompare(b.uf ?? '') || nome(a, b));
  });
  protected readonly visiveis = computed(() => this.resultados().slice(0, this.limite()));
  /** Resultados agrupados por letra, para os títulos "A", "B"... */
  protected readonly grupos = computed(() => {
    const grupos: { letra: string; pessoas: Politico[] }[] = [];
    const o = this.ordem();
    for (const p of this.visiveis()) {
      const l = o === 'az' || o === 'za' ? 'todos' : o === 'partido' ? p.partido || 'Sem partido' : p.uf ? `${p.uf} · ${nomeEstado(p.uf)}` : 'Sem estado';
      if (grupos.at(-1)?.letra !== l) grupos.push({ letra: l, pessoas: [] });
      grupos.at(-1)!.pessoas.push(p);
    }
    return grupos;
  });
  protected readonly partidos = computed(() => [...new Set(this.todos().map((p) => p.partido).filter((x): x is string => !!x))].sort());
  protected readonly temFiltro = computed(() => !!(this.termo() || this.partido() || this.uf() || this.letra()));

  ngOnInit() {
    const q = this.rota.snapshot.queryParamMap;
    const cargo = q.get('cargo');
    if (cargo && CARGOS.some((c) => c.nome === cargo)) this.cargo.set(cargo);
    this.termo.set(q.get('q') ?? '');
    this.partido.set((q.get('partido') ?? '').toUpperCase());
    this.uf.set(q.get('uf') ?? '');
    this.letra.set(q.get('letra') ?? '');
    this.cidade.set(q.get('cidade') ?? '');
    this.carregar();
    contagemAlertas().then((m) => this.registros.set(m)).catch(() => {});
    for (const c of CARGOS.filter((x) => this.temDados(x.nome))) {
      totalDoCargo(c.nome).then((n) => this.totais.update((t) => ({ ...t, [c.nome]: n }))).catch(() => {});
    }
  }

  protected async carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.todos.set([]);
    const cargo = this.cargo();
    const uf = this.uf();
    const cidade = normalizarCidade(this.cidade());
    this.localCarregado = `${cargo}|${uf}|${cidade}`;
    if (this.municipal()) this.carregarCidades();
    if (this.municipal() && this.faltaLocal()) {
      this.carregando.set(false);
      return;
    }
    try {
      const lista = this.municipal() ? await politicosDoLocal(cargo, uf, cidade) : await todosDoCargo(cargo);
      if (cargo === this.cargo()) this.todos.set(lista);
    } catch (e) {
      if (cargo === this.cargo()) this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      if (cargo === this.cargo()) this.carregando.set(false);
    }
  }

  protected escolherCargo(c: string) {
    if (c === this.cargo()) return;
    this.cargo.set(c);
    this.partido.set('');
    this.letra.set('');
    if (!CARGOS_MUNICIPAIS.includes(c)) this.cidade.set('');
    this.limite.set(POR_VEZ);
    this.atualizarUrl();
    this.carregar();
  }

  protected escolherLetra(l: string) {
    this.letra.set(this.letra() === l ? '' : l);
    this.limite.set(POR_VEZ);
    this.atualizarUrl();
  }

  protected mudouFiltro() {
    this.limite.set(POR_VEZ);
    this.atualizarUrl();
    // Prefeito/vereador: mudar estado ou cidade é uma busca nova no banco (não só um filtro na lista).
    if (this.municipal() && this.localCarregado !== `${this.cargo()}|${this.uf()}|${normalizarCidade(this.cidade())}`) this.carregar();
  }

  protected escolherNoMapa(uf: string) {
    if (uf !== this.uf()) this.cidade.set('');
    this.uf.set(uf);
    this.mudouFiltro();
  }

  /** Estado escolhido no cartão "Onde?" (prefeitos e vereadores). */
  protected escolherEstado(uf: string) {
    this.cidade.set('');
    this.uf.set(uf);
    this.mudouFiltro();
  }

  /** Cidade: só busca quando o nome bate com uma cidade da lista (ou ao apertar Buscar). */
  protected digitouCidade(texto: string) {
    this.cidade.set(texto);
    const t = normalizarCidade(texto);
    if (!t || this.cidades().some((c) => c.busca === t)) this.mudouFiltro();
  }

  private async carregarCidades() {
    const uf = this.uf();
    if (!uf || uf === this.ufDasCidades) return;
    this.ufDasCidades = uf;
    this.cidades.set([]);
    this.carregandoCidades.set(true);
    try {
      const lista = await cidadesDoEstado(uf);
      if (uf === this.uf()) this.cidades.set(lista);
    } catch {
      this.ufDasCidades = '';
    } finally {
      this.carregandoCidades.set(false);
    }
  }

  protected verListaDoEstado() {
    this.visao.set('lista');
  }

  protected mostrarMais() {
    this.limite.update((n) => n + POR_VEZ);
  }

  protected limpar() {
    this.ordem.set('az');
    this.termo.set('');
    this.partido.set('');
    this.uf.set('');
    this.letra.set('');
    this.cidade.set('');
    this.mudouFiltro();
  }

  /** Link do perfil: Câmara, Senado (demo ou Supabase) ou TSE, sempre pela função única rotaPolitico(). */
  protected linkPerfil(p: Politico): (string | number)[] {
    return rotaPolitico(p);
  }

  /**
   * Guarda os filtros no endereço sem navegar: router.navigate faria a página voltar ao topo
   * (scrollPositionRestoration 'top') e rodar a animação de troca de tela a cada clique.
   */
  private atualizarUrl() {
    const arvore = this.router.createUrlTree([], {
      relativeTo: this.rota,
      queryParams: {
        cargo: this.cargo() === CARGOS[0].nome ? null : this.cargo(),
        q: this.termo() || null, partido: this.partido() || null, uf: this.uf() || null, letra: this.letra() || null,
        cidade: (this.municipal() && this.cidade()) || null,
      },
    });
    this.location.replaceState(this.router.serializeUrl(arvore));
  }
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
