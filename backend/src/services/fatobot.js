// FatoBot — responde SOMENTE com base em fontes oficiais (RN02 e RN04).
//
// Pipeline (documentação v2, Figura 4):
//   1. Pergunta  →  2. Busca documental  →  3. Filtro de evidência
//   →  4. Síntese  →  5. Exibição com fontes e aviso
//
// A etapa 4 usa o Gemini (src/services/gemini.js), que recebe APENAS as evidências
// encontradas e precisa citá-las. Se a chave não estiver configurada, se o Gemini
// disser que as evidências não bastam ou se a resposta vier sem citações válidas,
// o FatoBot responde no modo "somente_fontes": só a lista de fatos, sem IA.
import { listarDeputados, obterDeputado } from './camara.js';
import { sintetizarComIA } from './gemini.js';
import { buscarNaBase, evidenciasDaBase, fontesDaBase } from './base.js';
import { normalizar } from '../utils/texto.js';
import { citadosNaPergunta, sugestoesDeNome } from '../utils/nomes.js';
import { evidenciasDeOutrosPoliticos } from './outros-politicos.js';
import { atuacaoDeputado, atuacaoSenador, CONFIG_ATUACAO } from './atuacao.js';
import { sugerirFontes } from '../data/fontes-oficiais.js';

export const AVISO =
  'O FatoBot pode errar. Confira sempre as fontes oficiais. ' +
  'Não encontrar evidência não significa que a informação é falsa.';

const MAX_DEPUTADOS_POR_PERGUNTA = 3;

// Etapa 2a: descobre quais deputados a pergunta cita (pelo nome parlamentar completo).
export async function identificarDeputados(pergunta) {
  const { dados } = await listarDeputados();
  return deputadosCitados(pergunta, dados);
}

function deputadosCitados(pergunta, dados) {
  return citadosNaPergunta(pergunta, dados, MAX_DEPUTADOS_POR_PERGUNTA);
}

