// Acesso à API de Dados Abertos da Câmara dos Deputados.
// Documentação: https://dadosabertos.camara.leg.br/swagger/api.html
//
// Ordem de leitura (para o FatoBot funcionar mesmo com a Câmara fora do ar):
// - Lista de deputados: Supabase → Câmara → cópia de reserva (src/data/deputados.json).
// - Perfil: Câmara (mais detalhes) → Supabase → cópia de reserva (só nome, partido e UF).
// Quando a resposta vem de uma cópia, a `fonte` diz isso e usa a data da coleta.
import copiaArquivo from '../data/deputados.json' with { type: 'json' };
import { cached } from '../utils/cache.js';
import { comPrazo } from '../utils/prazo.js';
import { CAMARA_API, FONTE_NOME } from './camara-fonte.js';
import { supabaseConfigurado, listarDoSupabase, obterDoSupabase } from './supabase.js';

export { CAMARA_API, FONTE_NOME };

// J2 — limites de tempo. Cada chamada tenta UMA vez: se falhar, a próxima fonte assume.
// Pior caso da lista: Supabase (3s) + Câmara (4s, páginas em paralelo) = 7s.
// Pior caso do perfil: Câmara (4s) + Supabase (3s) = 7s. Sobram ~10s para o Gemini.
export const LIMITES = {
  camaraMs: 4_000,
  supabaseMs: 3_000,
};

const PAGINAS_ESPERADAS = 6; // 513 deputados ÷ 100 por página
const CACHE_LISTA_MS = 6 * 60 * 60 * 1000; // 6 horas
const CACHE_PERFIL_MS = 60 * 60 * 1000; // 1 hora

// J3 — mensagem quando nenhuma fonte responde.
export const MSG_CAMARA_FORA = 'A fonte oficial (Câmara) está fora do ar agora.';

export class CamaraError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

async function buscarJson(caminho) {
  const url = `${CAMARA_API}${caminho}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(LIMITES.camaraMs),
    });
    if (res.status === 404) throw new CamaraError('Não encontrado na Câmara', 404);
    if (!res.ok) throw new CamaraError(`Câmara respondeu ${res.status}`);
    return { url, json: await res.json() };
  } catch (err) {
    if (err instanceof CamaraError) throw err;
    throw new CamaraError(`Falha ao consultar a Câmara: ${err.message}`);
  }
}

function fonte(url) {
  return { nome: FONTE_NOME, url, consultadoEm: new Date().toISOString() };
}

const resumo = (d) => ({ id: d.id, nome: d.nome, partido: d.siglaPartido, uf: d.siglaUf, foto: d.urlFoto });

// Lista todos os deputados em exercício. As 6 páginas são pedidas AO MESMO TEMPO.
function listarDaCamara() {
  return cached('deputados:lista', CACHE_LISTA_MS, async () => {
    const caminho = (p) => `/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=${p}`;
    const paginas = await Promise.all(
      Array.from({ length: PAGINAS_ESPERADAS }, (_, i) => buscarJson(caminho(i + 1)))
    );

    // Se um dia houver mais de 6 páginas, busca as que faltam.
    let p = PAGINAS_ESPERADAS;
    while (paginas[paginas.length - 1].json.links?.some((l) => l.rel === 'next')) {
      paginas.push(await buscarJson(caminho(++p)));
    }

    // Sem duplicados (a API pode repetir alguém entre páginas).
    const porId = new Map();
    for (const { json } of paginas) for (const d of json.dados ?? []) porId.set(d.id, resumo(d));
    if (porId.size === 0) throw new CamaraError('A Câmara devolveu a lista vazia');

    return { dados: [...porId.values()], fonte: fonte(`${CAMARA_API}/deputados`) };
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

// ---------------------------------------------------------------------------
// J1 — cópia de reserva: src/data/deputados.json (gerada por `npm run atualizar-deputados`)
// ---------------------------------------------------------------------------

// Import direto: garante que a Vercel inclua o arquivo no pacote publicado.
const valida = (c) => (Array.isArray(c?.dados) && c.dados.length && c.coletadoEm ? c : null);
let copia = valida(copiaArquivo);
if (!copia) console.warn('Câmara: cópia de reserva (src/data/deputados.json) vazia ou inválida');

function lerCopia() {
  return copia;
}

// Só para os testes: troca a cópia (objeto), remove (null) ou volta ao arquivo (undefined).
export function _setCopia(valor) {
  copia = valor === undefined ? valida(copiaArquivo) : valor;
}

function dataBr(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function fonteDaCopia(url, c) {
  return {
    nome: `${FONTE_NOME} (cópia de reserva de ${dataBr(c.coletadoEm)})`,
    url,
    consultadoEm: c.coletadoEm,
  };
}

function listarDaCopia() {
  const c = lerCopia();
  if (!c) return null;
  return { dados: c.dados, fonte: fonteDaCopia(`${CAMARA_API}/deputados`, c) };
}

function obterDaCopia(id) {
  const c = lerCopia();
  const d = c?.dados.find((x) => String(x.id) === String(id));
  if (!d) return null;
  return { dados: { ...d, redesSociais: [] }, fonte: fonteDaCopia(`${CAMARA_API}/deputados/${d.id}`, c) };
}

// ---------------------------------------------------------------------------

async function tentarSupabase(fn, ...args) {
  if (!supabaseConfigurado()) return null;
  try {
    return await comPrazo(fn(...args), LIMITES.supabaseMs, 'Supabase não respondeu a tempo');
  } catch (err) {
    console.error(err.message);
    return null;
  }
}

// Se a lista da Câmara falhou há pouco, vai direto para a cópia por 1 minuto,
// em vez de fazer cada pergunta esperar o limite de tempo de novo.
const PAUSA_APOS_FALHA_MS = 60_000;
let listaFalhouEm = 0;

export function _resetPausa() {
  listaFalhouEm = 0;
}

export async function listarDeputados() {
  const doBanco = await cached('deputados:lista:supabase', CACHE_PERFIL_MS, async () => {
    const r = await tentarSupabase(listarDoSupabase);
    if (!r) throw new Error('sem dados no Supabase');
    return r;
  }).catch(() => null);
  if (doBanco) return doBanco;

  const reserva = listarDaCopia();
  if (reserva && Date.now() - listaFalhouEm < PAUSA_APOS_FALHA_MS) return reserva;

  try {
    return await listarDaCamara();
  } catch (err) {
    listaFalhouEm = Date.now();
    if (reserva) {
      console.warn(`Câmara: ${err.message}. Usando a cópia de reserva por enquanto.`);
      return reserva;
    }
    console.error(err.message);
    throw new CamaraError(MSG_CAMARA_FORA);
  }
}

export async function obterDeputado(id) {
  try {
    return await obterDaCamara(id);
  } catch (err) {
    if (err instanceof CamaraError && err.status === 404) throw err;
    const reserva = (await tentarSupabase(obterDoSupabase, id)) ?? obterDaCopia(id);
    if (reserva) return reserva;
    console.error(err.message);
    throw new CamaraError(MSG_CAMARA_FORA);
  }
}

// J12 — para o /api/health/fontes.
export async function pingCamara() {
  const inicio = Date.now();
  await buscarJson('/deputados?itens=1');
  return Date.now() - inicio;
}

export function infoCopia() {
  const c = lerCopia();
  return c ? { total: c.dados.length, coletadoEm: c.coletadoEm } : null;
}
