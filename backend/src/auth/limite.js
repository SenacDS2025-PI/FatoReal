// Limite de uso da área de conta/admin, com contador PRÓPRIO.
//
// Por quê separado: numa sala de aula todos saem pelo MESMO IP (ex.: rede do Senac). Se o
// front chamar /api/conta/me em toda página e usássemos o contador do FatoBot
// (limitarPorIp), a turma gastaria o limite dele e o FatoBot começaria a recusar perguntas.
//
// Padrão: 60 pedidos por minuto por IP. Ajuste com LIMITE_CONTA_POR_IP_MIN.
import { criarContador, ipDe } from '../utils/limite.js';

const numeroDoAmbiente = (nome, padrao) => {
  const n = Number(process.env[nome]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

export const limiteContaPorIp = criarContador({
  janelaMs: 60_000,
  max: () => numeroDoAmbiente('LIMITE_CONTA_POR_IP_MIN', 60),
});

export function limitarContaPorIp(req, res, next) {
  const { permitido, esperarMs } = limiteContaPorIp.usar(ipDe(req));
  if (permitido) return next();
  res.set('Retry-After', String(Math.max(1, Math.ceil(esperarMs / 1000))));
  return res.status(429).json({ erro: 'Muitos pedidos em pouco tempo. Espere um minuto e tente de novo.' });
}

// Só para os testes.
export function _zerarLimiteConta() {
  limiteContaPorIp.zerar();
}
