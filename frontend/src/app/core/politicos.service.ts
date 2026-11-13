import { Injectable } from '@angular/core';
import { Politico } from './modelos';

const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';

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
  despesas: { ano: number; total: number; lancamentos: number; parcial: boolean; porTipo: { tipo: string; valor: number }[] } | null;
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
async function despesasDoAno(id: number): Promise<DetalhesPolitico['despesas']> {
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
    for (const i of itens) porTipo.set(i.tipoDespesa, (porTipo.get(i.tipoDespesa) ?? 0) + (i.valorLiquido ?? 0));
    return {
      ano,
      total: itens.reduce((t, i) => t + (i.valorLiquido ?? 0), 0),
      lancamentos: itens.length,
      parcial: !!url,
      porTipo: [...porTipo]
        .map(([tipo, valor]) => ({ tipo: tipoLegivel(tipo), valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5),
    };
  }
  return null;
}

/** Siglas dos partidos com deputados, para sugerir no filtro. */
export async function partidosCamara(): Promise<string[]> {
  const r = await jsonCamara<{ dados: { sigla: string }[] }>('/partidos?itens=100&ordem=ASC&ordenarPor=sigla');
  return r.dados.map((p) => p.sigla);
}

/** Legislaturas começam em 1º de fevereiro de 2023, 2027, 2031... */
function inicioLegislatura(): string {
  const hoje = new Date();
  let ano = hoje.getFullYear() - ((((hoje.getFullYear() - 2023) % 4) + 4) % 4);
  if (ano === hoje.getFullYear() && hoje.getMonth() < 1) ano -= 4;
  return `${ano}-02-01`;
}

async function jsonCamara<T>(caminho: string): Promise<T> {
  const url = caminho.startsWith('http') ? caminho : CAMARA_API + caminho;
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

/** fetch com mensagem amigável quando não há internet ou a API está fora do ar. */
async function buscarCamara(url: string): Promise<Response> {
  try {
    return await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
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
interface DespesaCamara { tipoDespesa: string; valorLiquido: number }
interface LinkCamara { rel: string; href: string }
