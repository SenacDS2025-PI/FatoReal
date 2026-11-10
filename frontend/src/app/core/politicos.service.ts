import { Injectable } from '@angular/core';
import { Politico } from './modelos';
import { supabase } from './supabase';

const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2';

export interface FiltroPoliticos {
  termo?: string;
  partido?: string;
  uf?: string;
}

/**
 * Busca e perfil de políticos.
 * - Com Supabase: lê a tabela "politicos" (10 a 20 deputados importados pela equipe de back).
 * - Sem Supabase (demo): consulta direto a API de Dados Abertos da Câmara.
 * Em ambos os casos, todo dado vem com fonte e data de coleta.
 */
@Injectable({ providedIn: 'root' })
export class PoliticosService {
  async buscar(filtro: FiltroPoliticos): Promise<Politico[]> {
    const termo = filtro.termo?.trim() ?? '';
    const partido = filtro.partido?.trim().toUpperCase() ?? '';
    const uf = filtro.uf ?? '';

    if (supabase) {
      let q = supabase.from('politicos').select('*').order('nome').limit(50);
      if (termo) q = q.ilike('nome', `%${termo}%`);
      if (partido) q = q.ilike('partido', partido);
      if (uf) q = q.eq('uf', uf);
      const { data, error } = await q;
      if (error) throw new Error('Não foi possível buscar os políticos.');
      return data as Politico[];
    }

    const params = new URLSearchParams({ itens: '30', ordem: 'ASC', ordenarPor: 'nome' });
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
    if (supabase) {
      const { data, error } = await supabase.from('politicos').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error('Não foi possível carregar o perfil.');
      return data as Politico | null;
    }

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
    gabinete?: { email?: string };
  };
}
