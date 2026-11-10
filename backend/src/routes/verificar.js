import { Router } from 'express';
import { verificar } from '../services/verificar.js';

const router = Router();

const MIN = 10;
const MAX = 1000;

// POST /api/verificar   body: { "afirmacao": "A Câmara tem 513 deputados." }
// 200 → { estado, explicacao, fontes: [{ titulo, url, data }], consultado_em }
router.post('/', async (req, res, next) => {
  try {
    const afirmacao = typeof req.body?.afirmacao === 'string' ? req.body.afirmacao.trim() : '';
    if (afirmacao.length < MIN || afirmacao.length > MAX) {
      return res
        .status(400)
        .json({ erro: `A afirmação deve ter entre ${MIN} e ${MAX} caracteres.` });
    }
    res.json(await verificar(afirmacao));
  } catch (err) {
    next(err);
  }
});

export default router;
