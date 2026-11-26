// J10 — limites de uso, para ninguém gastar à toa a cota grátis do Gemini.
// Baseado no limitador por IP do Matheus (branch backup/matheus-2026-11-17).
//
// Em memória: na Vercel cada instância conta separado. Para o tamanho do projeto, basta.

// Conta usos por chave (ex.: IP) numa janela de tempo. Devolve true se ainda pode usar.
export function criarContador({ janelaMs, max }) {
  const contagens = new Map();
  return {
    janelaMs,
    get max() {
      return typeof max === 'function' ? max() : max;
    },
    // Registra um uso. Retorna { permitido, esperarMs }.
    usar(chave = 'geral') {
      const agora = Date.now();
      let item = contagens.get(chave);
      if (!item || item.fim <= agora) {
        item = { total: 0, fim: agora + janelaMs };
        contagens.set(chave, item);
      }
      // Limpa entradas vencidas de vez em quando, para a memória não crescer.
      if (contagens.size > 5000) {
        for (const [k, v] of contagens) if (v.fim <= agora) contagens.delete(k);
      }
      if (item.total >= this.max) return { permitido: false, esperarMs: item.fim - agora };
      item.total++;
      return { permitido: true, esperarMs: 0 };
    },
    // Quanto já foi usado, sem registrar um uso novo (para o /api/health/fontes).
    uso(chave = 'geral') {
      const item = contagens.get(chave);
      const vivo = item && item.fim > Date.now();
      return { usados: vivo ? item.total : 0, max: this.max, renovaEmMs: vivo ? item.fim - Date.now() : 0 };
    },
    zerar() {
      contagens.clear();
    },
  };
}

const numeroDoAmbiente = (nome, padrao) => {
  const n = Number(process.env[nome]);
  return Number.isFinite(n) && n > 0 ? n : padrao;
};

// IP de quem fez o pedido. Na Vercel, o x-forwarded-for é preenchido pela própria Vercel.
export function ipDe(req) {
  const encaminhado = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return req.headers['x-real-ip'] || encaminhado || req.ip || 'desconhecido';
}

// Camada 1 — por IP, só contra abuso. Generoso de propósito: numa sala de aula, todos
// saem pelo MESMO IP (ex.: rede do Senac), então um limite baixo bloquearia a turma.
// Padrão: 60 pedidos por minuto por IP. Ajuste com LIMITE_POR_IP_MIN.
export const limitePorIp = criarContador({
  janelaMs: 60_000,
  max: () => numeroDoAmbiente('LIMITE_POR_IP_MIN', 60),
});

export function limitarPorIp(req, res, next) {
  const { permitido, esperarMs } = limitePorIp.usar(ipDe(req));
  if (permitido) return next();
  res.set('Retry-After', String(Math.ceil(esperarMs / 1000)));
  return res.status(429).json({ erro: 'Muitas perguntas em pouco tempo. Espere um minuto e tente de novo.' });
}

// Proxy da Câmara (/api/camara): mesma regra por IP, mas com um contador SEPARADO.
// O perfil de político pode fazer vários pedidos por página e, numa sala de aula, todos
// saem pelo mesmo IP: com o contador do FatoBot, a turma gastaria o limite dele.
// Padrão: 120 pedidos por minuto por IP. Ajuste com LIMITE_CAMARA_POR_IP_MIN.
export const limiteCamaraPorIp = criarContador({
  janelaMs: 60_000,
  max: () => numeroDoAmbiente('LIMITE_CAMARA_POR_IP_MIN', 120),
});

export function limitarPorIpCamara(req, res, next) {
  const { permitido, esperarMs } = limiteCamaraPorIp.usar(ipDe(req));
  if (permitido) return next();
  res.set('Retry-After', String(Math.ceil(esperarMs / 1000)));
  return res.status(429).json({ erro: 'Muitos pedidos em pouco tempo. Espere um minuto e tente de novo.' });
}

// Camada 2 — cota da IA para o servidor inteiro, um pouco abaixo do plano grátis do
// gemini-3.5-flash-lite (15/min e 500/dia, segundo a tabela usada pelo grupo).
// Quando acaba, o FatoBot NÃO recusa a pergunta: responde só com as fontes.
// Ajuste com LIMITE_IA_POR_MIN e LIMITE_IA_POR_DIA.
export const cotaIaMinuto = criarContador({
  janelaMs: 60_000,
  max: () => numeroDoAmbiente('LIMITE_IA_POR_MIN', 14),
});
export const cotaIaDia = criarContador({
  janelaMs: 24 * 60 * 60_000,
  max: () => numeroDoAmbiente('LIMITE_IA_POR_DIA', 450),
});

// Registra uma chamada ao Gemini se houver cota. Retorna false se a cota local acabou.
export function usarCotaIa() {
  if (!cotaIaMinuto.usar('servidor').permitido) return false;
  return cotaIaDia.usar('servidor').permitido;
}

export function usoCotaIa() {
  return { porMinuto: cotaIaMinuto.uso('servidor'), porDia: cotaIaDia.uso('servidor') };
}

// Só para os testes.
export function _zerarLimites() {
  limitePorIp.zerar();
  limiteCamaraPorIp.zerar();
  cotaIaMinuto.zerar();
  cotaIaDia.zerar();
}
