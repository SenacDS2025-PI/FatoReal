// GET /api/fontes — catálogo das fontes oficiais que o Fato Real usa ou indica.
// tipo "integrada" = vira evidência no FatoBot/Fato ou Fake; "consulta" = só indicamos o link.
import { Router } from 'express';
import { catalogoPublico } from '../data/fontes-oficiais.js';

const router = Router();

router.get('/', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ fontes: catalogoPublico() });
});

export default router;
