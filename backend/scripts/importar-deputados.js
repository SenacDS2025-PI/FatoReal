// Importa para a tabela `politicos` do Supabase:
//   - os deputados federais em exercício (API de Dados Abertos da Câmara);
//   - os senadores em exercício (API de Dados Abertos do Senado).
// Pode rodar quantas vezes quiser (atualiza por id).
//
// Uso (na pasta backend, com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env):
//   npm run importar            → todos os deputados e senadores em exercício
//   npm run importar -- 20      → só os 20 primeiros deputados (teste rápido) + senadores
//
// As APIs da Câmara e do Senado podem bloquear acesso de fora do Brasil: rode no Brasil.
//
// ⚠️ A chave service_role ignora o RLS: use SÓ aqui, no seu computador.
// Nunca coloque essa chave na Vercel, no Angular ou no GitHub.
import { createClient } from '@supabase/supabase-js';
import { CAMARA_API } from '../src/services/camara-fonte.js';
import {
  SENADO_LISTA,
  CARGO_DEPUTADO,
  CARGO_SENADOR,
  senadoresDaLista,
  idsEmConflito,
  idsParaRemover,
} from '../src/services/senado.js';

const LIMITE = Number(process.argv[2]) || Infinity;
const CONCORRENCIA = 4;
const TENTATIVAS = 3;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no arquivo .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(caminho) {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(`${CAMARA_API}${caminho}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Câmara respondeu ${res.status}`);
      return await res.json();
    } catch (err) {
      if (t >= TENTATIVAS) throw err;
      await esperar(2000 * t);
    }
  }
}

async function listar() {
  const todos = [];
  for (let pagina = 1; ; pagina++) {
    const json = await buscar(`/deputados?ordem=ASC&ordenarPor=nome&itens=100&pagina=${pagina}`);
    todos.push(...json.dados);
    if (!json.links?.some((l) => l.rel === 'next') || json.dados.length === 0) break;
  }
  return todos.slice(0, LIMITE);
}

// Monta a linha da tabela. Começa com o que veio na lista e completa com o perfil.
// Não guarda CPF nem outros dados pessoais desnecessários (LGPD).
async function montarLinha(d) {
  const agora = new Date().toISOString();
  const linha = {
    id: d.id,
    nome: d.nome,
    partido: d.siglaPartido,
    uf: d.siglaUf,
    cargo: CARGO_DEPUTADO,
    foto_url: d.urlFoto,
    email: d.email,
    fonte_url: `${CAMARA_API}/deputados/${d.id}`,
    data_coleta: agora,
    atualizado_em: agora,
  };
  try {
    const { dados: p } = await buscar(`/deputados/${d.id}`);
    const s = p.ultimoStatus ?? {};
    Object.assign(linha, {
      nome: s.nome ?? linha.nome,
      nome_civil: p.nomeCivil,
      situacao: s.situacao,
      escolaridade: p.escolaridade,
      data_nascimento: p.dataNascimento,
      municipio_nascimento: p.municipioNascimento,
      email: s.gabinete?.email ?? linha.email,
    });
    return { linha, completo: true };
  } catch {
    return { linha, completo: false };
  }
}

async function main() {
  console.log('Buscando a lista de deputados na Câmara...');
  const deputados = await listar();
  console.log(`${deputados.length} deputados. Buscando os perfis...`);

  const linhas = [];
  let incompletos = 0;
  for (let i = 0; i < deputados.length; i += CONCORRENCIA) {
    const lote = await Promise.all(deputados.slice(i, i + CONCORRENCIA).map(montarLinha));
    for (const { linha, completo } of lote) {
      linhas.push(linha);
      if (!completo) incompletos++;
    }
    process.stdout.write(`\r  ${linhas.length}/${deputados.length}`);
  }
  console.log();

  await salvar(linhas);
  console.log(`✅ ${linhas.length} deputados salvos na tabela politicos.`);
  // Só limpa com a lista COMPLETA (no teste rápido com "-- 20" não apaga ninguém).
  if (LIMITE === Infinity) await removerAntigos(CARGO_DEPUTADO, linhas, 500, 'deputados');
  if (incompletos) {
    console.log(`⚠️  ${incompletos} ficaram só com os dados básicos (a Câmara não respondeu o perfil).`);
    console.log('   Rode de novo mais tarde para completar.');
  }

  // Senadores: se o Senado falhar, os deputados já estão salvos.
  console.log('Buscando os senadores em exercício no Senado...');
  try {
    const senadores = senadoresDaLista(await buscarUrl(SENADO_LISTA));
    if (senadores.length < 70) throw new Error(`só ${senadores.length} senadores na lista (o esperado é 81)`);
    const conflitos = idsEmConflito(linhas, senadores);
    if (conflitos.length) throw new Error(`ids de senador iguais aos de deputados: ${conflitos.join(', ')}`);
    await salvar(senadores);
    console.log(`✅ ${senadores.length} senadores salvos na tabela politicos.`);
    await removerAntigos(CARGO_SENADOR, senadores, 70, 'senadores');
  } catch (err) {
    console.log(`⚠️  Senadores não importados: ${err.message}. Rode de novo mais tarde.`);
  }
}

// Apaga do banco quem tem esse cargo mas não está mais na lista oficial (saiu do mandato).
// Segurança: só roda se a lista nova tiver pelo menos `minimo` pessoas (lista vazia ou cortada
// por falha da API nunca apaga a tabela).
async function removerAntigos(cargo, linhasAtuais, minimo, rotulo) {
  if (linhasAtuais.length < minimo) return;
  const { data, error } = await supabase.from('politicos').select('id, nome').eq('cargo', cargo);
  if (error) throw new Error(`Supabase: ${error.message}`);
  const remover = idsParaRemover((data ?? []).map((d) => d.id), linhasAtuais);
  if (!remover.length) return;
  const nomes = data.filter((d) => remover.includes(Number(d.id))).map((d) => d.nome);
  const { error: erroApagar } = await supabase.from('politicos').delete().eq('cargo', cargo).in('id', remover);
  if (erroApagar) throw new Error(`Supabase: ${erroApagar.message}`);
  console.log(`🧹 ${remover.length} ${rotulo} que saíram do cargo foram removidos: ${nomes.join(', ')}`);
}

async function salvar(linhas) {
  for (let i = 0; i < linhas.length; i += 100) {
    const { error } = await supabase.from('politicos').upsert(linhas.slice(i, i + 100), { onConflict: 'id' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}

// Busca um endereço completo (ex.: a API do Senado), com novas tentativas.
async function buscarUrl(url) {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`respondeu ${res.status}`);
      return await res.json();
    } catch (err) {
      if (t >= TENTATIVAS) throw err;
      await esperar(2000 * t);
    }
  }
}

main().catch((err) => {
  console.error('❌ Falhou:', err.message);
  process.exit(1);
});
