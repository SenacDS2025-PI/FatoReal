import { Router } from 'express';
import multer from 'multer';
import { verificar } from '../services/verificar.js';

const router = Router();

// Aceita JSON { afirmacao, link } ou formulário com anexos (multipart).
// Os arquivos ficam só na memória durante o pedido e são descartados: não são guardados.
// Obs.: na Vercel o pedido inteiro tem limite de ~4,5 MB.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 5, fileSize: 4 * 1024 * 1024, fields: 5 },
});

function aceitarAnexos(req, res, next) {
  if (!req.is('multipart/form-data')) return next();
  upload.array('anexos', 5)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ erro: 'Anexos inválidos: até 5 arquivos de no máximo 4 MB cada.' });
    }
    next(err);
  });
}

const MIN = 5;
const MAX = 1000;

// POST /api/verificar
router.post('/', aceitarAnexos, async (req, res, next) => {
  try {
    const afirmacao = typeof req.body?.afirmacao === 'string' ? req.body.afirmacao.trim() : '';
    if (afirmacao.length < MIN || afirmacao.length > MAX) {
      return res.status(400).json({ erro: `A afirmação deve ter entre ${MIN} e ${MAX} caracteres.` });
    }

    const link = typeof req.body?.link === 'string' && req.body.link.trim() ? req.body.link.trim() : null;
    if (link && !/^https:\/\/[^\s]+$/i.test(link)) {
      return res.status(400).json({ erro: 'O link precisa começar com https://' });
    }

    const anexos = Array.isArray(req.files) ? req.files.length : 0;
    res.json(await verificar({ afirmacao, link, anexos }));
  } catch (err) {
    next(err);
  }
});

export default router;
