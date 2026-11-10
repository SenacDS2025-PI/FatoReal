import { Injectable, computed, signal } from '@angular/core';

type Passo = 'comunidade' | 'fatobot' | 'politico';

/**
 * "Seu progresso" do menu lateral: três primeiros passos no Fato Real.
 * Fica salvo só neste navegador (não é dado pessoal enviado a servidor).
 */
@Injectable({ providedIn: 'root' })
export class ProgressoService {
  readonly passos = signal<Record<Passo, boolean>>(this.ler());
  readonly feitos = computed(() => Object.values(this.passos()).filter(Boolean).length);
  readonly lista = computed(() => [
    { texto: 'Participe de uma comunidade', feito: this.passos().comunidade },
    { texto: 'Faça uma pergunta para a IA', feito: this.passos().fatobot },
    { texto: 'Pesquise um político', feito: this.passos().politico },
  ]);

  marcar(passo: Passo): void {
    if (this.passos()[passo]) return;
    this.passos.update((p) => ({ ...p, [passo]: true }));
    try {
      localStorage.setItem('fatoreal-progresso', JSON.stringify(this.passos()));
    } catch {
      /* sem localStorage */
    }
  }

  private ler(): Record<Passo, boolean> {
    try {
      const salvo = JSON.parse(localStorage.getItem('fatoreal-progresso') ?? '{}');
      return { comunidade: !!salvo.comunidade, fatobot: !!salvo.fatobot, politico: !!salvo.politico };
    } catch {
      return { comunidade: false, fatobot: false, politico: false };
    }
  }
}
