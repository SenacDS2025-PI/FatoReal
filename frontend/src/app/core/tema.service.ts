import { Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'escuro';
export type PreferenciaTema = Tema | 'sistema';

/**
 * Modo claro/escuro. A pessoa escolhe em Configurações (Claro, Escuro ou Automático = segue o celular/computador)
 * ou puxando a cordinha da lâmpada na barra de cima. A escolha fica salva neste navegador.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly preferencia = signal<PreferenciaTema>(this.lerPreferencia());
  readonly tema = signal<Tema>(this.resolver(this.preferencia()));
  private readonly sistema = matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    this.aplicar(this.tema());
    // No modo Automático, acompanha a troca do sistema na hora
    this.sistema.addEventListener?.('change', () => {
      if (this.preferencia() === 'sistema') this.definirTema(this.resolver('sistema'));
    });
  }

  /** Cordinha da lâmpada: acende (claro) ou apaga (escuro). */
  alternar(): void {
    this.definir(this.tema() === 'claro' ? 'escuro' : 'claro');
  }

  definir(p: PreferenciaTema): void {
    this.preferencia.set(p);
    this.definirTema(this.resolver(p));
    try {
      if (p === 'sistema') localStorage.removeItem('fatoreal-tema');
      else localStorage.setItem('fatoreal-tema', p);
    } catch {
      /* sem localStorage */
    }
  }

  private definirTema(t: Tema) {
    this.tema.set(t);
    this.aplicar(t);
  }

  private lerPreferencia(): PreferenciaTema {
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
    return 'sistema';
  }

  private resolver(p: PreferenciaTema): Tema {
    if (p !== 'sistema') return p;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro';
  }

  private aplicar(t: Tema): void {
    document.documentElement.dataset['tema'] = t;
    // Barra do celular (app instalado) na mesma cor da barra de cima do site.
    const cor = t === 'escuro' ? '#121316' : '#0e5e3a';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', cor));
  }
}
