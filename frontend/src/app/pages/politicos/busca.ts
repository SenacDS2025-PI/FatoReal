import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { POR_PAGINA, PoliticosService, partidosCamara } from '../../core/politicos.service';
import { UFS } from '../../core/util';
import { Avatar, Icone } from '../../shared/componentes';

@Component({
  selector: 'app-busca',
  imports: [FormsModule, RouterLink, Icone, Avatar],
  templateUrl: './busca.html',
})
export class BuscaPage implements OnInit {
  private service = inject(PoliticosService);
  private rota = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly ufs = UFS;
  protected termo = '';
  protected partido = '';
  protected uf = '';
  protected readonly resultados = signal<Politico[]>([]);
  protected readonly carregando = signal(false);
  protected readonly carregandoMais = signal(false);
  protected readonly temMais = signal(false);
  private pagina = 1;
  protected readonly erro = signal('');
  private espera?: ReturnType<typeof setTimeout>;
  private pedido = 0;
  /** Siglas sugeridas no campo de partido (lista da Câmara; se falhar, o campo continua livre). */
  protected readonly partidos = signal<string[]>([]);
  protected readonly esqueletos = Array.from({ length: 6 });

  protected get temFiltro(): boolean {
    return !!(this.termo || this.partido || this.uf);
  }

  ngOnInit() {
    const q = this.rota.snapshot.queryParamMap;
    this.termo = q.get('q') ?? '';
    this.partido = q.get('partido') ?? '';
    this.uf = q.get('uf') ?? '';
    this.pesquisar();
    partidosCamara().then((l) => this.partidos.set(l)).catch(() => {});
  }

  /** Filtra enquanto a pessoa digita (espera 350 ms para não chamar a API a cada tecla). */
  protected aoDigitar() {
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.pesquisar(), 350);
  }

  protected async pesquisar() {
    const meu = ++this.pedido;
    this.carregando.set(true);
    this.erro.set('');
    this.router.navigate([], {
      queryParams: { q: this.termo || null, partido: this.partido || null, uf: this.uf || null },
      replaceUrl: true,
    });
    try {
      this.pagina = 1;
      const lista = await this.service.buscar(this.filtro());
      if (meu === this.pedido) {
        this.resultados.set(lista);
        this.temMais.set(lista.length === POR_PAGINA);
      }
    } catch (e) {
      if (meu === this.pedido) {
        this.resultados.set([]);
        this.erro.set(e instanceof Error ? e.message : 'Erro na busca.');
      }
    } finally {
      if (meu === this.pedido) this.carregando.set(false);
    }
  }

  protected async carregarMais() {
    const meu = this.pedido;
    this.carregandoMais.set(true);
    try {
      const lista = await this.service.buscar({ ...this.filtro(), pagina: this.pagina + 1 });
      if (meu !== this.pedido) return;
      this.pagina++;
      const vistos = new Set(this.resultados().map((p) => p.id));
      this.resultados.update((r) => [...r, ...lista.filter((p) => !vistos.has(p.id))]);
      this.temMais.set(lista.length === POR_PAGINA);
    } catch {
      this.erro.set('Não foi possível carregar mais resultados. Tente de novo.');
    } finally {
      this.carregandoMais.set(false);
    }
  }

  private filtro() {
    return { termo: this.termo, partido: this.partido, uf: this.uf };
  }

  protected limpar() {
    this.termo = this.partido = this.uf = '';
    this.pesquisar();
  }
}
