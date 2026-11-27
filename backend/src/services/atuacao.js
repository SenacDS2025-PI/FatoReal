// O que o político JÁ FEZ no mandato, para o FatoBot responder "o que Fulano fez?".
// Tudo vem das APIs oficiais da Câmara e do Senado (ou da lista de registros verificados
// da equipe, com link do STF/Agência Brasil). Cada evidência leva a sua fonte.
//
// Regras:
// - Só fatos e números publicados pela fonte; nada de opinião ou adjetivo.
// - Se uma parte falhar ou demorar, ela simplesmente fica de fora (nunca chuta um número).
// - As consultas lentas ficam no cache: a 1ª pergunta pode vir com menos dados; as próximas, completas.
import { cached } from '../utils/cache.js';
import leisGeradas from '../data/leis-deputados.json' with { type: 'json' };
import { normalizar } from '../utils/texto.js';
import { CAMARA_API, FONTE_NOME as FONTE_CAMARA } from './camara-fonte.js';
import { FONTE_SENADO_NOME } from './senado.js';
import { REGISTROS_VERIFICADOS } from '../data/registros-verificados.js';

const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';
export const INICIO_LEGISLATURA = '2023-02-01'; // 57ª legislatura
const COD_VIROU_LEI = 1140; // "Transformado em Norma Jurídica" (tabela de situações da Câmara)

// Nos testes (node --test) a atuação fica desligada, para os testes antigos do FatoBot contarem
// só as evidências do perfil; test/atuacao.test.js liga de novo (CONFIG_ATUACAO.ligada = true).
export const CONFIG_ATUACAO = { ligada: !process.env.NODE_TEST_CONTEXT };

export const LIMITES_ATUACAO = {
  requisicaoMs: 10_000, // cada chamada às APIs (a de despesas da Câmara chega a ~8 s)
  esperaMs: 9_000, // quanto o FatoBot espera por TUDO antes de seguir sem o que faltou
};
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 horas
const CACHE_LEIS_MS = 24 * 60 * 60 * 1000; // 24 horas

// ---------- utilidades ----------
// A Câmara bloqueia (429) quando recebe muitos pedidos juntos: no máximo 4 ao mesmo tempo,
// e uma nova tentativa quando ela pede para esperar.
const MAX_SIMULTANEOS = 4;
let emAndamento = 0;
const fila = [];
async function vez() {
  if (emAndamento < MAX_SIMULTANEOS) return void emAndamento++;
  await new Promise((r) => fila.push(r));
}
function liberar() {
  const proximo = fila.shift();
  if (proximo) proximo();
  else emAndamento--;
}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscarJson(url, tentativa = 1) {
  await vez();
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(LIMITES_ATUACAO.requisicaoMs) });
  } finally {
    liberar();
  }
  if (res.status === 429 && tentativa < 3) {
    await esperar(Math.min(Number(res.headers.get('retry-after')) || 1, 5) * 1000 * tentativa);
    return buscarJson(url, tentativa + 1);
  }
  if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`);
  return res.json();
}

/** Valor de uma despesa: o "valorLiquido" vem com sinal trocado em parte das notas (igual ao front). */
export function valorDespesa(d) {
  if (d.valorDocumento != null) return Number(d.valorDocumento) - Number(d.valorGlosa ?? 0);
  return Math.abs(Number(d.valorLiquido ?? 0));
}

/** Total de itens de uma consulta paginada da Câmara feita com itens=1 (o nº da última página). */
export function totalPeloLink(json) {
  const ultimo = json?.links?.find((l) => l.rel === 'last')?.href;
  const n = ultimo ? Number(new URL(ultimo).searchParams.get('pagina')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : (json?.dados?.length ?? 0);
}

export function dataBr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

export function reais(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const plural = (n, um, varios) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

/** Espera no máximo `ms`; o que não ficou pronto vira null (e continua carregando para o cache). */
async function comEspera(promessas, ms) {
  let fim;
  const limite = new Promise((r) => (fim = setTimeout(r, ms, 'tempo')));
  const res = await Promise.all(
    promessas.map((p) =>
      Promise.race([p.then((v) => v, (e) => (console.warn(`Atuação: ${e.message}`), null)), limite.then(() => null)])
    )
  );
  clearTimeout(fim);
  return res;
}

const ev = (texto, fonte, url, consultadoEm = new Date().toISOString()) => ({ texto, fonte, url, consultadoEm });

// ---------- Câmara ----------
const TIPOS = [
  { sigla: 'PL', um: 'projeto de lei', varios: 'projetos de lei' },
  { sigla: 'PEC', um: 'proposta de emenda à Constituição', varios: 'propostas de emenda à Constituição' },
  { sigla: 'PLP', um: 'projeto de lei complementar', varios: 'projetos de lei complementar' },
  { sigla: 'PDL', um: 'projeto de decreto legislativo', varios: 'projetos de decreto legislativo' },
  { sigla: 'REQ', um: 'requerimento', varios: 'requerimentos' },
];
const TIPOS_DE_LEI = ['PL', 'PLP', 'PEC', 'PDL'];
const fichaProposicao = (id) => `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;
const filtroAutor = (id) => `${CAMARA_API}/proposicoes?idDeputadoAutor=${id}&dataApresentacaoInicio=${INICIO_LEGISLATURA}`;

