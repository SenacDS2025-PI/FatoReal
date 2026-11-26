// G1 — Middlewares de login.
//
// exigirLogin: lê "Authorization: Bearer <token>" (o token de sessão que o front já tem),
//   confere com o Supabase e coloca em req.usuario { id, email } e em req.supabase o
//   cliente "como o usuário" (G2). Sem token ou token inválido → 401.
// exigirModerador: usar DEPOIS do exigirLogin. Confere perfis.is_moderador → se não for, 403.
//
// Segurança: nos logs, só a mensagem do erro. Nunca token, e-mail, cabeçalhos ou
// req.usuario (LGPD).
import { comPrazo } from '../utils/prazo.js';
import { authConfigurado, clienteDoUsuario } from './supabase-usuario.js';

// Tempo máximo esperando o Supabase responder (ms).
export const PRAZO_SUPABASE_MS = 8000;

// Erro do Supabase que NÃO é culpa do token: servidor fora do ar (5xx) ou falha de rede.
// Nesses casos a pessoa não deve ouvir "sessão expirou" (401), e sim "tente de novo" (502).
export function erroDoServidor(erro) {
  const status = Number(erro?.status);
  const nome = String(erro?.name ?? '');
  return status >= 500 || /Fetch|Retryable/.test(nome);
}

// Pega o token do cabeçalho Authorization. Devolve null se não tiver ou estiver mal escrito.
export function tokenDe(req) {
  const cabecalho = String(req.headers?.authorization ?? '');
  const achou = cabecalho.match(/^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i);
  return achou ? achou[1] : null;
}

export async function exigirLogin(req, res, next) {
  if (!authConfigurado()) {
    return res.status(503).json({ erro: 'O login está indisponível no momento.' });
  }
  const token = tokenDe(req);
  if (!token) {
    return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  }

  try {
    const supabase = clienteDoUsuario(token);
    const { data, error } = await comPrazo(supabase.auth.getUser(token), PRAZO_SUPABASE_MS, 'Supabase demorou');
    if (error && erroDoServidor(error)) throw error;
    if (error || !data?.user) {
      return res.status(401).json({ erro: 'Sua sessão expirou. Entre de novo.' });
    }
    req.usuario = { id: data.user.id, email: data.user.email ?? null };
    req.supabase = supabase;
    return next();
  } catch (err) {
    // Só a mensagem do erro: nunca token, e-mail, cabeçalhos ou req.usuario (LGPD).
    console.error(`Auth (exigirLogin): ${err?.message ?? err}`);
    return res.status(502).json({ erro: 'Não foi possível conferir o login agora. Tente de novo em instantes.' });
  }
}

export async function exigirModerador(req, res, next) {
  if (!req.usuario || !req.supabase) {
    return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  }
  try {
    const { data, error } = await comPrazo(
      req.supabase.from('perfis').select('is_moderador').eq('id', req.usuario.id).maybeSingle(),
      PRAZO_SUPABASE_MS,
      'Supabase demorou'
    );
    if (error) throw error;
    if (!data?.is_moderador) {
      return res.status(403).json({ erro: 'Esta área é só para moderadores.' });
    }
    return next();
  } catch (err) {
    console.error(`Auth (exigirModerador): ${err?.message ?? err}`);
    return res.status(502).json({ erro: 'Não foi possível conferir a permissão agora. Tente de novo em instantes.' });
  }
}
