import { Router } from 'express';
import { traduzir, TraducaoIndisponivel } from '../services/traduzir.js';
import { limitarPorIp } from '../utils/limite.js';

const router = Router();

const MIN = 10;
const MAX = 2000;

// POST /api/traduzir  body: { "texto": "<ementa do projeto>" } → { explicacao, fonte, aviso }
// Se não der para explicar com segurança, responde 503 e o front usa as regras locais dele.
router.post('/', limitarPorIp, async (req, res, next) => {
  try {
    const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
    if (texto.length < MIN || texto.length > MAX) {
      return res.status(400).json({ erro: `O texto deve ter entre ${MIN} e ${MAX} caracteres.` });
    }
    res.json(await traduzir(texto));
  } catch (err) {
    if (err instanceof TraducaoIndisponivel) {
      return res.status(503).json({ erro: 'Não foi possível explicar este texto agora.' });
    }
    next(err);
  }
});

export default router;
