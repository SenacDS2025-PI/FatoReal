import { Injectable } from '@angular/core';
import { AlertaJuridico, Politico } from './modelos';
import { lerDemo, proximoId, salvarDemo } from './demo-store';
import { verificadosDe } from './registros-verificados';
import { apiUrl, supabase } from './supabase';

const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';
const SENADO_API = 'https://legis.senado.leg.br/dadosabertos';

/** Cargos do filtro. "fonte" diz de onde vêm os dados no modo demonstração (sem Supabase). */
export const CARGOS: { nome: string; fonte: 'camara' | 'senado' | null }[] = [
  { nome: 'Deputado(a) Federal', fonte: 'camara' },
  { nome: 'Senador(a)', fonte: 'senado' },
  { nome: 'Governador(a)', fonte: null },
  { nome: 'Presidente', fonte: null },
  { nome: 'Deputado(a) Estadual', fonte: null },
  { nome: 'Prefeito(a)', fonte: null },
  { nome: 'Vereador(a)', fonte: null },
];

export interface FiltroPoliticos {
  termo?: string;
  partido?: string;
  uf?: string;
  /** Começa em 1. Cada página tem POR_PAGINA itens. */
  pagina?: number;
}

export const POR_PAGINA = 30;

/**
 * Busca e perfil de políticos, sempre ao vivo na API de Dados Abertos da Câmara
 * (com ou sem Supabase). Assim os dados estão sempre atualizados e todo item traz
 * fonte oficial e data da consulta.
 */
@Injectable({ providedIn: 'root' })
export class PoliticosService {
  async buscar(filtro: FiltroPoliticos): Promise<Politico[]> {
    const termo = filtro.termo?.trim() ?? '';
    const partido = filtro.partido?.trim().toUpperCase() ?? '';
    const uf = filtro.uf ?? '';
    const pagina = Math.max(1, filtro.pagina ?? 1);

    const params = new URLSearchParams({ itens: String(POR_PAGINA), pagina: String(pagina), ordem: 'ASC', ordenarPor: 'nome' });
    if (termo.length >= 3) params.set('nome', termo);
    if (partido) params.set('siglaPartido', partido);
    if (uf) params.set('siglaUf', uf);
    const resp = await buscarCamara(`${CAMARA_API}/deputados?${params}`);
    if (!resp.ok) throw new Error('A API da Câmara não respondeu. Tente de novo em instantes.');
    const json = (await resp.json()) as { dados: DeputadoResumo[] };
    const agora = new Date().toISOString();
    return json.dados
      .filter((d) => termo.length >= 3 || !termo || semAcento(d.nome).includes(semAcento(termo)))
      .map((d) => ({
        id: d.id,
        nome: d.nome,
        partido: d.siglaPartido,
        uf: d.siglaUf,
        cargo: 'Deputado(a) Federal',
        foto_url: d.urlFoto,
        email: d.email,
        fonte_url: `https://www.camara.leg.br/deputados/${d.id}`,
        data_coleta: agora,
      }));
  }

  async obter(id: number): Promise<Politico | null> {
    const resp = await buscarCamara(`${CAMARA_API}/deputados/${id}`);
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error('A API da Câmara não respondeu. Tente de novo em instantes.');
    const d = ((await resp.json()) as { dados: DeputadoDetalhe }).dados;
    const s = d.ultimoStatus ?? {};
    return {
      id: d.id,
      nome: s.nome ?? d.nomeCivil,
      nome_civil: d.nomeCivil,
      partido: s.siglaPartido,
      uf: s.siglaUf,
      cargo: 'Deputado(a) Federal',
      foto_url: s.urlFoto,
      email: s.email ?? s.gabinete?.email,
      situacao: s.situacao,
      escolaridade: d.escolaridade,
      data_nascimento: d.dataNascimento,
      municipio_nascimento: d.municipioNascimento ? `${d.municipioNascimento}/${d.ufNascimento ?? ''}` : null,
      fonte_url: `https://www.camara.leg.br/deputados/${d.id}`,
      data_coleta: new Date().toISOString(),
    };
  }
}

