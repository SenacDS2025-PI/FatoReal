import { Injectable, signal } from '@angular/core';

export interface Aviso {
  id: number;
  texto: string;
  tipo: 'sucesso' | 'erro';
}

/** Pop-up de aviso (toast) que some sozinho. Uso: avisos.mostrar('Publicado!') */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly lista = signal<Aviso[]>([]);
  private seq = 0;

  mostrar(texto: string, tipo: Aviso['tipo'] = 'sucesso'): void {
    const id = ++this.seq;
    this.lista.update((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => this.lista.update((l) => l.filter((a) => a.id !== id)), 3500);
  }

  erro(e: unknown): void {
    this.mostrar(e instanceof Error ? e.message : 'Algo deu errado.', 'erro');
  }
}
