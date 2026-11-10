import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Politico } from '../../core/modelos';
import { PoliticosService } from '../../core/politicos.service';
import { ProgressoService } from '../../core/progresso.service';
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
  private progresso = inject(ProgressoService);

  protected readonly ufs = UFS;
  protected termo = '';
  protected partido = '';
  protected uf = '';
  protected readonly resultados = signal<Politico[]>([]);
  protected readonly carregando = signal(false);
  protected readonly erro = signal('');
  private espera?: ReturnType<typeof setTimeout>;
  private pedido = 0;

  ngOnInit() {
    const q = this.rota.snapshot.queryParamMap;
    this.termo = q.get('q') ?? '';
    this.partido = q.get('partido') ?? '';
    this.uf = q.get('uf') ?? '';
    this.pesquisar();
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
      const lista = await this.service.buscar({ termo: this.termo, partido: this.partido, uf: this.uf });
      if (meu === this.pedido) this.resultados.set(lista);
      if (this.termo || this.partido || this.uf) this.progresso.marcar('politico');
    } catch (e) {
      if (meu === this.pedido) {
        this.resultados.set([]);
        this.erro.set(e instanceof Error ? e.message : 'Erro na busca.');
      }
    } finally {
      if (meu === this.pedido) this.carregando.set(false);
    }
  }

  protected limpar() {
    this.termo = this.partido = this.uf = '';
    this.pesquisar();
  }
}