/** Dados extras do perfil, sempre lidos da API pública da Câmara (com ou sem Supabase). */
export interface DetalhesPolitico {
  gabinete: { sala?: string; predio?: string; andar?: string; telefone?: string; email?: string } | null;
  condicaoEleitoral: string | null;
  redesSociais: { rede: string; url: string }[];
  comissoes: { sigla: string; nome: string; papel: string }[];
  proposicoes: { id: number; titulo: string; ementa: string; url: string }[];
  totalProposicoes: number | null;
  desdeLegislatura: string;
  despesas: { ano: number; total: number; lancamentos: number; parcial: boolean; porTipo: { tipo: string; valor: number }[]; porMes?: number[] } | null;
}

/** Cada parte é buscada separadamente: se uma falhar, as outras continuam aparecendo. */
export async function detalhesCamara(id: number): Promise<DetalhesPolitico> {
  const desde = inicioLegislatura();
  const filtroProps = `/proposicoes?idDeputadoAutor=${id}&dataApresentacaoInicio=${desde}&ordem=DESC&ordenarPor=id`;
  const [perfil, orgaos, props, contagem, despesas] = await Promise.allSettled([
    jsonCamara<{ dados: DeputadoDetalhe }>(`/deputados/${id}`),
    jsonCamara<{ dados: OrgaoCamara[] }>(`/deputados/${id}/orgaos?itens=100&ordem=DESC&ordenarPor=dataInicio`),
    jsonCamara<{ dados: ProposicaoCamara[] }>(`${filtroProps}&itens=5`),
    // Com 1 item por página, o número da última página é o total de proposições
    jsonCamara<{ dados: unknown[]; links?: LinkCamara[] }>(`${filtroProps}&itens=1`),
    despesasDoAno(id),
  ]);

  const d = perfil.status === 'fulfilled' ? perfil.value.dados : null;
  const hoje = new Date().toISOString().slice(0, 10);
  const vistos = new Set<string>();
  const comissoes =
    orgaos.status === 'fulfilled'
      ? orgaos.value.dados
          .filter((o) => !o.dataFim || o.dataFim.slice(0, 10) >= hoje)
          .filter((o) => !vistos.has(o.siglaOrgao) && !!vistos.add(o.siglaOrgao))
          .map((o) => ({ sigla: o.siglaOrgao, nome: o.nomeOrgao ?? o.nomePublicacao ?? o.siglaOrgao, papel: o.titulo ?? '' }))
      : [];

  const proposicoes =
    props.status === 'fulfilled'
      ? props.value.dados.map((p) => ({
          id: p.id,
          titulo: `${p.siglaTipo} ${p.numero}/${p.ano}`,
          ementa: p.ementa,
          url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
        }))
      : [];
  let totalProposicoes: number | null = null;
  if (contagem.status === 'fulfilled') {
    const ultima = contagem.value.links?.find((l) => l.rel === 'last')?.href;
    totalProposicoes = ultima ? Number(new URL(ultima).searchParams.get('pagina')) || 0 : contagem.value.dados.length;
  }

  const redes = (d?.redeSocial ?? []).map((url) => ({ rede: nomeRede(url), url }));
  return {
    gabinete: d?.ultimoStatus?.gabinete ?? null,
    condicaoEleitoral: d?.ultimoStatus?.condicaoEleitoral ?? null,
    redesSociais: redes,
    comissoes,
    proposicoes,
    totalProposicoes,
    desdeLegislatura: desde,
    despesas: despesas.status === 'fulfilled' ? despesas.value : null,
  };
}

