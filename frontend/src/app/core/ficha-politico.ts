/**
 * Ficha completa de deputados (API da Câmara) e senadores (API do Senado).
 * Cada parte é buscada separadamente: se uma falhar, o resto continua aparecendo.
 */
import { inicioLegislatura, jsonCamara, valorDespesa } from './politicos.service';

const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';

interface Link { rel: string; href: string }
type Pagina<T> = { dados: T[]; links?: Link[] };

function totalPeloLink(r: Pagina<unknown>): number {
  const ultima = r.links?.find((l) => l.rel === 'last')?.href;
  if (!ultima) return r.dados.length;
  try {
    return Number(new URL(ultima).searchParams.get('pagina')) || r.dados.length;
  } catch {
    return r.dados.length;
  }
}

/** Executa tarefas com no máximo `n` ao mesmo tempo (para não sobrecarregar a API). */
export async function emLotes<T, R>(itens: T[], n: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const saida: (R | null)[] = new Array(itens.length).fill(null);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (i < itens.length) {
        const k = i++;
        try {
          saida[k] = await fn(itens[k]);
        } catch {
          saida[k] = null;
        }
      }
    }),
  );
  return saida;
}

export function idade(nascimento?: string | null): number | null {
  if (!nascimento) return null;
  const n = new Date(nascimento.slice(0, 10) + 'T12:00:00');
  if (isNaN(n.getTime())) return null;
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) a--;
  return a;
}

function dataIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ======================================================================
// Câmara
// ======================================================================

export interface Carreira {
  sexo: 'M' | 'F' | null;
  nascimento: string | null;
  naturalidade: string | null;
  escolaridade: string | null;
  site: string | null;
  profissoes: string[];
  ocupacoes: { titulo: string; entidade: string; periodo: string }[];
  mandatosExternos: { cargo: string; local: string; periodo: string; partido: string }[];
  /** Mudanças de partido registradas pela Câmara (mais recente primeiro). */
  partidos: { sigla: string; desde: string }[];
  /** Legislaturas em que já foi deputado(a) (57 = 2023-2027). */
  legislaturas: number[];
  frentes: { id: number; titulo: string }[];
}

interface HistoricoCamara { dataHora: string; siglaPartido: string; idLegislatura: number; situacao?: string; descricaoStatus?: string }

export async function carreiraCamara(id: number): Promise<Carreira> {
  const [det, prof, ocup, mand, hist, fren] = await Promise.allSettled([
    jsonCamara<{ dados: { sexo?: string; dataNascimento?: string; municipioNascimento?: string; ufNascimento?: string; escolaridade?: string; urlWebsite?: string } }>(`/deputados/${id}`),
    jsonCamara<Pagina<{ titulo: string }>>(`/deputados/${id}/profissoes`),
    jsonCamara<Pagina<{ titulo: string; entidade?: string; anoInicio?: number; anoFim?: number }>>(`/deputados/${id}/ocupacoes`),
    jsonCamara<Pagina<{ cargo: string; siglaUf?: string; municipio?: string; anoInicio?: string; anoFim?: string; siglaPartidoEleicao?: string }>>(`/deputados/${id}/mandatosExternos`),
    jsonCamara<Pagina<HistoricoCamara>>(`/deputados/${id}/historico`),
    jsonCamara<Pagina<{ id: number; titulo: string }>>(`/deputados/${id}/frentes`),
  ]);
  const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null);
  const d = ok(det)?.dados;
  const periodo = (a?: number | string | null, b?: number | string | null) => (a ? (b && b !== a ? `${a} a ${b}` : b ? `${a}` : `desde ${a}`) : '');

  const historico = [...(ok(hist)?.dados ?? [])].sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  const partidos: Carreira['partidos'] = [];
  for (const h of historico) {
    if (h.siglaPartido && partidos[partidos.length - 1]?.sigla !== h.siglaPartido) partidos.push({ sigla: h.siglaPartido, desde: h.dataHora });
  }
  const unicos = <T,>(l: T[], k: (x: T) => string) => l.filter((x, i, a) => a.findIndex((y) => k(y) === k(x)) === i);

  return {
    sexo: d?.sexo === 'F' ? 'F' : d?.sexo === 'M' ? 'M' : null,
    nascimento: d?.dataNascimento ?? null,
    naturalidade: d?.municipioNascimento ? `${d.municipioNascimento}${d.ufNascimento ? ' (' + d.ufNascimento + ')' : ''}` : null,
    escolaridade: d?.escolaridade ?? null,
    site: d?.urlWebsite ?? null,
    profissoes: unicos((ok(prof)?.dados ?? []).map((p) => p.titulo).filter(Boolean), (x) => x),
    ocupacoes: (ok(ocup)?.dados ?? [])
      .filter((o) => o.titulo)
      .map((o) => ({ titulo: o.titulo, entidade: o.entidade ?? '', periodo: periodo(o.anoInicio, o.anoFim) })),
    mandatosExternos: (ok(mand)?.dados ?? [])
      .map((m) => ({ cargo: m.cargo, local: [m.municipio, m.siglaUf].filter(Boolean).join(' · '), periodo: periodo(m.anoInicio, m.anoFim), partido: m.siglaPartidoEleicao ?? '' }))
      .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    partidos: partidos.reverse(),
    legislaturas: [...new Set(historico.map((h) => h.idLegislatura).filter(Boolean))].sort((a, b) => b - a),
    frentes: unicos(ok(fren)?.dados ?? [], (f) => String(f.id)),
  };
}

