import { Router } from 'express';
import { verificarFontes } from '../services/saude.js';
import { limitarPorIp } from '../utils/limite.js';

const router = Router();

// GET /api/health — confirma que a API está no ar (rápido, não consulta nada)
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FATO REAL API',
    horario: new Date().toISOString(),
  });
});

// GET /api/health/fontes — J12: check-up da Câmara, Supabase, cópia de reserva e Gemini.
// Com ?ia=1 também faz uma chamada mínima ao Gemini (gasta 1 da cota).
// Responde 503 quando não há nenhuma fonte de deputados ("fora").
router.get('/fontes', limitarPorIp, async (req, res, next) => {
  try {
    const resultado = await verificarFontes({ testarGemini: req.query.ia === '1' });
    res.status(resultado.status === 'fora' ? 503 : 200).json(resultado);
  } catch (err) {
    next(err);
  }
});

export default router;
