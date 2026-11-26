import { Injectable, signal } from '@angular/core';
import { Politico } from './modelos';

/** Político que a pessoa segue (fica salvo neste navegador). */
export interface Seguido {
  id: number;
  casa: 'camara' | 'senado' | 'tse';
  nome: string;
  foto_url?: string | null;
  partido?: string | null;
  uf?: string | null;
}

const CHAVE = 'fatoreal-politicos-seguidos';

@Injectable({ providedIn: 'root' })
export class SeguidosService {
  readonly lista = signal<Seguido[]>(this.ler());

  sigo(p: Pick<Politico, 'id' | 'casa'>): boolean {
    return this.lista().some((s) => s.id === p.id && s.casa === (p.casa ?? 'camara'));
  }

  alternar(p: Politico): boolean {
    const casa = p.casa ?? 'camara';
    if (this.sigo(p)) {
      this.lista.update((l) => l.filter((s) => !(s.id === p.id && s.casa === casa)));
    } else {
      this.lista.update((l) => [...l, { id: p.id, casa, nome: p.nome, foto_url: p.foto_url, partido: p.partido, uf: p.uf }]);
    }
    try {
      localStorage.setItem(CHAVE, JSON.stringify(this.lista()));
    } catch {
      /* sem localStorage */
    }
    return this.sigo(p);
  }

  private ler(): Seguido[] {
    try {
      return JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
    } catch {
      return [];
    }
  }
}
