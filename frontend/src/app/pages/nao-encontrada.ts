import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-nao-encontrada',
  imports: [RouterLink],
  template: `
    <section class="card vazio">
      <h1>Página não encontrada</h1>
      <p>O endereço pode estar errado ou a página foi removida.</p>
      <a routerLink="/" class="botao">Voltar para o início</a>
    </section>
  `,
})
export class NaoEncontradaPage {}
