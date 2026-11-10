import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

const recursosRota = [withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' as const })];
// Na Vercel as rotas são normais (/comunidades). Em hospedagem sem servidor, usamos #/comunidades.
if (environment.roteamentoHash) recursosRota.push(withHashLocation() as never);

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes, ...recursosRota)],
};
