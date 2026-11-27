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
  { nome: 'Vice-governador(a)', fonte: null },
  { nome: 'Presidente', fonte: null },
  { nome: 'Vice-presidente', fonte: null },
  { nome: 'Deputado(a) Estadual', fonte: null },
  { nome: 'Prefeito(a)', fonte: null },
  { nome: 'Vice-prefeito(a)', fonte: null },
  { nome: 'Vereador(a)', fonte: null },
];

/**
 * Cargos por cidade (dados do TSE). São milhares de nomes (só vereadores são ~58 mil) e o Supabase
 * devolve no máximo 1000 linhas por pedido: a lista só é buscada depois que a pessoa escolhe o estado
 * (e, para vereador, a cidade).
 */
export const CARGOS_MUNICIPAIS = ['Prefeito(a)', 'Vice-prefeito(a)', 'Vereador(a)'];
/** Vereador: só com a cidade escolhida (um estado pode ter milhares). */
export const PRECISA_CIDADE = ['Vereador(a)'];

/** De onde vem o político de um cargo: Câmara, Senado ou TSE (todos os outros). */
export function casaDoCargo(cargo: string | null | undefined): 'camara' | 'senado' | 'tse' {
  if (!cargo || cargo === 'Deputado(a) Federal') return 'camara';
  return cargo === 'Senador(a)' ? 'senado' : 'tse';
}

/** "são josé dos campos" → "sao jose dos campos" (igual à coluna municipio_busca do banco). */
export function normalizarCidade(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

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
  // Cargos por cidade nunca vêm inteiros: use politicosDoLocal() depois de escolher estado/cidade.
  if (CARGOS_MUNICIPAIS.includes(cargo)) return [];
  if (supabase) return comCasa(await todasAsPaginas((de, ate) => supabase!.from('politicos').select('*').eq('cargo', cargo).order('nome').order('id').range(de, ate)));
  const fonte = CARGOS.find((c) => c.nome === cargo)?.fonte;
  if (fonte === 'camara') return deputadosCamara();
  if (fonte === 'senado') return senadoresSenado();
  return [];
}

/** Preenche "casa" pelo cargo (registros antigos sem a coluna, ou com 'outro', viram TSE). */
function comCasa(lista: Politico[]): Politico[] {
  return lista.map((p) => ({ ...p, casa: p.casa && (p.casa as string) !== 'outro' ? p.casa : casaDoCargo(p.cargo) }));
}