/** Ano de início de uma legislatura (57 = 2023). */
export function anoLegislatura(n: number): number {
  return 2023 + (n - 57) * 4;
}

// ---------- Proposições ----------
export interface Proposicao {
  id: number;
  titulo: string;
  tipo: string;
  ementa: string;
  apresentacao: string | null;
  situacao: string | null;
  ultimaTramitacao: string | null;
  url: string;
}

export const TIPOS_PROPOSICAO: { sigla: string; nome: string }[] = [
  { sigla: 'PL', nome: 'Projetos de lei' },
  { sigla: 'PEC', nome: 'Emendas à Constituição' },
  { sigla: 'PLP', nome: 'Leis complementares' },
  { sigla: 'PDL', nome: 'Decretos legislativos' },
  { sigla: 'REQ', nome: 'Requerimentos' },
  { sigla: 'INC', nome: 'Indicações' },
];

function filtroAutor(id: number, desde: string) {
  return `/proposicoes?idDeputadoAutor=${id}&dataApresentacaoInicio=${desde}`;
}

/** Quantas proposições de cada tipo desde o início da legislatura. */
export async function contagemProposicoes(id: number): Promise<{ sigla: string; nome: string; total: number }[]> {
  const desde = inicioLegislatura();
  const r = await emLotes(TIPOS_PROPOSICAO, 3, async (t) => ({
    ...t,
    total: totalPeloLink(await jsonCamara<Pagina<unknown>>(`${filtroAutor(id, desde)}&siglaTipo=${t.sigla}&itens=1`)),
  }));
  return r.filter((x): x is { sigla: string; nome: string; total: number } => !!x);
}

