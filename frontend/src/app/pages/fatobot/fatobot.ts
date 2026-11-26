import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, effect, inject, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FatoBotConversa } from '../../core/fatobot-conversa.service';
import { AvisoIa, FonteDado, Icone } from '../../shared/componentes';
import { SeloStatus } from '../../shared/selo-status';
import { FatobotVivo } from '../../shared/fatobot-vivo';

/** FatoBot em tela cheia: mesma conversa da bolinha, com mais espaço e o visual novo. */
@Component({
  selector: 'app-fatobot',
  imports: [FormsModule, DatePipe, Icone, FonteDado, AvisoIa, SeloStatus, FatobotVivo],
  templateUrl: './fatobot.html',
})
export class FatoBotPage implements OnInit {
  private conversa = inject(FatoBotConversa);
  private rota = inject(ActivatedRoute);
  private lista = viewChild<ElementRef<HTMLElement>>('lista');

  protected pergunta = '';
  protected readonly mensagens = this.conversa.mensagens;
  protected readonly pensando = this.conversa.pensando;
  protected readonly sugestoes = [
    { texto: 'Como funciona uma votação no Congresso?', icone: 'how_to_vote', cor: '#4f46e5' },
    { texto: 'Qual é a função de um deputado federal?', icone: 'badge', cor: '#0369a1' },
    { texto: 'Quantos deputados tem a Câmara?', icone: 'groups', cor: '#15803d' },
    { texto: 'O que é uma medida provisória?', icone: 'gavel', cor: '#b45309' },
  ];

  constructor() {
    // Rola para a última mensagem sempre que chega uma nova
    effect(() => {
      this.mensagens();
      this.pensando();
      const el = this.lista()?.nativeElement;
      if (el) setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    });
  }

  ngOnInit() {
    this.conversa.aberto.set(false);
    const p = this.rota.snapshot.queryParamMap.get('p');
    if (p) this.enviar(p);
  }

  protected async enviar(texto = this.pergunta) {
    if (!texto.trim()) return;
    this.pergunta = '';
    await this.conversa.enviar(texto);
  }

  protected limpar() {
    this.conversa.limpar();
  }
}
