// Busca documental e filtro de evidência (etapas 2 e 3 do pipeline do FatoBot).
//
// Toda evidência tem: id, texto, fonte (nome), url, consultadoEm (ou null) e titulo.
//   D1, D2...  → dados de deputados (API da Câmara)
//   C1         → total de deputados em exercício (API da Câmara)
//   B01...B24  → base de conhecimento (Constituição) em src/data/base-conhecimento.js
import { listarDeputados, obterDeputado, FONTE_NOME } from './camara.js';
import { BASE, CONSTITUICAO } from '../data/base-conhecimento.js';
import { normalizar } from '../utils/texto.js';

const MAX_DEPUTADOS_POR_PERGUNTA = 3;

const limpar = (texto) => ` ${normalizar(texto).replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Descobre quais deputados o texto cita (pelo nome parlamentar completo, com 2+ palavras,
// para "Amaral" sozinho não virar falso positivo).
export function identificarDeputados(texto, lista) {
  const alvo = limpar(texto);
  return lista
    .filter((d) => {
      const nome = limpar(d.nome);
      return nome.trim().includes(' ') && alvo.includes(nome);
    })
    .slice(0, MAX_DEPUTADOS_POR_PERGUNTA);
}

function formatarData(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Transforma o perfil em evidências: cada fato com a sua fonte e data.
export function evidenciasDoPerfil({ dados: p, fonte }) {
  const ref = {
    fonte: fonte.nome,
    url: fonte.url,
    consultadoEm: fonte.consultadoEm,
    titulo: `${fonte.nome}: ${p.nome}`,
  };
  const evidencias = [];
  const add = (texto) => evidencias.push({ texto, ...ref });

  if (p.partido && p.uf) {
    add(`${p.nome} é deputado(a) federal pelo ${p.partido}-${p.uf}.`);
  }
  if (p.situacao) {
    const desde = formatarData(p.dataDoStatus);
    add(
      `Situação de ${p.nome} na Câmara: ${p.situacao}` +
        (p.condicaoEleitoral ? ` (${p.condicaoEleitoral.toLowerCase()})` : '') +
        (desde ? `, registrada em ${desde}.` : '.')
    );
  }
  if (p.legislatura) add(`Legislatura atual de ${p.nome}: ${p.legislatura}ª.`);
  if (p.escolaridade) add(`Escolaridade declarada de ${p.nome}: ${p.escolaridade}.`);
  if (p.municipioNascimento && p.ufNascimento) {
    add(`Naturalidade de ${p.nome}: ${p.municipioNascimento}-${p.ufNascimento}.`);
  }
  if (p.gabinete?.email) add(`E-mail oficial do gabinete de ${p.nome}: ${p.gabinete.email}.`);

  return evidencias;
}

// Itens da base de conhecimento já no formato de evidência.
export const EVIDENCIAS_BASE = BASE.map((b) => ({
  id: b.id,
  texto: `${b.titulo}: ${b.texto}`,
  fonte: CONSTITUICAO.nome,
  url: CONSTITUICAO.url,
  consultadoEm: null,
  titulo: `${CONSTITUICAO.nome}, ${b.artigo}`,
  artigo: b.artigo,
  palavras: b.palavras,
}));

const PALAVRAS_TOTAL = ['quantos deputados', 'numero de deputados', 'total de deputados', 'quantos parlamentares'];

const citaAlguma = (texto, palavras) => palavras.some((p) => limpar(texto).includes(limpar(p)));

/**
 * Coleta as evidências ligadas a um texto (pergunta ou afirmação).
 * Devolve { dinamicas, base, falhaCamara }:
 *  - dinamicas: evidências da Câmara (deputados citados e total em exercício)
 *  - base: itens da Constituição cujas palavras-chave aparecem no texto
 *    (usado quando a IA está desligada; com IA, a base inteira vai nas instruções)
 *  - falhaCamara: true se a Câmara não respondeu (o FatoBot segue só com a base)
 */
export async function coletarEvidencias(texto) {
  const dinamicas = [];
  let falhaCamara = false;

  try {
    const { dados: lista, fonte } = await listarDeputados();

    dinamicas.push({
      id: 'C1',
      texto: `Total de deputados federais em exercício hoje, segundo a Câmara: ${lista.length}.`,
      fonte: FONTE_NOME,
      url: fonte.url,
      consultadoEm: fonte.consultadoEm,
      titulo: `${FONTE_NOME}: lista de deputados em exercício`,
      palavras: PALAVRAS_TOTAL,
    });

    const citados = identificarDeputados(texto, lista);
    const perfis = await Promise.all(citados.map((d) => obterDeputado(d.id)));
    perfis
      .flatMap(evidenciasDoPerfil)
      .forEach((e, i) => dinamicas.push({ id: `D${i + 1}`, ...e }));
  } catch (err) {
    falhaCamara = true;
    console.error('[evidencias] Câmara indisponível:', err.message);
  }

  const base = EVIDENCIAS_BASE.filter((e) => citaAlguma(texto, e.palavras));
  return { dinamicas, base, falhaCamara };
}

// Evidências relevantes quando não há IA para escolher: deputados citados,
// total (se perguntaram) e itens da base que batem com as palavras-chave.
export function evidenciasSemIA(texto, { dinamicas, base }) {
  return [
    ...dinamicas.filter((e) => e.id.startsWith('D')),
    ...dinamicas.filter((e) => e.id === 'C1' && citaAlguma(texto, e.palavras)),
    ...base,
  ];
}

// Texto com as evidências, para enviar à IA.
export function formatarEvidencias(evidencias) {
  return evidencias.map((e) => `[${e.id}] ${e.texto} (Fonte: ${e.titulo})`).join('\n');
}

// Lista de referências no formato que o front espera: { titulo, url, data }.
// Junta evidências da mesma página em uma referência só (o front usa a URL como chave).
// Ex.: vários artigos da Constituição viram "Constituição Federal de 1988, art. 45; art. 46".
export function paraFontes(evidencias) {
  const porUrl = new Map();
  for (const e of evidencias) {
    const atual = porUrl.get(e.url);
    if (!atual) {
      porUrl.set(e.url, { fonte: e.fonte, titulo: e.titulo, url: e.url, data: e.consultadoEm, artigos: e.artigo ? [e.artigo] : [] });
    } else if (e.artigo && !atual.artigos.includes(e.artigo)) {
      atual.artigos.push(e.artigo);
    }
  }
  return [...porUrl.values()].map(({ fonte, titulo, url, data, artigos }) => ({
    titulo: artigos.length > 1 ? `${fonte}, ${artigos.join('; ')}` : titulo,
    url,
    data,
  }));
}

// Remove campos internos antes de devolver as evidências na resposta da API.
export function semCamposInternos(evidencias) {
  return evidencias.map(({ palavras, artigo, ...resto }) => resto); // eslint-disable-line no-unused-vars
}