/** Quantas proposições de cada tipo o deputado apresentou nesta legislatura. */
function contagemCamara(id) {
  return cached(`atuacao:contagem:${id}`, CACHE_MS, async () => {
    const r = await Promise.all(TIPOS.map((t) => buscarJson(`${filtroAutor(id)}&siglaTipo=${t.sigla}&itens=1`).then((j) => ({ ...t, total: totalPeloLink(j) }))));
    return r;
  });
}

/** Os 3 projetos de lei mais recentes. */
function recentesCamara(id) {
  return cached(`atuacao:recentes:${id}`, CACHE_MS, async () => {
    const j = await buscarJson(`${filtroAutor(id)}&siglaTipo=PL&itens=3&ordem=DESC&ordenarPor=id`);
    return j.dados ?? [];
  });
}

/**
 * Quais projetos (PL, PLP, PEC, PDL) desta legislatura viraram lei.
 * A API da Câmara IGNORA o filtro codSituacao, então a conta vem de data/leis-deputados.json,
 * gerado dos arquivos completos da Câmara por scripts/gerar-leis-deputados.js (npm run gerar-leis).
 * Sem o arquivo, devolve null (não dá para afirmar "nenhum").
 */
// Import estático (igual à cópia dos deputados em camara.js) para a Vercel incluir o arquivo no deploy.
let leisArquivo = leisGeradas?.deputados ? leisGeradas : null;
if (!leisArquivo) console.warn('Atuação: data/leis-deputados.json vazio ou inválido (rode npm run gerar-leis)');
function arquivoDeLeis() {
  return leisArquivo;
}
export function _setLeisArquivo(valor) {
  leisArquivo = valor;
}

export function leisCamara(id) {
  const arq = arquivoDeLeis();
  if (!arq) return Promise.resolve(null);
  const d = arq.deputados?.[String(id)] ?? { projetos: 0, leis: [] };
  return Promise.resolve({ analisados: d.projetos, viraramLei: d.leis, geradoEm: arq.geradoEm });
}

/** Total gasto da cota parlamentar no ano (todas as páginas; se faltar uma, não informa). */
function gastosCamara(id, ano) {
  return cached(`atuacao:gastos:${id}:${ano}`, CACHE_MS, async () => {
    const url = (p) => `${CAMARA_API}/deputados/${id}/despesas?ano=${ano}&itens=100&pagina=${p}`;
    const primeira = await buscarJson(url(1));
    const paginas = totalPeloLink({ ...primeira, dados: [] }) || 1;
    const resto = await Promise.all(Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => buscarJson(url(i + 2))));
    const itens = [primeira, ...resto].flatMap((j) => j.dados ?? []);
    const total = itens.reduce((t, d) => t + valorDespesa(d), 0);
    const ultimaData = itens.map((d) => d.dataDocumento ?? '').sort().at(-1) ?? null;
    return { ano, total, notas: itens.length, ultimaData, url: url(1) };
  });
}

