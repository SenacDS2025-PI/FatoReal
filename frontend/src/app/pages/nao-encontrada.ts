import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icone } from '../shared/componentes';

@Component({
  selector: 'app-nao-encontrada',
  imports: [RouterLink, Icone],
  template: `
    <section class="card erro404">
      <img src="img/fatobot.webp" alt="" class="erro404-robo" />
      <p class="erro404-num">404</p>
      <h1>Ops! Não achei essa página.</h1>
      <p class="texto-suave">O endereço pode estar errado ou a página foi removida. Que tal ir para um destes lugares?</p>
      <nav class="erro404-atalhos" aria-label="Atalhos">
        @for (a of atalhos; track a.rota) {
          <a [routerLink]="a.rota" [style.--c]="a.cor"><span><app-icone [nome]="a.icone" /></span>{{ a.nome }}</a>
        }
      </nav>
    </section>
  `,
})
export class NaoEncontradaPage {
  protected readonly atalhos = [
    { nome: 'Início', rota: '/', icone: 'home', cor: '#00c27a' },
    { nome: 'Notícias', rota: '/noticias', icone: 'newspaper', cor: '#1e6bff' },
    { nome: 'Políticos', rota: '/politicos', icone: 'account_balance', cor: '#7c4dff' },
    { nome: 'Base da Política', rota: '/base-da-politica', icone: 'school', cor: '#ffb000' },
    { nome: 'Comunidades', rota: '/comunidades', icone: 'groups', cor: '#ff7a1a' },
    { nome: 'Fato ou Fake', rota: '/fato-ou-fake', icone: 'fact_check', cor: '#16a34a' },
  ];
}
