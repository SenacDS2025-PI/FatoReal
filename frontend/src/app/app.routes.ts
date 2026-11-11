import { Routes } from '@angular/router';
import { exigirLogin, exigirModerador } from './core/guards';

// Cada tela é carregada só quando a pessoa abre (lazy loading).
export const routes: Routes = [
  { path: '', title: 'Fato Real', loadComponent: () => import('./pages/inicio/inicio').then((m) => m.InicioPage) },

  // Políticos
  { path: 'politicos', title: 'Buscar políticos · Fato Real', loadComponent: () => import('./pages/politicos/busca').then((m) => m.BuscaPage) },
  { path: 'politicos/:id', title: 'Perfil do político · Fato Real', loadComponent: () => import('./pages/politicos/perfil-politico').then((m) => m.PerfilPoliticoPage) },

  // FatoBot
  { path: 'fatobot', title: 'FatoBot · Fato Real', loadComponent: () => import('./pages/fatobot/fatobot').then((m) => m.FatoBotPage) },

  // Comunidades
  { path: 'comunidades', title: 'Comunidades · Fato Real', loadComponent: () => import('./pages/comunidades/lista').then((m) => m.ComunidadesPage) },
  { path: 'comunidades/nova', title: 'Criar comunidade · Fato Real', canActivate: [exigirLogin], loadComponent: () => import('./pages/comunidades/nova').then((m) => m.NovaComunidadePage) },
  { path: 'comunidades/:slug', title: 'Comunidade · Fato Real', loadComponent: () => import('./pages/comunidades/comunidade').then((m) => m.ComunidadePage) },

  // Conta
  { path: 'entrar', title: 'Entrar · Fato Real', loadComponent: () => import('./pages/conta/entrar').then((m) => m.EntrarPage) },
  { path: 'cadastrar', title: 'Criar conta · Fato Real', loadComponent: () => import('./pages/conta/cadastrar').then((m) => m.CadastrarPage) },
  { path: 'recuperar-senha', title: 'Recuperar senha · Fato Real', loadComponent: () => import('./pages/conta/recuperar-senha').then((m) => m.RecuperarSenhaPage) },
  { path: 'nova-senha', title: 'Nova senha · Fato Real', loadComponent: () => import('./pages/conta/nova-senha').then((m) => m.NovaSenhaPage) },
  { path: 'perfil', title: 'Meu perfil · Fato Real', canActivate: [exigirLogin], loadComponent: () => import('./pages/conta/perfil').then((m) => m.PerfilPage) },
  { path: 'perfil/editar', title: 'Editar perfil · Fato Real', canActivate: [exigirLogin], loadComponent: () => import('./pages/conta/perfil-editar').then((m) => m.PerfilEditarPage) },
  { path: 'pessoas/:id', title: 'Perfil · Fato Real', loadComponent: () => import('./pages/conta/perfil').then((m) => m.PerfilPage) },

  // Novas áreas do menu
  { path: 'noticias', title: 'Notícias · Fato Real', loadComponent: () => import('./pages/noticias/noticias').then((m) => m.NoticiasPage) },
  { path: 'base-da-politica', title: 'Base da Política · Fato Real', loadComponent: () => import('./pages/base-politica/base-politica').then((m) => m.BasePoliticaPage) },
  { path: 'verificar', title: 'Verificar informação · Fato Real', loadComponent: () => import('./pages/verificar/verificar').then((m) => m.VerificarPage) },
  { path: 'mensagens', title: 'Mensagens · Fato Real', canActivate: [exigirLogin], loadComponent: () => import('./pages/mensagens/mensagens').then((m) => m.MensagensPage) },
  { path: 'notificacoes', title: 'Notificações · Fato Real', canActivate: [exigirLogin], loadComponent: () => import('./pages/notificacoes/notificacoes').then((m) => m.NotificacoesPage) },
  { path: 'configuracoes', title: 'Configurações · Fato Real', loadComponent: () => import('./pages/configuracoes/configuracoes').then((m) => m.ConfiguracoesPage) },

  // Moderação
  { path: 'moderacao', title: 'Moderação · Fato Real', canActivate: [exigirModerador], loadComponent: () => import('./pages/moderacao/moderacao').then((m) => m.ModeracaoPage) },

  // Institucional (textos legais e LGPD)
  ...(
    [
      ['sobre', 'Sobre e fontes'],
      ['termos', 'Termos de uso'],
      ['privacidade', 'Privacidade'],
      ['regras', 'Regras da comunidade'],
      ['contato', 'Contato'],
    ] as const
  ).map(([pagina, titulo]) => ({
    path: pagina,
    title: `${titulo} · Fato Real`,
    data: { pagina },
    loadComponent: () => import('./pages/institucional/institucional').then((m) => m.InstitucionalPage),
  })),

  { path: '**', title: 'Página não encontrada · Fato Real', loadComponent: () => import('./pages/nao-encontrada').then((m) => m.NaoEncontradaPage) },
];
