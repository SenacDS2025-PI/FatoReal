import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import deputadosRouter from './routes/deputados.js';
import fatobotRouter from './routes/fatobot.js';
import verificarRouter from './routes/verificar.js';
import { CamaraError } from './services/camara.js';
import { limitarPorIp } from './utils/limite.js';

const app = express();

// Na Vercel o pedido passa por um proxy: assim req.ip é o IP real do usuário.
app.set('trust proxy', 1);

// Rotas que usam a IA: limite de pedidos por IP (padrão 30 a cada 10 minutos).
const limiteIa = limitarPorIp({ max: Number(process.env.LIMITE_IA_POR_IP) || 30 });

const origins = (process.env.CORS_ORIGIN || 'http://localhost:4200')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json({ limit: '100kb' }));

app.use('/api/health', healthRouter);
app.use('/api/deputados', deputadosRouter);
app.use('/api/fatobot', limiteIa, fatobotRouter);
app.use('/api/verificar', limiteIa, verificarRouter);

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