/** Total de discursos nesta legislatura. */
function discursosCamara(id) {
  return cached(`atuacao:discursos:${id}`, CACHE_MS, async () =>
    totalPeloLink(await buscarJson(`${CAMARA_API}/deputados/${id}/discursos?dataInicio=${INICIO_LEGISLATURA}&itens=1&ordenarPor=dataHoraInicio&ordem=DESC`))
  );
}

/** Últimas votações nominais do plenário (90 dias) com os votos — igual para todos os deputados. */
export function votacoesPlenario() {
  return cached('atuacao:votacoes-plenario', CACHE_MS, async () => {
    const ini = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const fim = new Date().toISOString().slice(0, 10);
    const lista = (await buscarJson(`${CAMARA_API}/votacoes?idOrgao=180&dataInicio=${ini}&dataFim=${fim}&itens=60&ordem=DESC&ordenarPor=dataHoraRegistro`)).dados ?? [];
    const comVotos = [];
    for (let i = 0; i < Math.min(lista.length, 40) && comVotos.length < 20; i += 10) {
      const lote = await Promise.all(lista.slice(i, i + 10).map((v) => buscarJson(`${CAMARA_API}/votacoes/${v.id}/votos`).then((j) => j.dados ?? [], () => [])));
      lote.forEach((votos, k) => votos.length && comVotos.push({ v: lista[i + k], votos }));
    }
    return comVotos.slice(0, 20);
  });
}

/** Projeto que estava em votação (o 1º de "proposicoesAfetadas"), ou null. */
function projetoDaVotacao(id) {
  return cached(`atuacao:votacao:${id}`, CACHE_LEIS_MS, async () => (await buscarJson(`${CAMARA_API}/votacoes/${id}`)).dados?.proposicoesAfetadas?.[0] ?? null);
}

export function evidenciasRegistros(nome, casa) {
  const alvo = normalizar(nome);
  return REGISTROS_VERIFICADOS.filter((r) => r.casa === casa && normalizar(r.nome) === alvo).map((r) =>
    ev(
      `${r.tipo}${r.data ? ` (${dataBr(r.data)})` : ''}: ${r.titulo}. ${r.descricao}`,
      `${r.orgao} (registro verificado pela equipe do Fato Real)`,
      r.fonte_url,
      null
    )
  );
}

