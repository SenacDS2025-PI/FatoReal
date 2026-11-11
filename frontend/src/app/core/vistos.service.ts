import { Injectable, signal } from '@angular/core';

type Area = 'notificacoes' | 'comunidades';

/** Guarda quando a pessoa abriu cada área pela última vez (para os números vermelhos do menu). Só neste navegador. */
@Injectable({ providedIn: 'root' })
export class VistosService {
  readonly datas = signal<Record<Area, string>>(this.ler());

  marcar(area: Area): void {
    this.datas.update((d) => ({ ...d, [area]: new Date().toISOString() }));
    try {
      localStorage.setItem('fatoreal-vistos', JSON.stringify(this.datas()));
    } catch {
      /* sem localStorage */
    }
  }

  private ler(): Record<Area, string> {
    const padrao = { notificacoes: '1970-01-01T00:00:00Z', comunidades: '1970-01-01T00:00:00Z' };
    try {
      return { ...padrao, ...JSON.parse(localStorage.getItem('fatoreal-vistos') ?? '{}') };
    } catch {
      return padrao;
    }
  }
}
