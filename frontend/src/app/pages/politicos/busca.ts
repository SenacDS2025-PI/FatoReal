import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { CARGOS, letraDe, todosDoCargo } from '../../core/politicos.service';
import { modoDemo } from '../../core/supabase';
import { UFS } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const POR_VEZ = 48;

/** Candidatos: todos os políticos de cada cargo, em ordem alfabética, com índice A–Z e filtros. */
@Component({
  selector: 'app-busca',
  imports: [FormsModule, RouterLink, Icone, Avatar],
  templateUrl: './busca.html',
})
export class BuscaPage implements OnInit {
  private rota = inject(ActivatedRoute);
  private router = inject(Router);

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
  protected readonly esqueletos = Array.from({ length: 6 });

  /** Cargo sem fonte automática no modo demonstração (governador, presidente...). */
  protected readonly semFonte = computed(() => this.demo && !CARGOS.find((c) => c.nome === this.cargo())?.fonte);

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
  protected readonly resultados = computed(() => (this.letra() ? this.filtrados().filter((p) => letraDe(p.nome) === this.letra()) : this.filtrados()));
  protected readonly visiveis = computed(() => this.resultados().slice(0, this.limite()));
  /** Resultados agrupados por letra, para os títulos "A", "B"... */
  protected readonly grupos = computed(() => {
    const grupos: { letra: string; pessoas: Politico[] }[] = [];
    for (const p of this.visiveis()) {
      const l = letraDe(p.nome);
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
    this.carregar();
  }

  protected async carregar() {
    this.carregando.set(true);
    this.erro.set('');
    this.todos.set([]);
    const cargo = this.cargo();
    try {
      const lista = await todosDoCargo(cargo);
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
  }

  protected mostrarMais() {
    this.limite.update((n) => n + POR_VEZ);
  }

  protected limpar() {
    this.termo.set('');
    this.partido.set('');
    this.uf.set('');
    this.letra.set('');
    this.mudouFiltro();
  }

  /** Link do perfil: deputados e itens do Supabase em /politicos/:id; senadores (demo) em /politicos/senado/:id. */
  protected linkPerfil(p: Politico): (string | number)[] {
    return p.casa === 'senado' && this.demo ? ['/politicos/senado', p.id] : ['/politicos', p.id];
  }

  private atualizarUrl() {
    this.router.navigate([], {
      queryParams: {
        cargo: this.cargo() === CARGOS[0].nome ? null : this.cargo(),
        q: this.termo() || null, partido: this.partido() || null, uf: this.uf() || null, letra: this.letra() || null,
      },
      replaceUrl: true,
    });
  }
}

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
