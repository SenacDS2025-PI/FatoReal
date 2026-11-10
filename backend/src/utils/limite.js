// Limite de pedidos por IP, para ninguém gastar os créditos da IA à toa.
// Em memória: na Vercel cada instância conta separado, o que já basta para o projeto.
export function limitarPorIp({ janelaMs = 10 * 60 * 1000, max = 30 } = {}) {
  const contagens = new Map();

  return (req, res, next) => {
    const agora = Date.now();
    const ip = req.ip || 'desconhecido';
    let item = contagens.get(ip);
    if (!item || item.fim <= agora) {
      item = { total: 0, fim: agora + janelaMs };
      contagens.set(ip, item);
    }
    item.total++;

    // Limpa entradas antigas de vez em quando para a memória não crescer.
    if (contagens.size > 5000) {
      for (const [chave, v] of contagens) if (v.fim <= agora) contagens.delete(chave);
    }

    if (item.total > max) {
      res.set('Retry-After', String(Math.ceil((item.fim - agora) / 1000)));
      return res
        .status(429)
        .json({ erro: 'Muitas perguntas em pouco tempo. Espere alguns minutos e tente de novo.' });
    }
    next();
  };
}
