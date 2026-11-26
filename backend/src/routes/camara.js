// Repasse (proxy) de pedidos GET para a API de Dados Abertos da Câmara.
//
// Por quê: às vezes a Câmara responde 200 SEM o cabeçalho Access-Control-Allow-Origin em
// /deputados/{id} e /deputados/{id}/historico (parece cache do servidor dela). O navegador
// bloqueia a resposta (erro de CORS), mas um servidor não tem essa trava. Quando o acesso
// direto falha, o front busca por aqui.
//
// Contrato:
//   GET /api/camara/<caminho>?<query>
//     → busca https://dadosabertos.camara.leg.br/api/v2/<caminho>?<query>
//     → devolve o MESMO corpo JSON e o MESMO status da Câmara.
//   Ex.: GET /api/camara/deputados/221328 = .../api/v2/deputados/221328
//
// Para não virar um proxy aberto: só GET, só deputados/proposicoes/votacoes/eventos, e cada
// pedaço do caminho só com letras, números e hífen (os ids de votação têm hífen, ex.: 2265603-43).
import { Router } from 'express';
import { CAMARA_API } from '../services/camara-fonte.js';
import { cached } from '../utils/cache.js';
import { comPrazo } from '../utils/prazo.js';
import { limitarPorIpCamara } from '../utils/limite.js';

const router = Router();

export const CAMINHO_PERMITIDO = /^(deputados|proposicoes|votacoes|eventos)(\/[A-Za-z0-9-]+)*$/;
const PRAZO_MS = 8_000;
const CACHE_MS = 10 * 60 * 1000; // 10 minutos
const MAX_QUERY = 1000;

const ERRO_CAMINHO = { erro: 'Caminho não permitido.' };
const ERRO_CAMARA = { erro: 'A Câmara não respondeu. Tente de novo em instantes.' };

class FalhaCamara extends Error {}

// Resposta da Câmara que não é 200: devolvida ao front, mas NÃO guardada no cache.
class NaoGuardar extends Error {
  constructor(resposta) {
    super(`Câmara respondeu ${resposta.status}`);
    this.resposta = resposta;
  }
}

async function buscar(url) {
  let res;
  try {
    res = await comPrazo(
      fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(PRAZO_MS) }),
      PRAZO_MS,
      'a Câmara não respondeu a tempo'
    );
  } catch (err) {
    throw new FalhaCamara(err.message);
  }
  const texto = await res.text();
  try {
    return { status: res.status, corpo: JSON.parse(texto) };
  } catch {
    // Ex.: página de erro em HTML do servidor da Câmara (504).
    throw new FalhaCamara(`resposta não é JSON (HTTP ${res.status})`);
  }
}

// Só respostas 200 ficam no cache (chave = URL completa). Se a Câmara falhar depois que o
// cache venceu, o cached() devolve a última resposta boa.
async function obter(url) {
  try {
    return await cached(`camara-proxy:${url}`, CACHE_MS, async () => {
      const resposta = await buscar(url);
      if (resposta.status !== 200) throw new NaoGuardar(resposta);
      return resposta;
    });
  } catch (err) {
    if (err instanceof NaoGuardar) return err.resposta;
    throw err;
  }
}

// GET /api/camara/<caminho>?<query>
router.get('/*', limitarPorIpCamara, async (req, res, next) => {
  try {
    const caminho = req.path.replace(/^\/+/, '');
    const i = req.originalUrl.indexOf('?');
    const query = i >= 0 ? req.originalUrl.slice(i) : '';
    if (!CAMINHO_PERMITIDO.test(caminho) || query.length > MAX_QUERY) {
      return res.status(400).json(ERRO_CAMINHO);
    }

    const { status, corpo } = await obter(`${CAMARA_API}/${caminho}${query}`);
    res.set('Cache-Control', status === 200 ? 'public, max-age=600' : 'no-store');
    return res.status(status).json(corpo);
  } catch (err) {
    if (err instanceof FalhaCamara) {
      console.error(`Proxy da Câmara: ${err.message}`);
      res.set('Cache-Control', 'no-store');
      return res.status(502).json(ERRO_CAMARA);
    }
    return next(err);
  }
});

// Só GET.
router.all('/*', (req, res) => res.status(405).set('Allow', 'GET').json({ erro: 'Só pedidos GET.' }));

export default router;
