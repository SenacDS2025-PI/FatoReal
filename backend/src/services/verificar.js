// Verificação de afirmações — os 5 estados do Quadro 3 da documentação.
//
// Usa as mesmas fontes do FatoBot (dados oficiais dos deputados) e o Gemini só para
// CLASSIFICAR com base nessas evidências. Regras que não dependem da IA:
// - Sem fonte relacionada → "Evidência insuficiente" (ausência de evidência ≠ falsidade).
// - Sem IA disponível → "Em análise" (não confirma nem nega sozinho).
// - O link enviado NÃO é acessado nem usado como fonte (só fontes oficiais contam).
// - Anexos NÃO são analisados nem guardados (análise de mídia precisa de revisão humana).
import { identificarDeputados, evidenciasDosDeputados, AVISO } from './fatobot.js';
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
  'Por enquanto, a verificação automática cobre dados dos deputados federais em exercício. ' +
  'Ausência de evidência não é prova de falsidade.';

function observacoes({ link, anexos }) {
  const obs = [];
  if (link) obs.push('O link enviado não é usado como fonte: a verificação considera só fontes oficiais.');
  if (anexos > 0) {
    obs.push(
      `${anexos === 1 ? 'O anexo enviado não foi analisado' : `Os ${anexos} anexos enviados não foram analisados`} ` +
        'nem guardado(s): fotos, vídeos e documentos precisam de revisão humana.'
    );
  }
  return obs;
}

export async function verificar({ afirmacao, link = null, anexos = 0 }) {
  const consultado_em = new Date().toISOString();
  const extra = observacoes({ link, anexos });
  const montar = (estado, explicacao, fontes = []) => ({
    estado: ESTADOS[estado],
    explicacao: [explicacao, ...extra].join(' '),
    fontes,
    consultado_em,
    aviso: AVISO,
  });

  const deputados = await identificarDeputados(afirmacao);
  if (deputados.length === 0) return montar('insuficiente', TEXTO_INSUFICIENTE);

  const { evidencias, fontes } = await evidenciasDosDeputados(deputados);
  const resultado = await classificarComIA(afirmacao, evidencias);

  if (!resultado) {
    const fatos = evidencias.map((e) => e.texto).join(' ');
    return montar(
      'em_analise',
      `A verificação automática não está disponível agora, então a afirmação fica em análise. ` +
        `Fatos encontrados nas fontes oficiais: ${fatos}`,
      fontes
    );
  }

  return montar(resultado.estado, resultado.explicacao ?? TEXTO_INSUFICIENTE, fontes);
}
