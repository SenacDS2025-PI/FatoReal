// J12 — check-up das fontes do FatoBot, para conferir tudo antes da apresentação.
//
// Nunca devolve chaves: só se cada coisa está configurada e respondendo.
import { pingCamara, infoCopia } from './camara.js';
import { supabaseConfigurado, contarPoliticos, projetoSupabase } from './supabase.js';
import { CARGO_SENADOR } from './senado.js';
import { infoIa, testarIa } from './gemini.js';
import { usoCotaIa } from '../utils/limite.js';
import { comPrazo } from '../utils/prazo.js';
import { cached } from '../utils/cache.js';

const CACHE_MS = 30_000; // no máximo 1 check-up a cada 30s (não sobrecarrega a Câmara)
const PRAZO_SUPABASE_MS = 3_000;
const DIAS_COPIA_ANTIGA = 7;

async function verificarCamara() {
  try {
    return { status: 'ok', ms: await pingCamara() };
  } catch (err) {
    return { status: 'fora', detalhe: err.message };
  }
}

async function verificarSupabase() {
  if (!supabaseConfigurado()) return { status: 'nao_configurado' };
  const inicio = Date.now();
  try {
    const [deputados, senadores] = await comPrazo(
      Promise.all([contarPoliticos(), contarPoliticos(CARGO_SENADOR)]),
      PRAZO_SUPABASE_MS,
      'Supabase não respondeu a tempo'
    );
    return {
      status: deputados > 0 ? 'ok' : 'vazio',
      projeto: projetoSupabase(),
      deputados,
      senadores,
      ms: Date.now() - inicio,
      ...(deputados === 0 && { detalhe: 'Tabela politicos sem deputados: rode npm run importar.' }),
      ...(deputados > 0 && senadores === 0 && { detalhe: 'Sem senadores no banco: rode npm run importar (no Brasil).' }),
    };
  } catch (err) {
    return { status: 'fora', projeto: projetoSupabase(), detalhe: err.message };
  }
}

function verificarCopia() {
  const c = infoCopia();
  if (!c) return { status: 'ausente', detalhe: 'Rode npm run atualizar-deputados.' };
  const dias = Math.floor((Date.now() - Date.parse(c.coletadoEm)) / 86_400_000);
  return {
    status: dias > DIAS_COPIA_ANTIGA ? 'antiga' : 'ok',
    deputados: c.total,
    coletadoEm: c.coletadoEm,
    diasDesdeColeta: dias,
    ...(dias > DIAS_COPIA_ANTIGA && { detalhe: 'Cópia com mais de 7 dias: rode npm run atualizar-deputados.' }),
  };
}

async function verificarGemini(testar) {
  const info = infoIa();
  const resultado = {
    status: info.configurado ? 'configurado' : 'sem_chave',
    modelo: info.modelo,
    reserva: info.reserva,
    cotaLocal: usoCotaIa(),
  };
  if (testar && info.configurado) {
    const teste = await testarIa();
    resultado.status = teste.ok ? 'ok' : 'fora';
    resultado.teste = teste;
  }
  return resultado;
}

// Resumo: "ok" (tudo certo), "parcial" (algo fora, mas o FatoBot ainda responde)
// ou "fora" (sem nenhuma fonte de deputados).
function resumir({ camara, supabase, copia, gemini }) {
  const temDeputados = camara.status === 'ok' || supabase.status === 'ok' || copia.status !== 'ausente';
  if (!temDeputados) return 'fora';
  const tudoCerto =
    camara.status === 'ok' &&
    supabase.status === 'ok' &&
    copia.status === 'ok' &&
    ['ok', 'configurado'].includes(gemini.status);
  return tudoCerto ? 'ok' : 'parcial';
}

export function verificarFontes({ testarGemini = false } = {}) {
  return cached(`saude:${testarGemini}`, CACHE_MS, async () => {
    const [camara, supabase, gemini] = await Promise.all([
      verificarCamara(),
      verificarSupabase(),
      verificarGemini(testarGemini),
    ]);
    const copia = verificarCopia();
    const fontes = { camara, supabase, copiaReserva: copia, gemini };
    return { status: resumir({ camara, supabase, copia, gemini }), verificadoEm: new Date().toISOString(), fontes };
  });
}
