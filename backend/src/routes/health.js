import { Router } from 'express';

const router = Router();

// GET /api/health — confirma que a API está no ar
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FATO REAL API',
    horario: new Date().toISOString(),
  });
});

export default router;
