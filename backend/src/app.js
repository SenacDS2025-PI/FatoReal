import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import deputadosRouter from './routes/deputados.js';
import fatobotRouter from './routes/fatobot.js';
import verificarRouter from './routes/verificar.js';
import cepRouter from './routes/cep.js';
import whatsappRouter from './routes/whatsapp.js';
import traduzirRouter from './routes/traduzir.js';
import camaraRouter from './routes/camara.js';
import fontesRouter from './routes/fontes.js';
import authRouter from './auth/index.js'; // autenticação, área do Gustavo (ver DIVISAO.md)
import { CamaraError, MSG_CAMARA_FORA } from './services/camara.js';

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
app.use('/api/verificar', verificarRouter);
app.use('/api/cep', cepRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/traduzir', traduzirRouter);
app.use('/api/camara', camaraRouter); // repasse para a Câmara quando o CORS dela falha
app.use('/api/fontes', fontesRouter); // catálogo de fontes oficiais

// Autenticação (área do Gustavo): /api/auth, /api/conta e /api/admin. As rotas são registradas em src/auth/index.js.
app.use('/api', authRouter);

// Rota não encontrada
app.use('/api', (req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Erro inesperado (não expõe detalhes internos ao usuário)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof CamaraError) {
    if (err.status === 404) return res.status(404).json({ erro: 'Deputado não encontrado' });
    // J3: Câmara fora do ar e sem cópia de reserva.
    return res.status(503).json({ erro: MSG_CAMARA_FORA });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

export default app;
