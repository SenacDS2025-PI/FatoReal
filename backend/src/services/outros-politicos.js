// Evidências sobre políticos que NÃO são deputados federais, para o FatoBot e o Fato ou Fake:
// - Senadores: Supabase (cópia do Senado) → API do Senado ao vivo.
// - Presidente, Governadores, Prefeitos e Vereadores: Supabase (eleitos do TSE, ver scripts/importar-tse.js).
//
// O que a pessoa pode perguntar:
//   "Quem é Fulano de Tal?"           (senador, governador, vice ou presidente, pelo nome completo)
//   "Quem são os senadores de Minas Gerais?"  "Quantos senadores existem?"
//   "Quem é o governador de SP?"      "Quem é o presidente da República?"
//   "Quem é o prefeito de Campinas?"  "Quem são os vereadores de Recife - PE?"
//
// Regra de honestidade: o TSE mostra quem FOI ELEITO, não quem está no cargo hoje
// (pode ter havido cassação, renúncia ou posse do vice). O texto diz "conquistou, na eleição de ...".
// Sem "(a)" no texto: não guardamos o gênero, então as frases são neutras.
// Nada aqui lança erro para o FatoBot: se uma fonte falhar, só não entra evidência dela.
import { cached } from '../utils/cache.js';
import { comPrazo } from '../utils/prazo.js';
import { normalizar } from '../utils/texto.js';
import { citadosNaPergunta } from '../utils/nomes.js';
import { supabaseConfigurado, consultarPoliticos } from './supabase.js';
import { CARGO_SENADOR, FONTE_SENADO_NOME, buscarSenadoresDaApi } from './senado.js';
import { FONTE_TSE_NOME } from './tse.js';

const PRAZO_MS = 3_000;
const CACHE_MS = 60 * 60 * 1000; // 1 hora
const MAX_NOMES = 10; // vereadores listados por cidade
const MAX_CITADOS = 3;

export const ESTADOS = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};
// Nomes mais longos primeiro ("mato grosso do sul" antes de "mato grosso").
const NOMES_ESTADOS = Object.entries(ESTADOS)
  .map(([uf, nome]) => [normalizar(nome), uf])
  .sort((a, b) => b[0].length - a[0].length);

