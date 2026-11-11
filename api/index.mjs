// Entrada da API na Vercel quando o site e a API ficam no MESMO projeto.
// O Express de verdade está em backend/src/app.js (localmente: cd backend && npm run dev).
import app from '../backend/src/app.js';

export default app;
