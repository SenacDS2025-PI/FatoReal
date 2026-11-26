// G4 — Painel do administrador.
//
//   GET /api/admin/metricas → totais do site (só moderador)
//
// As contagens usam o RLS do banco "como o moderador": por isso ele enxerga também as
// publicações removidas e as denúncias. Contamos sem baixar as linhas (head: true).
import { Router } from 'express';
import { comPrazo } from '../../utils/prazo.js';
import { exigirLogin, exigirModerador, PRAZO_SUPABASE_MS } from '../middlewares.js';

// Usuários = perfis: o banco cria um perfil automaticamente a cada cadastro
// (a tabela de login, auth.users, não pode ser lida com a chave pública).
const CONTAGENS = {
  usuarios: (sb) => sb.from('perfis').select('id', { count: 'exact', head: true }),
  comunidades: (sb) => sb.from('comunidades').select('id', { count: 'exact', head: true }),
  publicacoes: (sb) => sb.from('publicacoes').select('id', { count: 'exact', head: true }).eq('removida', false),
  publicacoesRemovidas: (sb) =>
    sb.from('publicacoes').select('id', { count: 'exact', head: true }).eq('removida', true),
  denunciasAbertas: (sb) => sb.from('denuncias').select('id', { count: 'exact', head: true }).eq('status', 'aberta'),
};

export async function metricas(req, res) {
  try {
    const nomes = Object.keys(CONTAGENS);
    const respostas = await comPrazo(
      Promise.all(nomes.map((n) => CONTAGENS[n](req.supabase))),
      PRAZO_SUPABASE_MS,
      'Supabase demorou'
    );
    const totais = {};
    respostas.forEach(({ count, error }, i) => {
      if (error) throw error;
      totais[nomes[i]] = count ?? 0;
    });
    return res.json({ metricas: totais, geradoEm: new Date().toISOString() });
  } catch (err) {
    console.error(`Auth (metricas): ${err?.message ?? err}`);
    return res.status(502).json({ erro: 'Não foi possível carregar as métricas agora. Tente de novo em instantes.' });
  }
}

const router = Router();
router.get('/metricas', exigirLogin, exigirModerador, metricas);

export default router;