const limpar = (t) => ` ${normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;

// "... de minas gerais" / "... de sp" / "... do rio de janeiro" → "MG" / "SP" / "RJ"
export function ufDoTexto(trecho) {
  const t = limpar(trecho);
  for (const [nome, uf] of NOMES_ESTADOS) if (t.includes(` ${nome} `)) return uf;
  const sigla = t.match(/ (?:de|do|da|no|na|em) ([a-z]{2}) /);
  return sigla && ESTADOS[sigla[1].toUpperCase()] ? sigla[1].toUpperCase() : null;
}

// "quem é o prefeito de São José dos Campos - SP?" → { cidade: 'sao jose dos campos', uf: 'SP' }
export function cidadeDoTexto(texto) {
  const m = normalizar(texto).match(
    /\b(?:prefeit[oa]s?|vice[- ]prefeit[oa]s?|vereador(?:a|es|as)?)\s+(?:atual\s+)?(?:de|do|da|em|no|na)\s+([a-z' -]+?)(?:\s*[-/(,]\s*([a-z]{2})\)?)?\s*(?:[?.!]|$|\s+(?:em|eleit|hoje|atual|agora)\b)/
  );
  if (!m) return null;
  const cidade = m[1].replace(/\s+/g, ' ').trim();
  const uf = m[2] && ESTADOS[m[2].toUpperCase()] ? m[2].toUpperCase() : null;
  return cidade.length >= 3 ? { cidade, uf } : null;
}

const anoDe = (p) => String(p.situacao ?? p.fonte_url ?? '').match(/(20\d{2})/)?.[1] ?? null;

function dataBr(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const doTse = (p) => p.cargo !== CARGO_SENADOR;

function fonteDe(p) {
  if (doTse(p)) {
    return { nome: `${FONTE_TSE_NOME} (candidatos eleitos em ${anoDe(p)})`, url: p.fonte_url, consultadoEm: p.data_coleta };
  }
  const copia = p.copia ? ` (cópia salva em ${dataBr(p.data_coleta)})` : '';
  return { nome: `${FONTE_SENADO_NOME}${copia}`, url: p.fonte_url, consultadoEm: p.data_coleta };
}

// Preposição certa de cada estado: "da Bahia", "do Rio de Janeiro", "de São Paulo".
export const PREP_ESTADO = {
  AC: 'do', AL: 'de', AP: 'do', AM: 'do', BA: 'da', CE: 'do', DF: 'do', ES: 'do', GO: 'de', MA: 'do',
  MT: 'de', MS: 'de', MG: 'de', PA: 'do', PB: 'da', PR: 'do', PE: 'de', PI: 'do', RJ: 'do', RN: 'do',
  RS: 'do', RO: 'de', RR: 'de', SC: 'de', SP: 'de', SE: 'de', TO: 'do',
};
// "BA" → "da Bahia"; sigla desconhecida → "de XX".
export const doEstado = (uf) => `${PREP_ESTADO[uf] ?? 'de'} ${ESTADOS[uf] ?? uf}`;
const cidadeDe = (p) => `${p.municipio}-${p.uf}`;

// O que a pessoa conquistou na eleição, sem "(a)": "a prefeitura de Campinas-SP".
const VAGA = {
  Presidente: () => 'a Presidência da República',
  'Vice-presidente': () => 'a Vice-Presidência da República',
  'Governador(a)': (p) => `o governo ${doEstado(p.uf)}`,
  'Vice-governador(a)': (p) => `a vice-governadoria ${doEstado(p.uf)}`,
  'Deputado(a) Estadual': (p) => (p.uf === 'DF' ? 'uma vaga na Câmara Legislativa do Distrito Federal' : `uma vaga na Assembleia Legislativa ${doEstado(p.uf)}`),
  'Prefeito(a)': (p) => `a prefeitura de ${cidadeDe(p)}`,
  'Vice-prefeito(a)': (p) => `a vice-prefeitura de ${cidadeDe(p)}`,
  'Vereador(a)': (p) => `uma vaga na Câmara Municipal de ${cidadeDe(p)}`,
};
export const vagaDe = (p) => (VAGA[p.cargo] ?? (() => `o cargo de ${p.cargo}`))(p);

// Um político → uma evidência (texto + fonte).
export function evidenciaDe(p) {
  const f = fonteDe(p);
  const partido = p.partido ? ` (${p.partido})` : '';
  const texto = doTse(p)
    ? `${p.nome}${partido} conquistou ${vagaDe(p)} na eleição de ${anoDe(p)}, segundo o TSE.`
    : `${p.nome} tem mandato no Senado Federal pelo ${p.partido}-${p.uf}.`;
  return { texto, fonte: f.nome, url: f.url, consultadoEm: f.consultadoEm };
}

async function tentar(fn) {
  try {
    return await comPrazo(fn(), PRAZO_MS, 'fonte não respondeu a tempo');
  } catch (err) {
    console.warn(`FatoBot (outros políticos): ${err.message}`);
    return null;
  }
}

// Se as duas fontes de senadores falharam há pouco, não espera de novo por 1 minuto.
const PAUSA_APOS_FALHA_MS = 60_000;
let senadoresFalharamEm = 0;
export function _resetOutros() {
  senadoresFalharamEm = 0;
}

// Senadores: Supabase → API do Senado.
export function listarSenadores() {
  if (Date.now() - senadoresFalharamEm < PAUSA_APOS_FALHA_MS) return Promise.resolve([]);
  return cached('outros:senadores', CACHE_MS, async () => {
    if (supabaseConfigurado()) {
      const doBanco = await tentar(() => consultarPoliticos({ cargos: [CARGO_SENADOR] }));
      if (doBanco?.length) return doBanco.map((s) => ({ ...s, copia: true }));
    }
    const daApi = await tentar(() => buscarSenadoresDaApi(PRAZO_MS));
    if (daApi?.length) return daApi;
    throw new Error('sem senadores agora');
  }).catch(() => {
    senadoresFalharamEm = Date.now();
    return [];
  });
}

// Cargos com poucas pessoas (cabem na memória para achar pelo nome).
const CARGOS_PEQUENOS = ['Presidente', 'Vice-presidente', 'Governador(a)', 'Vice-governador(a)'];
function listarCargosPequenos() {
  if (!supabaseConfigurado()) return Promise.resolve([]);
  return cached('outros:cargos-pequenos', CACHE_MS, async () => {
    const r = await tentar(() => consultarPoliticos({ cargos: CARGOS_PEQUENOS, limite: 500 }));
    if (!r) throw new Error('sem dados');
    return r;
  }).catch(() => []);
}

function citados(pergunta, lista) {
  return citadosNaPergunta(pergunta, lista, MAX_CITADOS);
}

function fontesDe(evidencias) {
  const vistas = new Map();
  for (const e of evidencias) {
    const chave = `${e.fonte}|${e.url}`;
    if (!vistas.has(chave)) vistas.set(chave, { titulo: e.fonte, url: e.url, data: e.consultadoEm });
  }
  return [...vistas.values()];
}

async function municipais(pergunta) {
  const alvo = cidadeDoTexto(pergunta);
  if (!alvo || !supabaseConfigurado()) return [];
  const t = normalizar(pergunta);
  const cargos = /vereador/.test(t) ? ['Vereador(a)'] : /vice/.test(t) ? ['Vice-prefeito(a)'] : ['Prefeito(a)'];
  const r = (await tentar(() => consultarPoliticos({ cargos, uf: alvo.uf, municipioBusca: alvo.cidade, limite: 200 }))) ?? [];
  if (cargos[0] !== 'Vereador(a)' || r.length <= MAX_NOMES) return r.map(evidenciaDe);

  // Muitos vereadores: um resumo por cidade, com alguns nomes.
  const porCidade = new Map();
  for (const v of r) {
    const k = `${v.municipio}-${v.uf}`;
    porCidade.set(k, [...(porCidade.get(k) ?? []), v]);
  }
  return [...porCidade.entries()].map(([lugar, vs]) => {
    const f = fonteDe(vs[0]);
    const nomes = vs.slice(0, MAX_NOMES).map((v) => `${v.nome} (${v.partido})`).join(', ');
    return {
      texto: `Na eleição de ${anoDe(vs[0])}, o TSE registra ${vs.length} vereadores eleitos em ${lugar}. Alguns deles: ${nomes}.`,
      fonte: f.nome,
      url: f.url,
      consultadoEm: f.consultadoEm,
    };
  });
}

// Tudo junto: devolve { evidencias, fontes } (listas vazias se nada servir).
export async function evidenciasDeOutrosPoliticos(pergunta) {
  const t = normalizar(pergunta);
  const querSenado = /senador/.test(t);
  const querGoverno = /governador/.test(t);
  const querPresidente = /presidente (da republica|do brasil)/.test(t);

  const [senadores, pequenos, deMunicipio] = await Promise.all([listarSenadores(), listarCargosPequenos(), municipais(pergunta)]);
  const evidencias = [];
  const add = (lista) => {
    for (const p of lista) if (!evidencias.some((e) => e.texto === evidenciaDe(p).texto)) evidencias.push(evidenciaDe(p));
  };

  // 1. Pelo nome completo (senadores, governadores, vices e presidente).
  const porNome = citados(pergunta, [...senadores, ...pequenos]);
  add(porNome);

  // 2. Por cargo + estado.
  const uf = ufDoTexto(pergunta);
  if (querSenado && uf) add(senadores.filter((s) => s.uf === uf));
  if (querGoverno && uf) add(pequenos.filter((p) => p.uf === uf && p.cargo.includes('overnador') && (t.includes('vice') || !p.cargo.startsWith('Vice'))));
  if (querPresidente) add(pequenos.filter((p) => p.cargo === 'Presidente' || (t.includes('vice') && p.cargo === 'Vice-presidente')));

  // 3. "Quantos senadores existem?"
  if (/\b(quantos|numero de|total de|quantidade de) senador/.test(t) && senadores.length) {
    const f = fonteDe(senadores[0]);
    evidencias.push({ texto: `Há ${senadores.length} senadores em exercício.`, fonte: f.nome, url: f.url, consultadoEm: f.consultadoEm });
  }

  // 4. Prefeitos e vereadores pela cidade.
  for (const e of deMunicipio) if (!evidencias.some((x) => x.texto === e.texto)) evidencias.push(e);

  // `candidatos`: para o "Você quis dizer...?" quando a pergunta só traz o sobrenome.
  // `senadoresCitados`: para o FatoBot buscar a atuação (projetos e votações) de cada um.
  return {
    evidencias,
    fontes: fontesDe(evidencias),
    candidatos: [...senadores, ...pequenos],
    senadoresCitados: porNome.filter((p) => p.cargo === CARGO_SENADOR),
  };
}
