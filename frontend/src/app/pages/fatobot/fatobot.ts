import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FatoBotService } from '../../core/fatobot.service';
import { RespostaFatoBot } from '../../core/modelos';
import { AvisoIa, FonteDado, Icone } from '../../shared/componentes';

interface Mensagem {
  autor: 'voce' | 'bot';
  texto: string;
  resposta?: RespostaFatoBot;
}

@Component({
  selector: 'app-fatobot',
  imports: [FormsModule, DatePipe, Icone, FonteDado, AvisoIa],
  templateUrl: './fatobot.html',
})
export class FatoBotPage implements OnInit {
  private bot = inject(FatoBotService);
  private rota = inject(ActivatedRoute);

  protected pergunta = '';
  protected readonly mensagens = signal<Mensagem[]>([]);
  protected readonly pensando = signal(false);
  protected readonly sugestoes = [
    'Como funciona uma votação no Congresso?',
    'Qual é a função de um deputado federal?',
    'Quantos deputados tem a Câmara?',
  ];

  ngOnInit() {
    const p = this.rota.snapshot.queryParamMap.get('p');
    if (p) this.enviar(p);
  }

  protected async enviar(texto = this.pergunta) {
    const pergunta = texto.trim();
    if (!pergunta || this.pensando()) return;
    this.pergunta = '';
    this.mensagens.update((m) => [...m, { autor: 'voce', texto: pergunta }]);
    this.pensando.set(true);
    try {
      const resposta = await this.bot.perguntar(pergunta);
      this.mensagens.update((m) => [...m, { autor: 'bot', texto: resposta.resposta, resposta }]);
    } catch (e) {
      const texto = e instanceof Error ? e.message : 'O FatoBot não respondeu.';
      this.mensagens.update((m) => [...m, { autor: 'bot', texto }]);
    } finally {
      this.pensando.set(false);
    }
  }
}
