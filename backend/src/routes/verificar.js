import { Router } from 'express';
import multer from 'multer';
import { verificar } from '../services/verificar.js';
import { limitarPorIp } from '../utils/limite.js';
import { criarLogVerificar, previa, dominio } from '../utils/log-verificar.js';

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
    // J13: anexo grande demais ou em excesso NÃO impede a verificação do texto.
    // Os arquivos não são analisados de qualquer jeito; só avisamos na resposta.
    if (err instanceof multer.MulterError) {
      req.anexosAcimaDoLimite = true;
      return next();
    }
    next(err);
  });
}

// J13: quantos anexos vieram. Aceita os arquivos (multipart, formato antigo) ou só
// as informações deles em JSON, que é o recomendado: { "anexos": [{ "nome", "tipo", "tamanho" }] }.
// Mandar só as informações evita o limite de ~4,5 MB por pedido da Vercel.
function contarAnexos(req) {
  if (Array.isArray(req.files) && req.files.length) return req.files.length;
  const info = req.body?.anexos;
  if (Array.isArray(info)) return Math.min(info.length, 20);
  return 0;
}

const MIN = 5;
const MAX = 1000;

// POST /api/verificar
router.post('/', limitarPorIp, aceitarAnexos, async (req, res, next) => {
  const log = criarLogVerificar();
  try {
    const afirmacao = typeof req.body?.afirmacao === 'string' ? req.body.afirmacao.trim() : '';
    log.info('1. pedido recebido', {
      formato: req.is('multipart/form-data') ? 'formulário com anexos' : 'json',
      tamanho: afirmacao.length,
      previa: previa(afirmacao),
    });
    if (afirmacao.length < MIN || afirmacao.length > MAX) {
      log.aviso('recusado (400): tamanho da afirmação', { tamanho: afirmacao.length, min: MIN, max: MAX });
      return res.status(400).json({ erro: `A afirmação deve ter entre ${MIN} e ${MAX} caracteres.` });
    }

    const link = typeof req.body?.link === 'string' && req.body.link.trim() ? req.body.link.trim() : null;
    if (link && !/^https:\/\/[^\s]+$/i.test(link)) {
      log.aviso('recusado (400): link sem https://', { site: dominio(link) });
      return res.status(400).json({ erro: 'O link precisa começar com https://' });
    }

    const anexos = contarAnexos(req);
    log.info('2. dados conferidos', {
      link: link ? dominio(link) : null,
      anexos,
      anexosAcimaDoLimite: Boolean(req.anexosAcimaDoLimite),
    });

    const resultado = await verificar({ afirmacao, link, anexos, anexosAcimaDoLimite: Boolean(req.anexosAcimaDoLimite), log });
    log.info('6. resposta enviada', { estado: resultado.estado, fontes: resultado.fontes?.length ?? 0 });
    res.json(resultado);
  } catch (err) {
    log.erro('falhou', { erro: err.message });
    next(err);
  }
});

export default router;