/** Evidências da atuação de um deputado federal nesta legislatura. */
export async function atuacaoDeputado({ id, nome }) {
  const ano = new Date().getFullYear();
  const [contagem, recentes, leis, gastos, discursos, plenario] = await comEspera(
    [contagemCamara(id), recentesCamara(id), leisCamara(id), gastosCamara(id, ano), discursosCamara(id), votacoesPlenario()],
    LIMITES_ATUACAO.esperaMs
  );
  const out = [];

  if (contagem) {
    const partes = contagem.filter((t) => t.total > 0).map((t) => plural(t.total, t.um, t.varios));
    if (partes.length) out.push(ev(`Desde fevereiro de 2023 (legislatura atual), ${nome} apresentou na Câmara: ${partes.join(', ')}.`, FONTE_CAMARA, `${filtroAutor(id)}&itens=100`));
    else out.push(ev(`Desde fevereiro de 2023 (legislatura atual), a Câmara não registra projetos de lei nem requerimentos apresentados por ${nome}.`, FONTE_CAMARA, `${filtroAutor(id)}&itens=100`));
  }
  for (const p of recentes ?? []) {
    out.push(ev(`Projeto de lei recente de ${nome}: ${p.siglaTipo} ${p.numero}/${p.ano}, que trata de: "${String(p.ementa ?? '').trim()}"`, FONTE_CAMARA, fichaProposicao(p.id)));
  }
  if (leis && leis.analisados > 0) {
    const em = dataBr(leis.geradoEm);
    const segundo = `segundo a situação registrada na Câmara${em ? ` em ${em}` : ''}`;
    const url = 'https://dadosabertos.camara.leg.br/swagger/api.html#staticfile';
    if (leis.viraramLei.length === 0) {
      out.push(ev(`Dos ${leis.analisados} projetos (PL, PLP, PEC e PDL) de autoria ou coautoria de ${nome} apresentados desde fevereiro de 2023, nenhum virou lei até agora, ${segundo}.`, FONTE_CAMARA, url));
    } else {
      out.push(ev(`Dos ${leis.analisados} projetos (PL, PLP, PEC e PDL) de autoria ou coautoria de ${nome} apresentados desde fevereiro de 2023, ${plural(leis.viraramLei.length, 'virou lei', 'viraram lei')}, ${segundo}.`, FONTE_CAMARA, url));
      for (const p of leis.viraramLei.slice(0, 3)) {
        out.push(ev(`Virou lei: ${p.sigla} ${p.numero}/${p.ano}, de autoria ou coautoria de ${nome}, que trata de: "${String(p.ementa ?? '').trim()}"`, FONTE_CAMARA, fichaProposicao(p.id)));
      }
    }
  }
  if (gastos && gastos.notas > 0) {
    const ate = dataBr(gastos.ultimaData);
    out.push(ev(`Em ${gastos.ano}${ate ? ` (notas até ${ate})` : ''}, ${nome} usou ${reais(gastos.total)} da cota parlamentar, em ${plural(gastos.notas, 'despesa', 'despesas')} registradas.`, FONTE_CAMARA, gastos.url));
  }
  if (discursos != null) out.push(ev(`${nome} fez ${plural(discursos, 'discurso', 'discursos')} na Câmara desde fevereiro de 2023.`, FONTE_CAMARA, `${CAMARA_API}/deputados/${id}/discursos?dataInicio=${INICIO_LEGISLATURA}`));
  if (plenario?.length) {
    const meus = plenario.map(({ v, votos }) => ({ v, voto: votos.find((x) => x.deputado_?.id === id)?.tipoVoto ?? null }));
    const votou = meus.filter((m) => m.voto).length;
    out.push(ev(`Nas ${plenario.length} votações nominais mais recentes do plenário da Câmara (últimos 90 dias), ${nome} registrou voto em ${votou}.`, FONTE_CAMARA, `${CAMARA_API}/votacoes?idOrgao=180`));
    const mostrar = meus.filter((m) => m.voto).slice(0, 3);
    const projetos = await comEspera(mostrar.map(({ v }) => projetoDaVotacao(v.id)), 3_000);
    mostrar.forEach(({ v, voto }, i) => {
      const p = projetos[i];
      const sobre = p ? `${p.siglaTipo} ${p.numero}/${p.ano}, que trata de: "${String(p.ementa ?? '').trim()}"` : null;
      out.push(
        ev(
          `Na votação nominal de ${dataBr(v.dataHoraRegistro ?? v.data) ?? 'data não informada'} no plenário da Câmara${sobre ? ` sobre o ${sobre}` : ''} (resultado: ${String(v.descricao ?? 'não informado').trim()}), ${nome} votou "${voto}".`,
          FONTE_CAMARA,
          `${CAMARA_API}/votacoes/${v.id}`
        )
      );
    });
  }
  out.push(...evidenciasRegistros(nome, 'camara'));
  return out;
}

// ---------- Senado ----------
// Os serviços /senador/{cod}/autorias e /votacoes ainda respondem com dados atualizados
// (o site já usa os mesmos). Ver Metadados.Descontinuacao se um dia pararem.
const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const paginaSenador = (cod) => `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${cod}`;
const materiaSenado = (cod) => `https://www25.senado.leg.br/web/atividade/materias/-/materia/${cod}`;
// Registros que são voto de fato (os outros: LS = licença saúde, MIS = missão, P-NRV = presente sem voto...).
const VOTOS_SENADO = new Set(['Sim', 'Não', 'Abstenção', 'Votou']);
const TIPOS_SENADO = { PL: ['projeto de lei', 'projetos de lei'], PEC: ['proposta de emenda à Constituição', 'propostas de emenda à Constituição'], PLP: ['projeto de lei complementar', 'projetos de lei complementar'], PDL: ['projeto de decreto legislativo', 'projetos de decreto legislativo'] };

