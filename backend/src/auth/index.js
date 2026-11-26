// ÁREA DO GUSTAVO — autenticação, conta do usuário e painel do administrador.
//
// Este arquivo já está registrado no src/app.js (em /api). Para criar rotas novas,
// importe e registre aqui, sem mexer no app.js.
//
// Prefixos reservados para esta área: /api/auth, /api/conta e /api/admin.
// Documentação das rotas: src/auth/README.md · Divisão de tarefas: backend/DIVISAO.md
import { Router } from 'express';
import { limitarContaPorIp } from './limite.js';
import contaRouter from './rotas/conta.js';
import adminRouter from './rotas/admin.js';

const router = Router();

// Limite contra abuso com contador PRÓPRIO (60 pedidos/min por IP, ver ./limite.js):
// assim a área de conta não gasta o limite do FatoBot quando a turma usa o mesmo IP.
router.use('/conta', limitarContaPorIp, contaRouter); // → /api/conta/...
router.use('/admin', limitarContaPorIp, adminRouter); // → /api/admin/...

export default router;
