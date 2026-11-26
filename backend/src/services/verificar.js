// Verificação de afirmações — os 5 estados do Quadro 3 da documentação.
//
// Usa as mesmas fontes do FatoBot (dados oficiais dos deputados) e o Gemini só para
// CLASSIFICAR com base nessas evidências. Regras que não dependem da IA:
// - Sem fonte relacionada → "Evidência insuficiente" (ausência de evidência ≠ falsidade).
// - Sem IA disponível → "Em análise" (não confirma nem nega sozinho).
// - O link enviado NÃO é acessado nem usado como fonte (só fontes oficiais contam).
// - Anexos NÃO são analisados nem guardados (análise de mídia precisa de revisão humana).
import { buscarEvidencias, AVISO, LIMITES_FATOBOT, textoOndeConferir } from './fatobot.js';
import { sugerirFontes } from '../data/fontes-oficiais.js';
import { SEM_LOG } from '../utils/log-verificar.js';
import { classificarComIA } from './gemini.js';

export const ESTADOS = {
  sustentam: 'Evidências sustentam',
  contradizem: 'Evidências contradizem',
  fora_de_contexto: 'Fora de contexto',
  insuficiente: 'Evidência insuficiente',
  em_analise: 'Em análise',
};

const TEXTO_INSUFICIENTE =
  'Não encontrei nas fontes oficiais que consulto informação suficiente para confirmar ou negar essa afirmação. ' +
  'Por enquanto, a verificação automática cobre deputados federais e senadores em exercício, presidente, governadores, ' +
  'prefeitos e vereadores eleitos e regras básicas da Constituição. ' +
  'Ausência de evidência não é prova de falsidade.';

// J13: texto honesto sobre anexos. Eles NÃO são analisados nem guardados, então não
// prometemos revisão humana (não existe fila de revisão de anexos no MVP).
const DICA_ANEXOS =
  'Para checar fotos, vídeos e documentos, procure a publicação original ou uma agência de checagem.';

function observacoes({ link, anexos, anexosAcimaDoLimite }) {
  const obs = [];
  if (link) obs.push('O link enviado não é usado como fonte: a verificação considera só fontes oficiais.');
  if (anexosAcimaDoLimite) {
    obs.push(`Os anexos passaram do tamanho permitido e não foram recebidos. ${DICA_ANEXOS}`);
  } else if (anexos > 0) {
    obs.push(
      `${anexos === 1 ? 'O anexo não foi analisado nem guardado' : `Os ${anexos} anexos não foram analisados nem guardados`}: ` +
        `a verificação automática usa só o texto da afirmação. ${DICA_ANEXOS}`
    );
  }
  return obs;
}

export async function verificar({ afirmacao, link = null, anexos = 0, anexosAcimaDoLimite = false, log = SEM_LOG }) {
  const prazo = Date.now() + LIMITES_FATOBOT.totalMs; // J2: mesmo prazo total do FatoBot
  const consultado_em = new Date().toISOString();
  const extra = observacoes({ link, anexos, anexosAcimaDoLimite });
  const montar = (estado, explicacao, fontes = []) => ({
    estado: ESTADOS[estado],
    explicacao: [explicacao, ...extra].join(' '),
    fontes,
    consultado_em,
    aviso: AVISO,
  });

  // Deputados citados + Constituição (J11), as mesmas fontes do FatoBot.
  log.info('3. buscando evidências nas fontes oficiais');
  const { evidencias, fontes } = await buscarEvidencias(afirmacao);
  log.info('3. evidências encontradas', {
    total: evidencias.length,
    fontes: [...new Set(evidencias.map((e) => e.fonte))],
  });
  if (evidencias.length === 0) {
    const sugestoes = sugerirFontes(afirmacao);
    log.info('5. sem evidência → "Evidência insuficiente"', { ondeConferir: sugestoes.map((f) => f.nome) });
    return { ...montar('insuficiente', TEXTO_INSUFICIENTE + textoOndeConferir(sugestoes)), onde_conferir: sugestoes };
  }

  log.info('4. pedindo a classificação para a IA (Gemini)', { tempoRestanteMs: prazo - Date.now() });
  const resultado = await classificarComIA(afirmacao, evidencias, { prazo });
  if (!resultado && !process.env.GEMINI_API_KEY) {
    console.warn('Verificar: GEMINI_API_KEY não configurada (confira o arquivo .env)');
  }
  log.info('4. resposta da IA', resultado ? { estado: resultado.estado, comExplicacao: Boolean(resultado.explicacao) } : {
    estado: null,
    motivo: process.env.GEMINI_API_KEY ? 'IA indisponível (erro, cota, tempo ou formato; ver avisos do Gemini acima)' : 'sem GEMINI_API_KEY',
  });

  if (!resultado) {
    log.aviso('5. sem IA → "Em análise" (só os fatos das fontes)');
    const fatos = evidencias.map((e) => e.texto).join(' ');
    return montar(
      'em_analise',
      `A verificação automática não está disponível agora, então a afirmação fica em análise. ` +
        `Fatos encontrados nas fontes oficiais: ${fatos}`,
      fontes
    );
  }

  log.info('5. resultado', { estado: ESTADOS[resultado.estado] });
  return montar(resultado.estado, resultado.explicacao ?? TEXTO_INSUFICIENTE, fontes);
}
