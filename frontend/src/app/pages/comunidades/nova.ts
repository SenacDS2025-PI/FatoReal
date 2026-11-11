import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AvisosService } from '../../core/avisos.service';
import { ComunidadesService } from '../../core/comunidades.service';
import { Icone } from '../../shared/componentes';

@Component({
  selector: 'app-nova-comunidade',
  imports: [FormsModule, RouterLink, Icone],
  templateUrl: './nova.html',
})
export class NovaComunidadePage {
  private service = inject(ComunidadesService);
  private avisos = inject(AvisosService);
  private router = inject(Router);

  protected readonly temas = ['Política', 'Educação', 'Cidadania', 'Economia', 'Saúde', 'Meio ambiente', 'Segurança', 'Tecnologia'];
  protected dados = {
    nome: '',
    tema: 'Política',
    descricao: '',
    regras:
      '1. Respeite as pessoas: critique ideias, não quem pensa diferente.\n' +
      '2. Ao afirmar um fato, cite a fonte.\n' +
      '3. Opinião é bem-vinda e não é desinformação.\n' +
      '4. Não publique conteúdo sabidamente falso.',
  };
  protected readonly enviando = signal(false);

  protected async criar() {
    this.enviando.set(true);
    try {
      const c = await this.service.criar(this.dados);
      this.avisos.mostrar('Comunidade criada!');
      this.router.navigate(['/comunidades', c.slug]);
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.enviando.set(false);
    }
  }
}
