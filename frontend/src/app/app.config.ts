import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { environment } from '../environments/environment';
import { routes } from './app.routes';

// Formatos brasileiros (R$ 1.234,56) para os pipes que pedem 'pt-BR'
registerLocaleData(localePt, 'pt-BR');

const recursosRota = [withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' as const })];
// Na Vercel as rotas são normais (/comunidades). Em hospedagem sem servidor, usamos #/comunidades.
if (environment.roteamentoHash) recursosRota.push(withHashLocation() as never);

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes, ...recursosRota)],
};
