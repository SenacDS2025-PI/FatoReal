// Leitura da tabela `politicos` no Supabase (cópia dos dados da Câmara).
//
// A API usa só a chave PÚBLICA (SUPABASE_ANON_KEY): a tabela tem leitura liberada
// pelo RLS e ninguém consegue alterar dados por aqui.
// A chave service_role é usada SÓ no script de importação (scripts/importar-deputados.js).
import { createClient } from '@supabase/supabase-js';
import { FONTE_NOME } from './camara-fonte.js';
import { CARGO_DEPUTADO } from './senado.js';

let client;

export function supabaseConfigurado() {
  return Boolean(client) || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function getClient() {
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

// Só para os testes trocarem o cliente por um falso.
export function _setClient(fake) {
  client = fake;
}

// A "fonte" continua sendo a Câmara; a data é a da coleta feita pelo script.
function fonteDaCopia(url, dataColeta) {
  return { nome: `${FONTE_NOME} (cópia salva no Fato Real)`, url, consultadoEm: dataColeta };
}

// Mesmo formato de listarDeputados() da Câmara. Retorna null se não houver dados.
export async function listarDoSupabase() {
  const { data, error } = await getClient()
    .from('politicos')
    .select('id, nome, partido, uf, foto_url, data_coleta')
    .eq('cargo', CARGO_DEPUTADO) // a tabela também tem senadores: aqui só deputados
    .order('nome');
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data?.length) return null;

  const maisAntiga = data.reduce((min, d) => (d.data_coleta < min ? d.data_coleta : min), data[0].data_coleta);
  return {
    dados: data.map((d) => ({ id: d.id, nome: d.nome, partido: d.partido, uf: d.uf, foto: d.foto_url })),
    fonte: fonteDaCopia('https://dadosabertos.camara.leg.br/api/v2/deputados', maisAntiga),
  };
}

// Mesmo formato de obterDeputado() da Câmara (com menos campos). Retorna null se não achar.
export async function obterDoSupabase(id) {
  const { data, error } = await getClient().from('politicos').select('*').eq('id', id).eq('cargo', CARGO_DEPUTADO).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) return null;

  return {
    dados: {
      id: data.id,
      nome: data.nome,
      nomeCivil: data.nome_civil,
      partido: data.partido,
      uf: data.uf,
      foto: data.foto_url,
      situacao: data.situacao,
      escolaridade: data.escolaridade,
      municipioNascimento: data.municipio_nascimento,
      gabinete: data.email ? { email: data.email } : null,
      redesSociais: [],
    },
    fonte: fonteDaCopia(data.fonte_url, data.data_coleta),
  };
}

// J12 — para o /api/health/fontes. O início do endereço do projeto não é segredo
// (vai no código do site) e ajuda a saber se é o banco de dev ou de produção.
export function projetoSupabase() {
  const host = String(process.env.SUPABASE_URL ?? '').replace(/^https?:\/\//, '').split('.')[0];
  return host ? `${host.slice(0, 6)}…` : null;
}

export async function contarPoliticos(cargo = CARGO_DEPUTADO) {
  const { count, error } = await getClient().from('politicos').select('id', { count: 'exact', head: true }).eq('cargo', cargo);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return count ?? 0;
}

// Políticos de outros cargos (Senado e TSE) para o FatoBot. Supabase devolve no máximo 1000 linhas
// por pedido; aqui sempre pedimos bem menos (`limite`).
export async function consultarPoliticos({ cargos, uf, municipioBusca, limite = 200 }) {
  let q = getClient()
    .from('politicos')
    .select('id, nome, partido, uf, cargo, municipio, situacao, fonte_url, data_coleta')
    .in('cargo', cargos);
  if (uf) q = q.eq('uf', uf);
  if (municipioBusca) q = q.eq('municipio_busca', municipioBusca);
  const { data, error } = await q.order('nome').limit(limite);
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data ?? [];
}