/** Uma página de proposições (com a situação atual de cada uma). */
export async function proposicoesDe(id: number, pagina: number, tipo = ''): Promise<{ itens: Proposicao[]; total: number }> {
  const desde = inicioLegislatura();
  const r = await jsonCamara<Pagina<{ id: number; siglaTipo: string; numero: number; ano: number; ementa: string }>>(
    `${filtroAutor(id, desde)}${tipo ? '&siglaTipo=' + tipo : ''}&itens=10&pagina=${pagina}&ordem=DESC&ordenarPor=id`,
  );
  const total = r.links?.some((l) => l.rel === 'last') ? totalPeloLink(r) * 10 : r.dados.length + (pagina - 1) * 10;
  const detalhes = await emLotes(r.dados, 5, (p) =>
    jsonCamara<{ dados: { dataApresentacao?: string; statusProposicao?: { descricaoSituacao?: string; despacho?: string; descricaoTramitacao?: string; dataHora?: string } } }>(`/proposicoes/${p.id}`),
  );
  return {
    total,
    itens: r.dados.map((p, i) => {
      const s = detalhes[i]?.dados;
      return {
        id: p.id,
        titulo: `${p.siglaTipo} ${p.numero}/${p.ano}`,
        tipo: p.siglaTipo,
        ementa: p.ementa,
        apresentacao: s?.dataApresentacao ?? null,
        situacao: s?.statusProposicao?.descricaoSituacao ?? null,
        ultimaTramitacao: s?.statusProposicao?.descricaoTramitacao ?? null,
        url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
      };
    }),
  };
}

// ---------- Votações em plenário ----------
export interface VotoPlenario {
  id: string;
  data: string;
  descricao: string;
  proposicao: string | null;
  voto: string; // Sim, Não, Abstenção, Obstrução, Art. 17, ou "Não votou"
  maioriaPartido: string | null;
  comPartido: boolean | null;
  placar: { sim: number; nao: number };
  url: string;
}

export interface ResumoVotacoes {
  votos: VotoPlenario[];
  analisadas: number;
  presenca: number | null; // % das votações nominais em que votou
  fidelidade: number | null; // % em que votou igual à maioria do partido
}

interface VotoCamara { tipoVoto: string; deputado_: { id: number; siglaPartido: string } }
const cacheVotos = new Map<string, Promise<VotoCamara[]>>();
function votosDaVotacao(id: string): Promise<VotoCamara[]> {
  if (!cacheVotos.has(id)) {
    cacheVotos.set(id, jsonCamara<{ dados: VotoCamara[] }>(`/votacoes/${id}/votos`).then((r) => r.dados).catch(() => []));
  }
  return cacheVotos.get(id)!;
}

export interface VotacaoPlenario { id: string; dataHoraRegistro?: string; data?: string; descricao?: string; proposicaoObjeto?: string | null; uriProposicaoObjeto?: string | null; aprovacao?: number | null }
export type VotoDeputado = VotoCamara;

let ultimasVotacoes: Promise<VotacaoPlenario[]> | null = null;
let nominaisCache: Promise<{ v: VotacaoPlenario; votos: VotoCamara[] }[]> | null = null;

/** Últimas votações nominais do plenário (até 20, últimos 90 dias), com os votos de cada deputado. Fica guardado na memória. */
export function votacoesNominais(): Promise<{ v: VotacaoPlenario; votos: VotoCamara[] }[]> {
  nominaisCache ??= (async () => {
    const lista = await listaVotacoes();
    const comVotos = await emLotes(lista.slice(0, 40), 5, async (v) => ({ v, votos: await votosDaVotacao(v.id) }));
    return comVotos.filter((x): x is NonNullable<typeof x> => !!x && x.votos.length > 0).slice(0, 20);
  })().catch((e) => {
    nominaisCache = null;
    throw e;
  });
  return nominaisCache;
}

function listaVotacoes(): Promise<VotacaoPlenario[]> {
  ultimasVotacoes ??= (async () => {
    const ini = new Date();
    ini.setDate(ini.getDate() - 90);
    const r = await jsonCamara<Pagina<{ id: string; dataHoraRegistro?: string; data?: string; descricao?: string; proposicaoObjeto?: string | null }>>(
      `/votacoes?idOrgao=180&dataInicio=${dataIso(ini)}&dataFim=${dataIso(new Date())}&itens=60&ordem=DESC&ordenarPor=dataHoraRegistro`,
    );
    return r.dados;
  })().catch((e) => {
    ultimasVotacoes = null;
    throw e;
  });
  return ultimasVotacoes;
}