/** O Supabase devolve no máximo 1000 linhas por pedido: busca de 1000 em 1000 (até 10 mil). */
async function todasAsPaginas(
  pedir: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<Politico[]> {
  const TAM = 1000;
  const todos: Politico[] = [];
  for (let de = 0; de < 10 * TAM; de += TAM) {
    const { data, error } = await pedir(de, de + TAM - 1);
    if (error) throw new Error('Não foi possível carregar os políticos.');
    todos.push(...((data ?? []) as Politico[]));
    if (!data || data.length < TAM) break;
  }
  return todos;
}

/**
 * Prefeitos, vices e vereadores de um estado (e cidade). Sem Supabase: lista vazia (sem dados por enquanto).
 * Vereador exige a cidade. municipioBusca é o nome sem acento e minúsculo (ver normalizarCidade).
 */
const cacheLocal = new Map<string, Promise<Politico[]>>();
export function politicosDoLocal(cargo: string, uf: string, municipioBusca = ''): Promise<Politico[]> {
  const cidade = normalizarCidade(municipioBusca);
  if (!supabase || !uf || (PRECISA_CIDADE.includes(cargo) && !cidade)) return Promise.resolve([]);
  const chave = `${cargo}|${uf}|${cidade}`;
  if (!cacheLocal.has(chave)) {
    const p = todasAsPaginas((de, ate) => {
      let q = supabase!.from('politicos').select('*').eq('cargo', cargo).eq('uf', uf);
      if (cidade) q = q.eq('municipio_busca', cidade);
      return q.order('nome').order('id').range(de, ate);
    }).then(comCasa);
    p.catch(() => cacheLocal.delete(chave));
    cacheLocal.set(chave, p);
  }
  return cacheLocal.get(chave)!;
}

/** Cidades de um estado com prefeito(a) eleito(a) no TSE, em ordem alfabética (para escolher a cidade). */
const cacheCidades = new Map<string, Promise<{ nome: string; busca: string }[]>>();
export function cidadesDoEstado(uf: string): Promise<{ nome: string; busca: string }[]> {
  if (!supabase || !uf) return Promise.resolve([]);
  if (!cacheCidades.has(uf)) {
    const p = todasAsPaginas((de, ate) =>
      supabase!.from('politicos').select('municipio, municipio_busca').eq('cargo', 'Prefeito(a)').eq('uf', uf).order('municipio_busca').range(de, ate),
    ).then((linhas) => {
      const mapa = new Map<string, string>();
      for (const l of linhas as unknown as { municipio: string | null; municipio_busca: string | null }[]) {
        if (l.municipio && l.municipio_busca) mapa.set(l.municipio_busca, l.municipio);
      }
      return [...mapa].map(([busca, nome]) => ({ nome, busca })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    });
    p.catch(() => cacheCidades.delete(uf));
    cacheCidades.set(uf, p);
  }
  return cacheCidades.get(uf)!;
}

/** Quantos nomes o cargo tem no banco (sem baixar a lista). Sem Supabase: só deputados e senadores. */
export async function totalDoCargo(cargo: string): Promise<number> {
  if (!supabase) {
    if (!CARGOS.find((c) => c.nome === cargo)?.fonte) return 0;
    return (await todosDoCargo(cargo)).length;
  }
  const { count, error } = await supabase.from('politicos').select('id', { count: 'exact', head: true }).eq('cargo', cargo);
  if (error) throw new Error('Não foi possível contar os políticos.');
  return count ?? 0;
}

/** Um bem declarado ao TSE na candidatura (descrição já vem com CPF de terceiros escondido). */
export interface BemDeclarado { ordem: number; tipo: string | null; descricao: string | null; valor: number | null; ano: number }

/** Bens declarados na candidatura, na ordem do TSE. Sem Supabase: lista vazia. */
export async function bensDe(id: number): Promise<BemDeclarado[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('politico_bens').select('ordem, tipo, descricao, valor, ano').eq('politico_id', id).order('ano', { ascending: false }).order('ordem');
  if (error) throw new Error('Não foi possível carregar os bens declarados.');
  return (data ?? []) as BemDeclarado[];
}

/** "Eleito em 2022", "Eleita em 2024" (o banco já manda pronto; registros antigos tinham "Eleito(a) em 2024 (eleito)"). */
export function situacaoCurta(p: Pick<Politico, 'situacao' | 'genero'>): string {
  const s = (p.situacao ?? '').replace(/\s*\(.*\)\s*$/, '').trim();
  if (s && !s.includes('(a)')) return s;
  const ano = p.situacao?.match(/\d{4}/)?.[0];
  const palavra = p.genero === 'F' ? 'Eleita' : p.genero === 'M' ? 'Eleito' : 'Eleito(a)';
  return ano ? `${palavra} em ${ano}` : palavra;
}

/** Perfil de um eleito do TSE (presidente, governador, prefeito, vereador...). Sem Supabase: null. */
export async function obterTse(id: number): Promise<Politico | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('politicos').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Não foi possível carregar o perfil.');
  if (!data) return null;
  const p = comCasa([data as Politico])[0];
  return p.casa === 'tse' ? p : null;
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
 * TSE (prefeitos, vereadores...) em /politicos/tse/:id; senador em /politicos/senado/:id (dados do Senado);
 * o resto em /politicos/:id (Câmara).
 */
export function rotaPolitico(p: { id: number | string; casa?: string | null; cargo?: string | null }): (string | number)[] {
  if (p.casa === 'tse') return ['/politicos/tse', p.id];
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
