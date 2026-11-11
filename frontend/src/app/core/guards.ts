import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Só deixa entrar quem está logado. Senão, manda para /entrar e volta depois. */
export const exigirLogin: CanActivateFn = async (_rota, estado) => {
  // inject() precisa vir antes do await (depois dele, o Angular perde o contexto)
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pronto;
  return auth.logado() || router.createUrlTree(['/entrar'], { queryParams: { voltar: estado.url } });
};

/** Só moderadores acessam o painel de denúncias. */
export const exigirModerador: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pronto;
  return auth.moderador() || router.createUrlTree(['/']);
};