function formatarData(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Usa o gênero que a Câmara informa; sem essa informação (cópia de reserva), frase neutra.
export function mandatoNaCamara(sexo) {
  if (sexo === 'F') return 'é deputada federal';
  if (sexo === 'M') return 'é deputado federal';
  return 'tem mandato na Câmara dos Deputados';
}

// Etapa 3: transforma o perfil em evidências — cada fato com a sua fonte e data.
export function evidenciasDoPerfil({ dados: p, fonte }) {
  const ref = { fonte: fonte.nome, url: fonte.url, consultadoEm: fonte.consultadoEm };
  const evidencias = [];
  const add = (texto) => evidencias.push({ texto, ...ref });

  if (p.partido && p.uf) {
    add(`${p.nome} ${mandatoNaCamara(p.sexo)} pelo ${p.partido}-${p.uf}.`);
  }
  if (p.situacao) {
    const desde = formatarData(p.dataDoStatus);
    add(
      `Situação na Câmara: ${p.situacao}` +
        (p.condicaoEleitoral ? ` (${p.condicaoEleitoral.toLowerCase()})` : '') +
        (desde ? `, registrada em ${desde}.` : '.')
    );
  }
  if (p.legislatura) add(`Legislatura atual: ${p.legislatura}ª.`);
  if (p.escolaridade) add(`Escolaridade declarada: ${p.escolaridade}.`);
  if (p.municipioNascimento && p.ufNascimento) {
    add(`Naturalidade: ${p.municipioNascimento}-${p.ufNascimento}.`);
  }
  if (p.gabinete?.email) add(`E-mail oficial do gabinete: ${p.gabinete.email}.`);

  return evidencias;
}

// Etapas 2b e 3: busca o perfil de cada deputado e monta evidências e fontes.
// Formato das fontes = o que o front usa (frontend/src/app/core/modelos.ts → Fonte).
export async function evidenciasDosDeputados(deputados) {
  const perfis = await Promise.all(deputados.map((d) => obterDeputado(d.id)));
  return {
    evidencias: perfis.flatMap(evidenciasDoPerfil),
    fontes: perfis.map(({ dados, fonte }) => ({
      titulo: `${fonte.nome}: ${dados.nome}`,
      url: fonte.url,
      data: fonte.consultadoEm,
    })),
  };
}

// Atuação no mandato (projetos, leis, votações, gastos, registros verificados) — ver atuacao.js.
// Só para os 2 primeiros políticos citados, para não estourar o tempo da resposta.
const MAX_ATUACAO = 2;
async function evidenciasDeAtuacao(politicos, buscar, pagina, casa) {
  if (!CONFIG_ATUACAO.ligada) return { evidencias: [], fontes: [] };
  const listas = await Promise.all(politicos.map((p) => buscar(p).catch((e) => (console.warn(`FatoBot (atuação): ${e.message}`), []))));
  return {
    evidencias: listas.flat(),
    fontes: politicos
      .filter((_, i) => listas[i].length)
      .map((p) => ({ titulo: `${casa}: atuação de ${p.nome} no mandato`, url: pagina(p), data: new Date().toISOString() })),
  };
}

// J2 — prazo total de uma pergunta. Câmara/Supabase usam até ~14s no pior caso
// (ver LIMITES em camara.js); o Gemini usa só o que sobrar até aqui.
export const LIMITES_FATOBOT = { totalMs: 24_000 };

export const SEM_EVIDENCIA_TEXTO = 'Não encontrei evidência para isso.';

// J7 — por que a resposta veio sem IA, em linguagem simples.
const EXPLICACAO_SEM_IA = {
  cota_esgotada: 'A IA atingiu o limite de uso gratuito por agora, então mostro só os fatos das fontes oficiais:',
  limite_local: 'A IA atingiu o limite de uso por agora, então mostro só os fatos das fontes oficiais:',
  sobrecarregado: 'A IA está sobrecarregada agora, então mostro só os fatos das fontes oficiais:',
  tempo_esgotado: 'A IA demorou demais para responder, então mostro só os fatos das fontes oficiais:',
};
const EXPLICACAO_PADRAO = 'Encontrei estas informações nas fontes oficiais:';

// J11 — "Quantos deputados existem?": o número vem da lista oficial, não de memória.
const PERGUNTA_TOTAL = /\b(quantos|numero de|total de|quantidade de) deputad/;

// Etapas 2 e 3 completas: deputados citados + total de deputados + outros políticos
// (senadores, presidente, governadores, prefeitos e vereadores) + Constituição.
// Se a Câmara estiver fora e sem cópia, a pergunta ainda pode ser respondida pelas outras
// fontes; só falha (503) se não houver NENHUMA evidência.
export async function buscarEvidencias(texto) {
  const itensBase = buscarNaBase(texto);
  const outros = evidenciasDeOutrosPoliticos(texto); // roda junto com a Câmara
  const evidencias = [];
  const fontes = [];
  let erroCamara = null;
  let deputadosDaLista = [];

  try {
    const lista = await listarDeputados();
    deputadosDaLista = lista.dados;
    const deputados = deputadosCitados(texto, lista.dados);
    if (deputados.length) {
      // Perfil + atuação (projetos, leis, votações, gastos) ao mesmo tempo.
      const [dep, atuacao] = await Promise.all([
        evidenciasDosDeputados(deputados),
        evidenciasDeAtuacao(deputados.slice(0, MAX_ATUACAO), atuacaoDeputado, (d) => `https://www.camara.leg.br/deputados/${d.id}`, 'Dados Abertos da Câmara'),
      ]);
      evidencias.push(...dep.evidencias, ...atuacao.evidencias);
      fontes.push(...dep.fontes, ...atuacao.fontes);
    }
    if (PERGUNTA_TOTAL.test(normalizar(texto))) {
      const { fonte } = lista;
      evidencias.push({
        texto: `Há ${lista.dados.length} deputados federais em exercício.`,
        fonte: fonte.nome,
        url: fonte.url,
        consultadoEm: fonte.consultadoEm,
      });
      fontes.push({ titulo: `${fonte.nome}: deputados em exercício`, url: fonte.url, data: fonte.consultadoEm });
    }
  } catch (err) {
    erroCamara = err;
  }

  const op = await outros;
  evidencias.push(...op.evidencias);
  fontes.push(...op.fontes);
  if (op.senadoresCitados?.length) {
    const atuacao = await evidenciasDeAtuacao(
      op.senadoresCitados.slice(0, MAX_ATUACAO),
      atuacaoSenador,
      (s) => `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${s.id}`,
      'Senado Federal'
    );
    evidencias.push(...atuacao.evidencias);
    fontes.push(...atuacao.fontes);
  }

  if (erroCamara) {
    if (itensBase.length === 0 && op.evidencias.length === 0) throw erroCamara;
    console.warn(`FatoBot: sem dados da Câmara agora (${erroCamara.message}); usando as outras fontes.`);
  }

  // Já achou um político: da Constituição, só o que bateu com palavra específica (não "deputado").
  const itensUsados = evidencias.length ? itensBase.filter((i) => i.forte) : itensBase;
  evidencias.push(...evidenciasDaBase(itensUsados));
  fontes.push(...fontesDaBase(itensUsados));
  // Nada pelo nome completo: procura pelo sobrenome só para sugerir ("Você quis dizer...?").
  const sugestoes = evidencias.length
    ? []
    : sugestoesDeNome(texto, [...deputadosDaLista.map((d) => ({ ...d, cargo: 'Deputado(a) Federal' })), ...op.candidatos]).map(
        (p) => ({ nome: p.nome, descricao: [p.cargo, p.partido && p.uf ? `${p.partido}-${p.uf}` : p.partido].filter(Boolean).join(', ') })
      );
  return { evidencias, fontes, sugestoes };
}

// "Você quis dizer: Fulano (Senador(a), PL-RJ) ou Beltrano (...)? Pergunte com o nome completo..."
export function textoVoceQuisDizer(sugestoes) {
  if (!sugestoes?.length) return '';
  const lista = sugestoes.map((s) => (s.descricao ? `${s.nome} (${s.descricao})` : s.nome)).join('; ');
  return ` Não encontrei esse nome completo. Você quis dizer: ${lista}? Pergunte com o nome completo, ex.: "Quem é ${sugestoes[0].nome}?".`;
}

export const TEXTO_SEM_EVIDENCIA =
  'Não encontrei evidência nas fontes oficiais que consulto para responder a essa pergunta. ' +
  'Consigo responder sobre deputados federais e senadores em exercício, presidente, governadores, ' +
  'prefeitos e vereadores eleitos (ex.: "Quem é Tabata Amaral?", "Quem é o prefeito de Campinas?", ' +
  '"Quem são os senadores de Minas Gerais?") e sobre regras básicas da Constituição ' +
  '(ex.: "O que são os Três Poderes?").';

// "Você pode conferir em: Portal da Transparência (https://...), TCU (https://...)."
export function textoOndeConferir(sugestoes) {
  if (!sugestoes.length) return '';
  return ` Você pode conferir em: ${sugestoes.map((f) => `${f.nome} (${f.url})`).join('; ')}.`;
}

export async function responder(pergunta) {
  const prazo = Date.now() + LIMITES_FATOBOT.totalMs;
  const { evidencias, fontes, sugestoes: quisDizer } = await buscarEvidencias(pergunta);

  // Sem documento relacionado → declara incerteza em vez de especular (RN04)
  // e indica onde a pessoa pode conferir (links oficiais, NÃO usados como evidência).
  if (evidencias.length === 0) {
    const sugestoes = sugerirFontes(pergunta);
    return {
      pergunta,
      tipo: 'sem_evidencia',
      modo: 'somente_fontes',
      resposta: TEXTO_SEM_EVIDENCIA + textoVoceQuisDizer(quisDizer) + textoOndeConferir(sugestoes),
      voce_quis_dizer: quisDizer,
      evidencias: [],
      fontes: [],
      onde_conferir: sugestoes,
      consultado_em: new Date().toISOString(),
      sem_evidencia: true,
      aviso: AVISO,
    };
  }

  const ia = await sintetizarComIA(pergunta, evidencias, { prazo });
  const base = { pergunta, evidencias, consultado_em: new Date().toISOString(), aviso: AVISO };

  // Resposta do Gemini, com citação válida em toda frase.
  if (ia.texto) {
    return { ...base, tipo: 'fontes_encontradas', modo: 'ia_com_fontes', resposta: ia.texto, fontes, sem_evidencia: false };
  }

  // J6 — o Gemini disse que as evidências não respondem à pergunta. Os fatos do perfil
  // vão só como contexto (separados), para não parecer que respondem à pergunta.
  if (ia.semEvidencia) {
    return {
      ...base,
      tipo: 'sem_evidencia',
      modo: 'ia_sem_evidencia',
      resposta: SEM_EVIDENCIA_TEXTO,
      fontes: [],
      sem_evidencia: true,
      contexto: {
        aviso: 'Fatos do perfil consultado, só como contexto: eles não respondem à pergunta.',
        fatos: evidencias.map((e) => e.texto),
        fontes,
      },
    };
  }

  // Sem IA (chave, cota, sobrecarga, tempo ou citação inválida): só os fatos das fontes.
  return {
    ...base,
    tipo: 'fontes_encontradas',
    modo: 'somente_fontes',
    motivo_sem_ia: ia.falha,
    resposta:
      (EXPLICACAO_SEM_IA[ia.falha] ?? EXPLICACAO_PADRAO) + '\n' + evidencias.map((e) => `• ${e.texto}`).join('\n'),
    fontes,
    sem_evidencia: false,
  };
}