/** Soma da cota parlamentar no ano atual (ou no anterior, se o ano mal começou). Lê no máximo 5 páginas. */
export async function despesasDoAno(id: number): Promise<DetalhesPolitico['despesas']> {
  const anoAtual = new Date().getFullYear();
  for (const ano of [anoAtual, anoAtual - 1]) {
    const itens: DespesaCamara[] = [];
    let url: string | undefined = `/deputados/${id}/despesas?ano=${ano}&itens=100&ordem=DESC&ordenarPor=dataDocumento`;
    let paginas = 0;
    while (url && paginas < 5) {
      const r: { dados: DespesaCamara[]; links?: LinkCamara[] } = await jsonCamara(url);
      itens.push(...r.dados);
      url = r.links?.find((l) => l.rel === 'next')?.href;
      paginas++;
    }
    if (!itens.length) continue;
    const porTipo = new Map<string, number>();
    const porMes = Array<number>(12).fill(0);
    for (const i of itens) {
      porTipo.set(i.tipoDespesa, (porTipo.get(i.tipoDespesa) ?? 0) + valorDespesa(i));
      if (i.mes && i.mes >= 1 && i.mes <= 12) porMes[i.mes - 1] += valorDespesa(i);
    }
    return {
      ano,
      total: itens.reduce((t, i) => t + valorDespesa(i), 0),
      lancamentos: itens.length,
      parcial: !!url,
      porMes,
      porTipo: [...porTipo]
        .map(([tipo, valor]) => ({ tipo: tipoLegivel(tipo), valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
    };
  }
  return null;
}

/** Legislaturas começam em 1º de fevereiro de 2023, 2027, 2031... */
export function inicioLegislatura(): string {
  const hoje = new Date();
  let ano = hoje.getFullYear() - ((((hoje.getFullYear() - 2023) % 4) + 4) % 4);
  if (ano === hoje.getFullYear() && hoje.getMonth() < 1) ano -= 4;
  return `${ano}-02-01`;
}

/**
 * Valor de uma despesa da cota. Pela Câmara, valor líquido = valor do documento − glosa.
 * Desde 2026 a API manda "valorLiquido" com o sinal trocado (-249 numa nota de R$ 249),
 * então calculamos a partir do documento e da glosa; sem eles, usamos o líquido sem sinal.
 */
export function valorDespesa(i: { valorLiquido?: number | null; valorDocumento?: number | null; valorGlosa?: number | null }): number {
  if (i.valorDocumento != null) return i.valorDocumento - (i.valorGlosa ?? 0);
  return Math.abs(i.valorLiquido ?? 0);
}

export async function jsonCamara<T>(caminho: string): Promise<T> {
  const url = (caminho.startsWith('http') ? caminho : CAMARA_API + caminho).replace(/^http:\/\//, 'https://');
  const resp = await buscarCamara(url);
  if (!resp.ok) throw new Error('A API da Câmara não respondeu.');
  return (await resp.json()) as T;
}

function tipoLegivel(t: string): string {
  const s = t.replace(/\.$/, '').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nomeRede(url: string): string {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })();
  const nomes: Record<string, string> = {
    'twitter.com': 'X (Twitter)', 'x.com': 'X (Twitter)', 'instagram.com': 'Instagram', 'facebook.com': 'Facebook',
    'youtube.com': 'YouTube', 'tiktok.com': 'TikTok', 'linkedin.com': 'LinkedIn', 'threads.net': 'Threads',
  };
  return nomes[host] ?? host;
}

/** Listas completas já carregadas (para não buscar de novo a cada filtro). */
const cache = new Map<string, Promise<Politico[]>>();

/**
 * Todos os políticos de um cargo, em ordem alfabética.
 * - Supabase: tabela "politicos" filtrada pelo cargo.
 * - Demo: Deputados pela API da Câmara (513, em páginas de 100) e Senadores pela API do Senado (81).
 *   Os outros cargos não têm API pública: retornam lista vazia até a equipe importar os dados do TSE.
 */
export function todosDoCargo(cargo: string): Promise<Politico[]> {
  if (!cache.has(cargo)) {
    const p = carregarCargo(cargo).catch((e) => {
      cache.delete(cargo);
      throw e;
    });
    cache.set(cargo, p);
  }
  return cache.get(cargo)!;
}

async function carregarCargo(cargo: string): Promise<Politico[]> {
  if (supabase) {
    const { data, error } = await supabase.from('politicos').select('*').eq('cargo', cargo).order('nome').limit(2000);
    if (error) throw new Error('Não foi possível carregar os políticos.');
    return (data as Politico[]).map((p) => ({ ...p, casa: p.casa ?? (cargo === 'Senador(a)' ? 'senado' : cargo === 'Deputado(a) Federal' ? 'camara' : 'outro') }));
  }
  const fonte = CARGOS.find((c) => c.nome === cargo)?.fonte;
  if (fonte === 'camara') return deputadosCamara();
  if (fonte === 'senado') return senadoresSenado();
  return [];
}

async function deputadosCamara(): Promise<Politico[]> {
  // Guardado por 6 horas neste navegador: a lista completa não precisa ser baixada a cada visita.
  const salvo = lerSessao<Politico[]>('deputados-v1');
  if (salvo?.length) return salvo;

  const agora = new Date().toISOString();
  const lista: Politico[] = [];
  const POR_PAGINA = 100;
  // Monta o endereço de cada página aqui mesmo (sempre https), sem depender do link "next" da API.
  for (let pagina = 1; pagina <= 10; pagina++) {
    const url = `${CAMARA_API}/deputados?itens=${POR_PAGINA}&pagina=${pagina}&ordem=ASC&ordenarPor=nome`;
    const json = (await comTentativas(() => jsonCamara<{ dados: DeputadoResumo[] }>(url))).dados;
    for (const d of json) {
      lista.push({
        id: d.id, nome: d.nome, partido: d.siglaPartido, uf: d.siglaUf, cargo: 'Deputado(a) Federal', foto_url: d.urlFoto,
        email: d.email, fonte_url: `https://www.camara.leg.br/deputados/${d.id}`, data_coleta: agora, casa: 'camara',
      });
    }
    if (json.length < POR_PAGINA) break;
  }
  if (!lista.length) throw new Error('A API da Câmara não devolveu nenhum deputado. Tente de novo em instantes.');
  const ordenada = ordenar(lista);
  salvarSessao('deputados-v1', ordenada);
  return ordenada;
}

/** Tenta de novo até 3 vezes (a API às vezes recusa pedidos seguidos), esperando um pouco mais a cada vez. */
async function comTentativas<T>(fn: () => Promise<T>): Promise<T> {
  let erro: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      erro = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw erro;
}

const VALIDADE_SESSAO = 6 * 3600_000;
function lerSessao<T>(chave: string): T | null {
  try {
    const bruto = JSON.parse(localStorage.getItem('fatoreal-cache:' + chave) ?? 'null');
    return bruto && Date.now() - bruto.em < VALIDADE_SESSAO ? (bruto.dados as T) : null;
  } catch {
    return null;
  }
}
function salvarSessao(chave: string, dados: unknown) {
  try {
    localStorage.setItem('fatoreal-cache:' + chave, JSON.stringify({ em: Date.now(), dados }));
  } catch {
    /* sem espaço ou sem localStorage: segue sem guardar */
  }
}

async function senadoresSenado(): Promise<Politico[]> {
  let resp: Response;
  try {
    resp = await fetch(`${SENADO_API}/senador/lista/atual.json`, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('Não foi possível acessar a API do Senado. Verifique sua conexão e tente de novo.');
  }
  if (!resp.ok) throw new Error('A API do Senado não respondeu. Tente de novo em instantes.');
  const json = await resp.json();
  const brutos = json?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
  const agora = new Date().toISOString();
  return ordenar(
    (Array.isArray(brutos) ? brutos : [brutos]).map((p: { IdentificacaoParlamentar: SenadorIdentificacao }) => {
      const i = p.IdentificacaoParlamentar;
      return {
        id: Number(i.CodigoParlamentar), nome: i.NomeParlamentar, nome_civil: i.NomeCompletoParlamentar, partido: i.SiglaPartidoParlamentar,
        uf: i.UfParlamentar, cargo: 'Senador(a)', foto_url: i.UrlFotoParlamentar, email: i.EmailParlamentar ?? null,
        fonte_url: i.UrlPaginaParlamentar || `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${i.CodigoParlamentar}`,
        data_coleta: agora, casa: 'senado' as const,
      };
    }),
  );
}

/** Perfil de um senador (a partir da lista oficial do Senado). */
export async function obterSenador(id: number): Promise<Politico | null> {
  return (await todosDoCargo('Senador(a)')).find((p) => p.id === id) ?? null;
}

/** Senador(a)? Vale para a API do Senado e para linhas do Supabase (casa 'senado' ou cargo começando com "Senador"). */
export function ehSenador(p: { casa?: string | null; cargo?: string | null }): boolean {
  return p.casa === 'senado' || /^senador/i.test((p.cargo ?? '').trim());
}

/**
 * Rota do perfil de um político. Use SEMPRE esta função para montar o link:
 * senador vai para /politicos/senado/:id (dados do Senado); o resto para /politicos/:id (Câmara).
 */
export function rotaPolitico(p: { id: number | string; casa?: string | null; cargo?: string | null }): (string | number)[] {
  return ehSenador(p) ? ['/politicos/senado', p.id] : ['/politicos', p.id];
}

/** Chave de um político nos registros (o mesmo id pode existir na Câmara e no Senado). */
export function chaveAlerta(p: Pick<Politico, 'id' | 'casa'>): string {
  return `${p.casa ?? 'camara'}:${p.id}`;
}

type BancoAlertas = Record<string, AlertaJuridico[]>;
const lerAlertasDemo = () => lerDemo<BancoAlertas>('alertas-v1', {});

/**
 * Polêmicas e registros jurídicos de um político. Só existem quando a moderação cadastra,
 * sempre com link para a fonte (Supabase: tabela "politico_alertas"; demo: localStorage).
 * Nada é gerado automaticamente.
 */
export async function alertasDe(p: Politico): Promise<AlertaJuridico[]> {
  const ordenarData = (l: AlertaJuridico[]) => [...l].sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const verificados = verificadosDe(p);
  if (!supabase) return ordenarData([...verificados, ...(lerAlertasDemo()[chaveAlerta(p)] ?? [])]);
  const { data, error } = await supabase
    .from('politico_alertas')
    .select('*')
    .eq('politico_id', p.id)
    .eq('casa', p.casa ?? 'camara')
    .order('data', { ascending: false });
  if (error) return ordenarData(verificados);
  return ordenarData([...verificados, ...(data as AlertaJuridico[])]);
}

export async function adicionarAlerta(p: Politico, a: Omit<AlertaJuridico, 'id'>): Promise<void> {
  if (!supabase) {
    const db = lerAlertasDemo();
    const lista = db[chaveAlerta(p)] ?? [];
    lista.push({ ...a, id: proximoId(lista) });
    db[chaveAlerta(p)] = lista;
    salvarDemo('alertas-v1', db);
    return;
  }
  const { error } = await supabase.from('politico_alertas').insert({ ...a, politico_id: p.id, casa: p.casa ?? 'camara' });
  if (error) throw new Error('Não foi possível salvar o registro. Só moderadores podem cadastrar.');
}

export async function removerAlerta(p: Politico, id: number): Promise<void> {
  if (!supabase) {
    const db = lerAlertasDemo();
    db[chaveAlerta(p)] = (db[chaveAlerta(p)] ?? []).filter((a) => a.id !== id);
    salvarDemo('alertas-v1', db);
    return;
  }
  const { error } = await supabase.from('politico_alertas').delete().eq('id', id);
  if (error) throw new Error('Não foi possível remover o registro.');
}

/** Quantos registros cada político tem (para a etiqueta vermelha na lista de políticos). */
export async function contagemAlertas(): Promise<Record<string, number>> {
  if (!supabase) {
    const db = lerAlertasDemo();
    return Object.fromEntries(Object.entries(db).map(([k, l]) => [k, l.length]).filter(([, n]) => (n as number) > 0));
  }
  const { data, error } = await supabase.from('politico_alertas').select('politico_id, casa').limit(5000);
  if (error) return {};
  const mapa: Record<string, number> = {};
  for (const r of data as { politico_id: number; casa: string }[]) mapa[`${r.casa}:${r.politico_id}`] = (mapa[`${r.casa}:${r.politico_id}`] ?? 0) + 1;
  return mapa;
}

/** Primeira letra do nome, sem acento (para o índice A–Z). */
export function letraDe(nome: string): string {
  return semAcento(nome.trim().charAt(0)).toUpperCase();
}

function ordenar(lista: Politico[]): Politico[] {
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

interface SenadorIdentificacao {
  CodigoParlamentar: string;
  NomeParlamentar: string;
  NomeCompletoParlamentar?: string;
  SiglaPartidoParlamentar?: string;
  UfParlamentar?: string;
  UrlFotoParlamentar?: string;
  UrlPaginaParlamentar?: string;
  EmailParlamentar?: string;
}

/** Caminhos que o repasse do back-end aceita (GET {API_URL}/camara/<caminho>). */
const REPASSE_CAMARA = /^\/?(deputados|proposicoes|votacoes|eventos)(\/|\?|$)/;

/**
 * Acesso único à API da Câmara. Recebe o caminho ("/deputados/123") ou o endereço completo.
 * 1º tenta direto na Câmara; se o navegador barrar (a Câmara às vezes responde sem o cabeçalho
 * de CORS, e o fetch dá TypeError) ou se der erro 5xx, tenta o repasse do nosso back-end:
 * GET {API_URL}/camara/<caminho>?<query> → mesmo JSON e mesmo status da Câmara.
 * O repasse só aceita deputados, proposições, votações e eventos.
 */
export async function buscarCamara(caminhoOuUrl: string): Promise<Response> {
  const url = (caminhoOuUrl.startsWith('http') ? caminhoOuUrl : CAMARA_API + caminhoOuUrl).replace(/^http:\/\//, 'https://');
  const caminho = url.startsWith(CAMARA_API) ? url.slice(CAMARA_API.length).replace(/^\//, '') : null;
  const podeRepassar = !!caminho && REPASSE_CAMARA.test(caminho);
  const repassar = () => fetch(`${apiUrl}/camara/${caminho}`, { headers: { Accept: 'application/json' } });
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (resp.status >= 500 && podeRepassar) {
      try {
        const viaBack = await repassar();
        if (viaBack.ok) return viaBack;
      } catch {
        /* repasse também fora: fica a resposta da Câmara */
      }
    }
    return resp;
  } catch {
    if (podeRepassar) {
      try {
        return await repassar();
      } catch {
        /* sem repasse: cai na mensagem abaixo */
      }
    }
    throw new Error('Não foi possível acessar a API da Câmara. Verifique sua conexão e tente de novo.');
  }
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface DeputadoResumo {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
  email: string | null;
}

interface DeputadoDetalhe {
  id: number;
  nomeCivil: string;
  dataNascimento?: string;
  municipioNascimento?: string;
  ufNascimento?: string;
  escolaridade?: string;
  ultimoStatus?: {
    nome?: string;
    siglaPartido?: string;
    siglaUf?: string;
    urlFoto?: string;
    email?: string;
    situacao?: string;
    condicaoEleitoral?: string;
    gabinete?: { sala?: string; predio?: string; andar?: string; telefone?: string; email?: string };
  };
  redeSocial?: string[];
}

interface OrgaoCamara { siglaOrgao: string; nomeOrgao?: string; nomePublicacao?: string; titulo?: string; dataFim?: string | null }
interface ProposicaoCamara { id: number; siglaTipo: string; numero: number; ano: number; ementa: string }
interface DespesaCamara { tipoDespesa: string; valorLiquido: number; valorDocumento?: number; valorGlosa?: number; mes?: number }
interface LinkCamara { rel: string; href: string }
