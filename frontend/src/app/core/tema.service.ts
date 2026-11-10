import { Injectable, signal } from '@angular/core';

type Tema = 'claro' | 'escuro';

/** Modo claro/escuro. Começa pelo que o sistema da pessoa usa e lembra a escolha. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<Tema>(this.inicial());

  constructor() {
    this.aplicar(this.tema());
  }

  alternar(): void {
    const novo: Tema = this.tema() === 'claro' ? 'escuro' : 'claro';
    this.tema.set(novo);
    this.aplicar(novo);
    try {
      localStorage.setItem('fatoreal-tema', novo);
    } catch {
      /* sem localStorage */
    }
  }

  private inicial(): Tema {
    // Se a página estiver dentro de outro site que já escolheu o tema, segue ele
    const externo = document.documentElement.dataset['theme'];
    if (externo === 'dark') return 'escuro';
    if (externo === 'light') return 'claro';
    try {
      const salvo = localStorage.getItem('fatoreal-tema');
      if (salvo === 'claro' || salvo === 'escuro') return salvo;
    } catch {
      /* sem localStorage */
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }

  private aplicar(t: Tema): void {
    document.documentElement.dataset['tema'] = t;
  }
}
