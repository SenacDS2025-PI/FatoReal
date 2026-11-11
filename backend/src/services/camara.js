// Acesso à API de Dados Abertos da Câmara dos Deputados.
// Documentação: https://dadosabertos.camara.leg.br/swagger/api.html
// Ordem de leitura:
// - Lista de deputados: Supabase primeiro (rápido e estável); se vazio ou fora, Câmara.
// - Perfil: Câmara primeiro (mais detalhes); se a Câmara cair, cópia do Supabase.
import { cached } from '../utils/cache.js';
import { CAMARA_API, FONTE_NOME } from './camara-fonte.js';
import { supabaseConfigurado, listarDoSupabase, obterDoSupabase } from './supabase.js';

export { CAMARA_API, FONTE_NOME };

const TIMEOUT_MS = 10_000;
const TENTATIVAS = 2;
// Nos testes (node --test define NODE_TEST_CONTEXT) não espera entre tentativas.
const ESPERA_ENTRE_TENTATIVAS_MS = process.env.NODE_TEST_CONTEXT ? 0 : 1000;
const CACHE_LISTA_MS = 6 * 60 * 60 * 1000; // 6 horas
const CACHE_PERFIL_MS = 60 * 60 * 1000; // 1 hora

export class CamaraError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function buscarJson(caminho) {
  const url = `${CAMARA_API}${caminho}`;
  let ultimoErro;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) throw new CamaraError('Não encontrado na Câmara', 404);
      if (!res.ok) throw new CamaraError(`Câmara respondeu ${res.status}`);
      return { url, json: await res.json() };
    } catch (err) {
      if (err instanceof CamaraError && err.status === 404) throw err;
      ultimoErro = err;
      if (tentativa < TENTATIVAS) await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
    }
  }
  throw new CamaraError(`Falha ao consultar a Câmara: ${ultimoErro?.message}`);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function fonte(url) {
  return { nome: FONTE_NOME, url, consultadoEm: new Date().toISOString() };
}

// Lista todos os deputados em exercício (a API pagina de 100 em 100).
function listarDaCamara() {
  return cached('deputados:lista', CACHE_LISTA_MS, async () => {
    const deputados = [];
    let pagina = 1;
    let primeiraUrl;

    while (true) {
      const { url, json } = await buscarJson(
        `/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=${pagina}`
      );
      primeiraUrl ??= url;
      deputados.push(...json.dados);
      const temProxima = json.links?.some((l) => l.rel === 'next');
      if (!temProxima || json.dados.length === 0) break;
      pagina++;
    }

    return {
      dados: deputados.map((d) => ({
        id: d.id,
        nome: d.nome,
        partido: d.siglaPartido,
        uf: d.siglaUf,
        foto: d.urlFoto,
      })),
      fonte: fonte(`${CAMARA_API}/deputados`),
    };
  });
}

// Perfil de um deputado. Remove dados pessoais desnecessários (ex.: CPF) — LGPD.
function obterDaCamara(id) {
  return cached(`deputados:${id}`, CACHE_PERFIL_MS, async () => {
    const { url, json } = await buscarJson(`/deputados/${id}`);
    const d = json.dados;
    const s = d.ultimoStatus ?? {};

    return {
      dados: {
        id: d.id,
        nome: s.nome,
        nomeCivil: d.nomeCivil,
        partido: s.siglaPartido,
        uf: s.siglaUf,
        foto: s.urlFoto,
        situacao: s.situacao,
        condicaoEleitoral: s.condicaoEleitoral,
        legislatura: s.idLegislatura,
        dataDoStatus: s.data, // data oficial em que a Câmara registrou esta situação
        escolaridade: d.escolaridade,
        ufNascimento: d.ufNascimento,
        municipioNascimento: d.municipioNascimento,
        gabinete: s.gabinete
          ? {
              sala: s.gabinete.sala,
              predio: s.gabinete.predio,
              telefone: s.gabinete.telefone,
              email: s.gabinete.email,
            }
          : null,
        redesSociais: d.redeSocial ?? [],
        site: d.urlWebsite,
      },
      fonte: fonte(url),
    };
  });
}

async function tentarSupabase(fn, ...args) {
  if (!supabaseConfigurado()) return null;
  try {
    return await fn(...args);
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

export async function listarDeputados() {
  const doBanco = await cached('deputados:lista:supabase', CACHE_PERFIL_MS, async () => {
    const r = await tentarSupabase(listarDoSupabase);
    if (!r) throw new Error('sem dados no Supabase');
    return r;
  }).catch(() => null);
  return doBanco ?? listarDaCamara();
}

export async function obterDeputado(id) {
  try {
    return await obterDaCamara(id);
  } catch (err) {
    if (err instanceof CamaraError && err.status === 404) throw err;
    const copia = await tentarSupabase(obterDoSupabase, id);
    if (copia) return copia;
    throw err;
  }
}
