// Leitura da tabela `politicos` no Supabase (cópia dos dados da Câmara).
//
// A API usa só a chave PÚBLICA (SUPABASE_ANON_KEY): a tabela tem leitura liberada
// pelo RLS e ninguém consegue alterar dados por aqui.
// A chave service_role é usada SÓ no script de importação (scripts/importar-deputados.js).
import { createClient } from '@supabase/supabase-js';
import { FONTE_NOME } from './camara-fonte.js';

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
  const { data, error } = await getClient().from('politicos').select('*').eq('id', id).maybeSingle();
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
