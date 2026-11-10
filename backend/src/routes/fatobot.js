import { Router } from 'express';
import { responder } from '../services/fatobot.js';

const router = Router();

const MIN = 3;
const MAX = 500;

// POST /api/fatobot   body: { "pergunta": "Quem é Tabata Amaral?" }
// 200 → { resposta, fontes: [{ titulo, url, data }], consultado_em, sem_evidencia, ... }
router.post('/', async (req, res, next) => {
  try {
    const pergunta = typeof req.body?.pergunta === 'string' ? req.body.pergunta.trim() : '';
    if (pergunta.length < MIN || pergunta.length > MAX) {
      return res
        .status(400)
        .json({ erro: `A pergunta deve ter entre ${MIN} e ${MAX} caracteres.` });
    }
    res.json(await responder(pergunta));
  } catch (err) {
    next(err);
  }
});

export default router;