/** Como o(a) deputado(a) votou nas últimas votações nominais do plenário. */
export async function votacoesDe(id: number, partido: string | null | undefined): Promise<ResumoVotacoes> {
  const nominais = await votacoesNominais();

  let votou = 0;
  let comparaveis = 0;
  let iguais = 0;
  const votos = nominais.map(({ v, votos }) => {
    const meu = votos.find((x) => x.deputado_?.id === id);
    const doPartido = partido ? votos.filter((x) => x.deputado_?.siglaPartido === partido) : [];
    const conta = new Map<string, number>();
    for (const x of doPartido) conta.set(x.tipoVoto, (conta.get(x.tipoVoto) ?? 0) + 1);
    const maioria = [...conta].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    if (meu) votou++;
    const comPartido = meu && maioria && ['Sim', 'Não'].includes(meu.tipoVoto) ? meu.tipoVoto === maioria : null;
    if (comPartido !== null) {
      comparaveis++;
      if (comPartido) iguais++;
    }
    return {
      id: v.id,
      data: v.dataHoraRegistro ?? v.data ?? '',
      descricao: v.descricao ?? 'Votação em plenário',
      proposicao: v.proposicaoObjeto ?? null,
      voto: meu?.tipoVoto ?? 'Não votou',
      maioriaPartido: maioria,
      comPartido,
      placar: { sim: votos.filter((x) => x.tipoVoto === 'Sim').length, nao: votos.filter((x) => x.tipoVoto === 'Não').length },
      url: `https://dadosabertos.camara.leg.br/api/v2/votacoes/${v.id}/votos`,
    };
  });
  return {
    votos,
    analisadas: nominais.length,
    presenca: nominais.length ? Math.round((votou / nominais.length) * 100) : null,
    fidelidade: comparaveis ? Math.round((iguais / comparaveis) * 100) : null,
  };
}

// ---------- Gastos completos ----------
export interface GastosAno {
  ano: number;
  total: number;
  lancamentos: number;
  parcial: boolean;
  porMes: number[];
  porTipo: { tipo: string; valor: number }[];
  fornecedores: { nome: string; valor: number; vezes: number }[];
  ultimas: { data: string; tipo: string; fornecedor: string; valor: number; url: string | null }[];
}

interface DespesaCompleta {
  ano: number; mes: number; tipoDespesa: string; dataDocumento?: string; valorLiquido: number; valorDocumento?: number; valorGlosa?: number; nomeFornecedor?: string; urlDocumento?: string | null;
}

export async function gastosDoAno(id: number, ano: number): Promise<GastosAno | null> {
  const itens: DespesaCompleta[] = [];
  let url: string | undefined = `/deputados/${id}/despesas?ano=${ano}&itens=100&ordem=DESC&ordenarPor=dataDocumento`;
  let paginas = 0;
  while (url && paginas < 10) {
    const r: Pagina<DespesaCompleta> = await jsonCamara(url);
    itens.push(...r.dados);
    url = r.links?.find((l) => l.rel === 'next')?.href;
    paginas++;
  }
  if (!itens.length) return null;
  const porMes = new Array(12).fill(0);
  const porTipo = new Map<string, number>();
  const forn = new Map<string, { valor: number; vezes: number }>();
  for (const i of itens) {
    const v = valorDespesa(i);
    if (i.mes >= 1 && i.mes <= 12) porMes[i.mes - 1] += v;
    const t = tipoLegivel(i.tipoDespesa);
    porTipo.set(t, (porTipo.get(t) ?? 0) + v);
    const f = (i.nomeFornecedor ?? 'Não informado').trim();
    const atual = forn.get(f) ?? { valor: 0, vezes: 0 };
    forn.set(f, { valor: atual.valor + v, vezes: atual.vezes + 1 });
  }
  return {
    ano,
    total: itens.reduce((t, i) => t + valorDespesa(i), 0),
    lancamentos: itens.length,
    parcial: !!url,
    porMes,
    porTipo: [...porTipo].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor),
    fornecedores: [...forn].map(([nome, x]) => ({ nome, ...x })).sort((a, b) => b.valor - a.valor).slice(0, 8),
    ultimas: itens.slice(0, 12).map((i) => ({
      data: i.dataDocumento ?? `${i.ano}-${String(i.mes).padStart(2, '0')}-01`,
      tipo: tipoLegivel(i.tipoDespesa),
      fornecedor: i.nomeFornecedor ?? 'Não informado',
      valor: valorDespesa(i),
      url: i.urlDocumento && /^https?:\/\//.test(i.urlDocumento) ? i.urlDocumento.replace(/^http:/, 'https:') : null,
    })),
  };
}

