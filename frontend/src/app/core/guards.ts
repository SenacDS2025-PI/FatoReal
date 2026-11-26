import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AvisosService } from './avisos.service';

/** Só deixa entrar quem está logado. Senão, manda para /entrar e volta depois. */
export const exigirLogin: CanActivateFn = async (_rota, estado) => {
  // inject() precisa vir antes do await (depois dele, o Angular perde o contexto)
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pronto;
  return auth.logado() || router.createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
};

/** Só moderadores acessam o painel de denúncias. Sem login, vai para "Entrar" (e volta depois), como as outras páginas protegidas. */
export const exigirModerador: CanActivateFn = async (_rota, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const avisos = inject(AvisosService);
  await auth.pronto;
  if (auth.moderador()) return true;
  if (!auth.logado()) return router.createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
  avisos.mostrar('A página de moderação é só para a equipe de moderação.', 'erro');
  return router.createUrlTree(['/']);
};
