import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import deputadosRouter from './routes/deputados.js';
import fatobotRouter from './routes/fatobot.js';
import { CamaraError } from './services/camara.js';

const app = express();

const origins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRouter);
app.use('/api/deputados', deputadosRouter);
app.use('/api/fatobot', fatobotRouter);

// Rota não encontrada
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Erro inesperado (não expõe detalhes internos ao usuário)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof CamaraError) {
    if (err.status === 404) return res.status(404).json({ erro: 'Deputado não encontrado' });
    console.error(err.message);
    return res
      .status(502)
      .json({ erro: 'A fonte oficial (Câmara) não respondeu. Tente de novo em instantes.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

export default app;