function tipoLegivel(t: string): string {
  const s = (t ?? '').replace(/\.$/, '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------- Discursos ----------
export interface Discurso {
  data: string;
  tipo: string;
  fase: string;
  sumario: string;
  palavras: string[];
  transcricao: string;
  urlTexto: string | null;
  urlVideo: string | null;
}

export async function discursosDe(id: number, pagina: number): Promise<{ itens: Discurso[]; total: number }> {
  const r = await jsonCamara<Pagina<{
    dataHoraInicio: string; tipoDiscurso?: string; faseEvento?: { titulo?: string }; sumario?: string; keywords?: string; transcricao?: string; urlTexto?: string; urlVideo?: string;
  }>>(`/deputados/${id}/discursos?dataInicio=${inicioLegislatura()}&ordenarPor=dataHoraInicio&ordem=DESC&itens=8&pagina=${pagina}`);
  const https = (u?: string) => (u && /^https?:\/\//.test(u) ? u.replace(/^http:/, 'https:') : null);
  return {
    total: r.links?.some((l) => l.rel === 'last') ? totalPeloLink(r) * 8 : r.dados.length + (pagina - 1) * 8,
    itens: r.dados.map((d) => ({
      data: d.dataHoraInicio,
      tipo: d.tipoDiscurso ?? '',
      fase: d.faseEvento?.titulo ?? '',
      sumario: (d.sumario ?? '').trim(),
      palavras: (d.keywords ?? '').split(/[,;]/).map((k) => k.trim()).filter(Boolean).slice(0, 6),
      transcricao: (d.transcricao ?? '').trim(),
      urlTexto: https(d.urlTexto),
      urlVideo: https(d.urlVideo),
    })),
  };
}

// ======================================================================
// Senado (o JSON é cheio de "embrulhos": procuramos as chaves pelo nome)
// ======================================================================

type Json = Record<string, unknown>;

/** Procura a primeira ocorrência da chave em qualquer nível do JSON. */
function achar(obj: unknown, chave: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (chave in (obj as Json)) return (obj as Json)[chave];
  for (const v of Object.values(obj as Json)) {
    const r = achar(v, chave);
    if (r !== undefined) return r;
  }
  return undefined;
}
function lista(obj: unknown, chave: string): Json[] {
  const v = achar(obj, chave);
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]) as Json[];
}
function texto(obj: unknown, chave: string): string {
  const v = achar(obj, chave);
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

async function jsonSenado(caminho: string): Promise<unknown> {
  const r = await fetch(`${SENADO_API}${caminho}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('A API do Senado não respondeu.');
  return r.json();
}

export interface FichaSenador {
  sexo: 'M' | 'F' | null;
  nascimento: string | null;
  naturalidade: string | null;
  telefone: string | null;
  endereco: string | null;
  formacao: { curso: string; grau: string; local: string }[];
  profissoes: string[];
  mandatos: { uf: string; periodo: string; participacao: string }[];
  partidos: { sigla: string; nome: string; desde: string; ate: string }[];
  comissoes: { sigla: string; nome: string; papel: string; atual: boolean }[];
  autorias: { titulo: string; ementa: string; data: string; url: string }[];
  discursos: { data: string; tipo: string; resumo: string; url: string | null }[];
  votos: { data: string; materia: string; descricao: string; voto: string; resultado: string }[];
  falhas: string[];
}

export async function fichaSenador(cod: number): Promise<FichaSenador> {
  const umAnoAtras = new Date();
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  const ini = dataIso(umAnoAtras).replace(/-/g, '');
  const partes = {
    detalhe: `/senador/${cod}.json`,
    mandatos: `/senador/${cod}/mandatos.json`,
    comissoes: `/senador/${cod}/comissoes.json`,
    filiacoes: `/senador/${cod}/filiacoes.json`,
    profissao: `/senador/${cod}/profissao.json`,
    formacao: `/senador/${cod}/historicoAcademico.json`,
    autorias: `/senador/${cod}/autorias.json`,
    discursos: `/senador/${cod}/discursos.json?dataInicio=${ini}`,
    votacoes: `/senador/${cod}/votacoes.json`,
  };
  const chaves = Object.keys(partes) as (keyof typeof partes)[];
  const res = await Promise.allSettled(chaves.map((k) => jsonSenado(partes[k])));
  const j = Object.fromEntries(chaves.map((k, i) => [k, res[i].status === 'fulfilled' ? (res[i] as PromiseFulfilledResult<unknown>).value : null])) as Record<keyof typeof partes, unknown>;
  const falhas = chaves.filter((k) => !j[k]);
  const hoje = dataIso(new Date());
  const ano = (d: string) => (d ? d.slice(0, 4) : '');

  const det = j.detalhe;
  const tels = lista(det, 'Telefone').map((t) => texto(t, 'NumeroTelefone')).filter(Boolean);
  const sexo = texto(det, 'SexoParlamentar');

  return {
    sexo: /^f/i.test(sexo) ? 'F' : /^m/i.test(sexo) ? 'M' : null,
    nascimento: texto(det, 'DataNascimento') || null,
    naturalidade: texto(det, 'Naturalidade') ? `${texto(det, 'Naturalidade')}${texto(det, 'UfNaturalidade') ? ' (' + texto(det, 'UfNaturalidade') + ')' : ''}` : null,
    telefone: tels[0] ? `(61) ${tels[0]}` : null,
    endereco: texto(det, 'EnderecoParlamentar') || null,
    formacao: lista(j.formacao, 'Curso').map((c) => ({ curso: texto(c, 'NomeCurso'), grau: texto(c, 'GrauInstrucao'), local: [texto(c, 'Estabelecimento'), texto(c, 'Local')].filter(Boolean).join(' · ') })).filter((c) => c.curso),
    profissoes: lista(j.profissao, 'Profissao').map((p) => texto(p, 'NomeProfissao')).filter(Boolean),
    mandatos: lista(j.mandatos, 'Mandato').map((m) => {
      const i = texto(achar(m, 'PrimeiraLegislaturaDoMandato'), 'DataInicio');
      const f = texto(achar(m, 'SegundaLegislaturaDoMandato'), 'DataFim') || texto(achar(m, 'PrimeiraLegislaturaDoMandato'), 'DataFim');
      return { uf: texto(m, 'UfParlamentar'), periodo: [ano(i), ano(f)].filter(Boolean).join(' a '), participacao: texto(m, 'DescricaoParticipacao') };
    }),
    partidos: lista(j.filiacoes, 'Filiacao')
      .map((f) => ({ sigla: texto(f, 'SiglaPartido'), nome: texto(f, 'NomePartido'), desde: texto(f, 'DataFiliacao'), ate: texto(f, 'DataDesfiliacao') }))
      .filter((f) => f.sigla)
      .sort((a, b) => b.desde.localeCompare(a.desde)),
    comissoes: lista(j.comissoes, 'Comissao')
      .map((c) => {
        const fim = texto(c, 'DataFim');
        return { sigla: texto(c, 'SiglaComissao'), nome: texto(c, 'NomeComissao'), papel: texto(c, 'DescricaoParticipacao'), atual: !fim || fim >= hoje };
      })
      .filter((c) => c.sigla && c.atual)
      .filter((c, i, a) => a.findIndex((x) => x.sigla === c.sigla) === i),
    autorias: lista(j.autorias, 'Autoria')
      .map((a) => {
        const m = achar(a, 'Materia') ?? achar(a, 'IdentificacaoMateria') ?? a;
        const codigo = texto(m, 'Codigo') || texto(m, 'CodigoMateria');
        return {
          titulo: [texto(m, 'Sigla') || texto(m, 'SiglaSubtipoMateria'), [texto(m, 'Numero') || texto(m, 'NumeroMateria'), texto(m, 'Ano') || texto(m, 'AnoMateria')].filter(Boolean).join('/')].filter(Boolean).join(' '),
          ementa: texto(m, 'Ementa') || texto(m, 'EmentaMateria'),
          data: texto(m, 'Data') || texto(m, 'DataApresentacao'),
          url: codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}` : 'https://www25.senado.leg.br/web/atividade/materias',
        };
      })
      .filter((a) => a.titulo)
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 30),
    discursos: lista(j.discursos, 'Pronunciamento')
      .map((d) => ({ data: texto(d, 'DataPronunciamento'), tipo: texto(achar(d, 'TipoUsoPalavra'), 'Descricao'), resumo: texto(d, 'TextoResumo'), url: texto(d, 'UrlTexto') || null }))
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 20),
    votos: lista(j.votacoes, 'Votacao')
      .map((v) => {
        const m = achar(v, 'Materia') ?? achar(v, 'IdentificacaoMateria');
        return {
          data: texto(achar(v, 'SessaoPlenaria'), 'DataSessao') || texto(v, 'DataSessao'),
          materia: [texto(m, 'Sigla') || texto(m, 'SiglaSubtipoMateria'), [texto(m, 'Numero') || texto(m, 'NumeroMateria'), texto(m, 'Ano') || texto(m, 'AnoMateria')].filter(Boolean).join('/')].filter(Boolean).join(' '),
          descricao: texto(v, 'DescricaoVotacao'),
          voto: texto(v, 'SiglaDescricaoVoto') || texto(v, 'DescricaoVoto') || '—',
          resultado: texto(v, 'DescricaoResultado'),
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data))
      .slice(0, 25),
    falhas,
  };
}