function autoriasSenado(cod) {
  return cached(`atuacao:sen-autorias:${cod}`, CACHE_MS, async () => {
    const j = await buscarJson(`${SENADO_API}/senador/${cod}/autorias.json`);
    return lista(j?.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria)
      .map((a) => ({ ...a.Materia, principal: a.IndicadorAutorPrincipal === 'Sim' }))
      .filter((m) => m?.Sigla && (m.Data ?? '') >= INICIO_LEGISLATURA);
  });
}

function votacoesSenado(cod) {
  return cached(`atuacao:sen-votacoes:${cod}`, CACHE_MS, async () => {
    const j = await buscarJson(`${SENADO_API}/senador/${cod}/votacoes.json`);
    return lista(j?.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao)
      .map((v) => ({ data: v.SessaoPlenaria?.DataSessao ?? '', materia: v.Materia?.DescricaoIdentificacao ?? '', ementa: v.Materia?.Ementa ?? '', descricao: v.DescricaoVotacao ?? '', voto: v.SiglaDescricaoVoto ?? v.DescricaoVoto ?? '', codMateria: v.Materia?.Codigo }))
      .filter((v) => v.data >= INICIO_LEGISLATURA)
      .sort((a, b) => b.data.localeCompare(a.data));
  });
}

/** Evidências da atuação de um senador desde 2023. */
export async function atuacaoSenador({ id, nome }) {
  const [autorias, votacoes] = await comEspera([autoriasSenado(id), votacoesSenado(id)], LIMITES_ATUACAO.esperaMs);
  const out = [];
  if (autorias) {
    const principais = autorias.filter((m) => m.principal);
    const partes = Object.entries(TIPOS_SENADO)
      .map(([sigla, [um, varios]]) => ({ n: principais.filter((m) => m.Sigla === sigla).length, um, varios }))
      .filter((t) => t.n > 0)
      .map((t) => plural(t.n, t.um, t.varios));
    out.push(ev(`Desde fevereiro de 2023, o Senado registra ${plural(autorias.length, 'matéria', 'matérias')} de autoria ou coautoria de ${nome}, sendo autor(a) principal de ${principais.length}${partes.length ? ` (entre elas: ${partes.join(', ')})` : ''}.`, FONTE_SENADO_NOME, `${SENADO_API}/senador/${id}/autorias.json`));
    const projetos = principais.filter((m) => TIPOS_SENADO[m.Sigla]).sort((a, b) => (b.Data ?? '').localeCompare(a.Data ?? ''));
    for (const m of projetos.slice(0, 3)) {
      out.push(ev(`Matéria recente de ${nome} no Senado: ${m.DescricaoIdentificacao ?? `${m.Sigla} ${m.Numero}/${m.Ano}`}, apresentada em ${dataBr(m.Data) ?? 'data não informada'}, que trata de: "${String(m.Ementa ?? '').trim()}"`, FONTE_SENADO_NOME, materiaSenado(m.Codigo)));
    }
  }
  if (votacoes?.length) {
    const votou = votacoes.filter((v) => VOTOS_SENADO.has(v.voto));
    out.push(ev(`Desde fevereiro de 2023, o Senado registra ${plural(votacoes.length, 'votação nominal', 'votações nominais')} de ${nome} no plenário; em ${votou.length} delas votou, e nas outras aparece licença, missão oficial, presença sem voto ou outro registro.`, FONTE_SENADO_NOME, `${SENADO_API}/senador/${id}/votacoes.json`));
    for (const v of votou.slice(0, 3)) {
      const sobre = [v.materia, v.descricao].filter(Boolean).join(' — ');
      const voto = v.voto === 'Votou' ? 'votou (voto secreto)' : `votou "${v.voto}"`;
      out.push(ev(`Na votação de ${dataBr(v.data)} no plenário do Senado (${sobre || 'votação nominal'}), ${nome} ${voto}.`, FONTE_SENADO_NOME, v.codMateria ? materiaSenado(v.codMateria) : paginaSenador(id)));
    }
  }
  out.push(...evidenciasRegistros(nome, 'senado'));
  return out;
}
