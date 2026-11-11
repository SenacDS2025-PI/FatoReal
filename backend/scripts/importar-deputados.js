// Importa os deputados em exercício da API de Dados Abertos da Câmara para a
// tabela `politicos` do Supabase. Pode rodar quantas vezes quiser (atualiza por id).
//
// Uso (na pasta backend, com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env):
//   npm run importar            → todos os deputados em exercício
//   npm run importar -- 20      → só os 20 primeiros (teste rápido)
//
// ⚠️ A chave service_role ignora o RLS: use SÓ aqui, no seu computador.
// Nunca coloque essa chave na Vercel, no Angular ou no GitHub.
import { createClient } from '@supabase/supabase-js';
import { CAMARA_API } from '../src/services/camara-fonte.js';

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

  for (let i = 0; i < linhas.length; i += 100) {
    const { error } = await supabase
      .from('politicos')
      .upsert(linhas.slice(i, i + 100), { onConflict: 'id' });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  console.log(`✅ ${linhas.length} deputados salvos na tabela politicos.`);
  if (incompletos) {
    console.log(`⚠️  ${incompletos} ficaram só com os dados básicos (a Câmara não respondeu o perfil).`);
    console.log('   Rode de novo mais tarde para completar.');
  }
}

main().catch((err) => {
  console.error('❌ Falhou:', err.message);
  process.exit(1);
});
