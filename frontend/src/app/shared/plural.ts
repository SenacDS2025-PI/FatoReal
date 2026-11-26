import { Pipe, PipeTransform } from '@angular/core';
import { plural } from '../core/util';

/** Uso: {{ total | plural: 'membro' : 'membros' }} → "1 membro" ou "5 membros". */
@Pipe({ name: 'plural' })
export class PluralPipe implements PipeTransform {
  transform(n: number | null | undefined, um: string, varios: string): string {
    return plural(n, um, varios);
  }
}
