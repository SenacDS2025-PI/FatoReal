import { Router } from 'express';
import { listarDeputados, obterDeputado } from '../services/camara.js';
import { normalizar } from '../utils/texto.js';

const router = Router();

// GET /api/deputados?busca=tab&uf=SP&partido=PSB
// A busca ignora acentos e maiúsculas e funciona com qualquer pedaço do nome.
router.get('/', async (req, res, next) => {
  try {
    const busca = normalizar(req.query.busca);
    const uf = normalizar(req.query.uf);
    const partido = normalizar(req.query.partido);

    if (busca.length > 100) {
      return res.status(400).json({ erro: 'Busca muito longa' });
    }

    const { dados, fonte } = await listarDeputados();
    const resultado = dados.filter(
      (d) =>
        (!busca || normalizar(d.nome).includes(busca)) &&
        (!uf || normalizar(d.uf) === uf) &&
        (!partido || normalizar(d.partido) === partido)
    );

    res.json({ total: resultado.length, dados: resultado, fonte });
  } catch (err) {
    next(err);
  }
});

// GET /api/deputados/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^\d{1,10}$/.test(id)) {
      return res.status(400).json({ erro: 'ID inválido' });
    }
    res.json(await obterDeputado(id));
  } catch (err) {
    next(err);
  }
});

export default router;
