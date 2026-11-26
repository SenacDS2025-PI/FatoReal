// Importa para a tabela `politicos` do Supabase TODOS os eleitos dos cargos que a Câmara e o
// Senado não cobrem: Presidente, Governadores, Deputados Estaduais/Distritais, Prefeitos e
// Vereadores (e vices). Fonte: TSE, arquivos "Candidatos" do Portal de Dados Abertos.
//
// Antes (uma vez por banco): rodar supabase/politicos-todos-os-cargos.sql no SQL Editor.
//
// Passo a passo (na pasta backend, com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env):
//   1. Baixe no navegador e extraia (botão direito → Extrair tudo):
//      https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip
//      https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip
//   2. npm run importar-tse -- C:\caminho\consulta_cand_2022 C:\caminho\consulta_cand_2024
//
// Pode rodar quantas vezes quiser (atualiza por id = número sequencial do candidato no TSE).
// ⚠️ A chave service_role ignora o RLS: use SÓ aqui, no seu computador.
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { eleitosDoCsv } from '../src/services/tse.js';

const pastas = process.argv.slice(2);
if (!pastas.length) {
  console.error('Diga a(s) pasta(s) extraída(s) do TSE. Ex.: npm run importar-tse -- C:\\Downloads\\consulta_cand_2024');
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Usa o arquivo do Brasil inteiro (…_BRASIL.csv) se existir; senão, os de cada UF.
function arquivosCsv(pasta) {
  const caminho = statSync(pasta).isDirectory() ? pasta : null;
  if (!caminho) return [pasta];
  const csvs = readdirSync(caminho).filter((f) => /^consulta_cand_\d{4}_[A-Z]{2,6}\.csv$/i.test(f));
  const brasil = csvs.find((f) => /_BRASIL\.csv$/i.test(f));
  return (brasil ? [brasil] : csvs).map((f) => join(caminho, f));
}

const linhasDe = (arquivo) =>
  createInterface({ input: createReadStream(arquivo, { encoding: 'latin1' }), crlfDelay: Infinity });

// Confere se o endereço da foto do TSE abre; se não abrir, não salva fotos quebradas.
async function fotoFunciona(url) {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15_000) });
    return res.ok && String(res.headers.get('content-type')).startsWith('image/');
  } catch {
    return false;
  }
}

async function salvar(linhas) {
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabase.from('politicos').upsert(linhas.slice(i, i + 500), { onConflict: 'id' });
    if (error) {
      if (/municipio/.test(error.message)) {
        throw new Error('A tabela politicos ainda não tem a coluna "municipio". Rode supabase/politicos-todos-os-cargos.sql antes.');
      }
      throw new Error(`Supabase: ${error.message}`);
    }
    process.stdout.write(`\r   salvos ${Math.min(i + 500, linhas.length)}/${linhas.length}`);
  }
  process.stdout.write('\n');
}

const agora = new Date().toISOString();
const todos = new Map();
for (const pasta of pastas) {
  for (const arquivo of arquivosCsv(pasta)) {
    console.log(`📄 Lendo ${basename(arquivo)}…`);
    const eleitos = await eleitosDoCsv(linhasDe(arquivo), agora);
    for (const p of eleitos) todos.set(p.id, p);
    console.log(`   ${eleitos.length} eleitos encontrados`);
  }
}

const linhas = [...todos.values()];
if (!linhas.length) {
  console.error('Nenhum eleito encontrado. Confira se a pasta é a do "consulta_cand" extraído.');
  process.exit(1);
}

const exemplo = linhas.find((l) => l.foto_url);
if (exemplo && !(await fotoFunciona(exemplo.foto_url))) {
  console.warn('⚠️ As fotos do TSE não abriram daqui: salvando sem foto (o site mostra as iniciais).');
  for (const l of linhas) l.foto_url = null;
}

const porCargo = {};
for (const l of linhas) porCargo[l.cargo] = (porCargo[l.cargo] ?? 0) + 1;
console.log('🗳️  Eleitos por cargo:', porCargo);

try {
  await salvar(linhas);
  console.log(`✅ ${linhas.length} políticos do TSE salvos no Supabase.`);
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}