/** Total de discursos na legislatura atual (1 por página: o número da última página é o total). */
export async function totalDiscursos(id: number): Promise<number> {
  const r = await jsonCamara<Pagina<unknown>>(`/deputados/${id}/discursos?dataInicio=${inicioLegislatura()}&itens=1&ordenarPor=dataHoraInicio&ordem=DESC`);
  return totalPeloLink(r);
}

interface ArquivoLeis {
  geradoEm: string;
  deputados: Record<string, { projetos: number; leis: { id: number; sigla: string; numero: number; ano: number; ementa: string }[] }>;
}
let arquivoLeis: Promise<ArquivoLeis> | null = null;

/**
 * Quantos projetos (PL, PLP, PEC, PDL) de autoria ou coautoria do(a) deputado(a), apresentados
 * desde fev/2023, viraram lei. A API da Câmara IGNORA o filtro codSituacao (antes isso contava
 * TODAS as proposições como lei), então a conta vem de public/dados/leis-deputados.json,
 * gerado pelos arquivos completos da Câmara (backend: npm run gerar-leis).
 */
export async function leisDoAutor(id: number): Promise<number> {
  arquivoLeis ??= fetch('dados/leis-deputados.json').then((r) => {
    if (!r.ok) throw new Error('Arquivo de leis indisponível.');
    return r.json() as Promise<ArquivoLeis>;
  });
  try {
    return (await arquivoLeis).deputados[String(id)]?.leis.length ?? 0;
  } catch (e) {
    arquivoLeis = null;
    throw e;
  }
}
