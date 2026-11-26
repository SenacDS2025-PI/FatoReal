// G3 — Conta do usuário (LGPD).
//
//   GET    /api/conta/me  → dados da própria conta (perfil + e-mail)
//   DELETE /api/conta     → exclui a conta e tudo ligado a ela (função excluir_minha_conta do banco)
//
// As duas rotas exigem login. O banco é acessado "como o usuário" (RLS valendo).
import { Router } from 'express';
import { comPrazo } from '../../utils/prazo.js';
import { exigirLogin, PRAZO_SUPABASE_MS } from '../middlewares.js';

const CAMPOS_PERFIL = 'id, nome, foto_url, bio, cidade, uf, capa, is_moderador, criado_em';

export async function verMinhaConta(req, res) {
  try {
    const { data, error } = await comPrazo(
      req.supabase.from('perfis').select(CAMPOS_PERFIL).eq('id', req.usuario.id).maybeSingle(),
      PRAZO_SUPABASE_MS,
      'Supabase demorou'
    );
    if (error) throw error;
    if (!data) return res.status(404).json({ erro: 'Perfil não encontrado.' });

    const { is_moderador: moderador, ...perfil } = data;
    return res.json({ conta: { ...perfil, email: req.usuario.email, moderador: Boolean(moderador) } });
  } catch (err) {
    console.error(`Auth (verMinhaConta): ${err?.message ?? err}`);
    return res.status(502).json({ erro: 'Não foi possível carregar sua conta agora. Tente de novo em instantes.' });
  }
}

export async function excluirMinhaConta(req, res) {
  try {
    const { error } = await comPrazo(req.supabase.rpc('excluir_minha_conta'), PRAZO_SUPABASE_MS, 'Supabase demorou');
    if (error) throw error;
    return res.json({ ok: true, mensagem: 'Sua conta e seus dados foram excluídos.' });
  } catch (err) {
    console.error(`Auth (excluirMinhaConta): ${err?.message ?? err}`);
    return res.status(502).json({ erro: 'Não foi possível excluir a conta agora. Nada foi apagado. Tente de novo.' });
  }
}

const router = Router();
router.get('/me', exigirLogin, verMinhaConta);
router.delete('/', exigirLogin, excluirMinhaConta);

export default router;
