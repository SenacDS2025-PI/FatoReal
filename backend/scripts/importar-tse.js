// Importa para o Supabase TODOS os eleitos dos cargos que a Câmara e o Senado não cobrem:
// Presidente, Governadores, Deputados Estaduais/Distritais, Prefeitos e Vereadores (e vices).
// Fonte: TSE, Portal de Dados Abertos (arquivos da pasta "odsele" do CDN do TSE).
//
// Antes (uma vez por banco, dev e prod), no SQL Editor do Supabase:
//   supabase/politicos-todos-os-cargos.sql  e  supabase/politicos-tse-detalhes.sql
//
// Arquivos (baixe no navegador e extraia: botão direito → Extrair tudo):
//   OBRIGATÓRIO — candidatos (cria/atualiza os perfis):
//     https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2022.zip
//     https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2024.zip
//   OPCIONAL — bens declarados (tabela politico_bens + bens_total):
//     https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2022.zip
//     https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_2024.zip
//   OPCIONAL — votos (votos + turno; arquivos grandes, a leitura demora alguns minutos):
//     https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip
//     https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2024.zip
//
// Uso (na pasta backend, com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env):
//   npm run importar-tse -- <pasta> <pasta> ...
// Passe TODAS as pastas extraídas de uma vez (o script reconhece cada arquivo pelo nome).
// As pastas de candidatos são obrigatórias: os bens e os votos são ligados aos eleitos delas.
//
// Pode rodar quantas vezes quiser (atualiza por id = SQ_CANDIDATO).
// ⚠️ A chave service_role ignora o RLS: use SÓ aqui, no seu computador.
import { createHash } from 'node:crypto';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { eleitosDoCsv, bensDoCsv, votosDoCsv } from '../src/services/tse.js';

const pastas = process.argv.slice(2);
if (!pastas.length) {
  console.error('Diga as pastas extraídas do TSE. Ex.: npm run importar-tse -- C:\\Downloads\\consulta_cand_2024 C:\\Downloads\\bem_candidato_2024');
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

const TIPOS = ['consulta_cand', 'bem_candidato', 'votacao_candidato_munzona'];

// Arquivos de cada tipo e ano. Usa o do Brasil inteiro (…_BRASIL.csv) se existir; senão, os das UFs.
function arquivosPorTipo(listaDePastas) {
  const achados = {}; // tipo → ano → { brasil, ufs[] }
  for (const pasta of listaDePastas) {
    const ehPasta = statSync(pasta).isDirectory();
    const nomes = ehPasta ? readdirSync(pasta) : [basename(pasta)];
    for (const nome of nomes) {
      const m = nome.match(/^(consulta_cand|bem_candidato|votacao_candidato_munzona)_(\d{4})_([A-Z]{2,6})\.csv$/i);
      if (!m) continue;
      const [, tipo, ano, uf] = m;
      const caminho = ehPasta ? join(pasta, nome) : pasta;
      const g = ((achados[tipo.toLowerCase()] ??= {})[ano] ??= { brasil: null, ufs: [] });
      if (uf.toUpperCase() === 'BRASIL') g.brasil = caminho;
      else g.ufs.push(caminho);
    }
  }
  const final = {};
  for (const tipo of TIPOS) {
    final[tipo] = Object.entries(achados[tipo] ?? {}).map(([ano, g]) => ({ ano: Number(ano), arquivos: g.brasil ? [g.brasil] : g.ufs }));
  }
  return final;
}

const linhasDe = (arquivo) =>
  createInterface({ input: createReadStream(arquivo, { encoding: 'latin1' }), crlfDelay: Infinity });

// A foto é de verdade? O DivulgaCand devolve um boneco padrão quando não acha a foto; comparamos
// com a resposta para um candidato que não existe. Igual ou sem imagem → não salva fotos.
async function baixarImagem(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !String(res.headers.get('content-type')).startsWith('image/')) return null;
    return createHash('sha1').update(Buffer.from(await res.arrayBuffer())).digest('hex');
  } catch {
    return null;
  }
}

async function fotosFuncionam(exemplo) {
  const real = await baixarImagem(exemplo.foto_url);
  if (!real) return false;
  const padrao = await baixarImagem(exemplo.foto_url.replace(/\/\d+\/([^/]+)$/, '/1/$1'));
  return real !== padrao;
}

async function emLotes(lista, tamanho, rotulo, fn) {
  for (let i = 0; i < lista.length; i += tamanho) {
    await fn(lista.slice(i, i + tamanho));
    process.stdout.write(`\r   ${rotulo}: ${Math.min(i + tamanho, lista.length)}/${lista.length}`);
  }
  process.stdout.write('\n');
}

function erroDoBanco(error) {
  if (/municipio/.test(error.message)) return 'Falta a coluna "municipio". Rode supabase/politicos-todos-os-cargos.sql antes.';
  if (/numero_urna|ocupacao|reeleicao|coligacao|genero|bens_total|votos|turno|politico_bens/.test(error.message)) {
    return 'Faltam as colunas/tabela novas. Rode supabase/politicos-tse-detalhes.sql antes.';
  }
  return `Supabase: ${error.message}`;
}

async function main() {
  const arquivos = arquivosPorTipo(pastas);
  if (!arquivos.consulta_cand.length) {
    throw new Error('Nenhum arquivo consulta_cand_<ano>_<UF>.csv encontrado. Inclua as pastas de candidatos.');
  }

  // 1. Candidatos eleitos
  const agora = new Date().toISOString();
  const politicos = new Map();
  const anoDe = new Map(); // id → ano da eleição
  for (const { ano, arquivos: lista } of arquivos.consulta_cand) {
    for (const arquivo of lista) {
      console.log(`📄 Candidatos: ${basename(arquivo)}…`);
      for (const p of await eleitosDoCsv(linhasDe(arquivo), agora)) {
        politicos.set(p.id, p);
        anoDe.set(p.id, ano);
      }
    }
  }
  if (!politicos.size) throw new Error('Nenhum eleito encontrado. Confira se a pasta é a do "consulta_cand" extraído.');
  const ids = new Set(politicos.keys());

  // 2. Bens (opcional)
  const bensPorAno = new Map(); // ano → linhas de politico_bens
  for (const { ano, arquivos: lista } of arquivos.bem_candidato) {
    const linhasAno = [];
    for (const arquivo of lista) {
      console.log(`💰 Bens: ${basename(arquivo)}…`);
      const { bens, totais } = await bensDoCsv(linhasDe(arquivo), ids);
      linhasAno.push(...bens);
      for (const [id, total] of totais) politicos.get(id).bens_total = Math.round(((politicos.get(id).bens_total ?? 0) + total) * 100) / 100;
    }
    // Eleito daquele ano sem nenhum bem declarado → total 0 (não "sem dados").
    for (const [id, p] of politicos) if (anoDe.get(id) === ano) p.bens_total ??= 0;
    bensPorAno.set(ano, linhasAno);
  }

  // 3. Votos (opcional)
  for (const { arquivos: lista } of arquivos.votacao_candidato_munzona) {
    const votos = new Map();
    for (const arquivo of lista) {
      console.log(`🗳️  Votos: ${basename(arquivo)} (arquivo grande, aguarde)…`);
      await votosDoCsv(linhasDe(arquivo), ids, votos);
    }
    for (const [id, v] of votos) Object.assign(politicos.get(id), v);
  }

  // 4. Fotos
  const linhas = [...politicos.values()];
  const exemplo = linhas.find((l) => l.foto_url);
  if (exemplo) {
    if (await fotosFuncionam(exemplo)) {
      console.log(`📷 Fotos ok. Confira uma no navegador: ${exemplo.foto_url}`);
    } else {
      console.warn('⚠️ As fotos do TSE não abriram (ou só vem o boneco padrão): salvando sem foto (o site mostra as iniciais).');
      for (const l of linhas) l.foto_url = null;
    }
  }

  const porCargo = {};
  for (const l of linhas) porCargo[l.cargo] = (porCargo[l.cargo] ?? 0) + 1;
  console.log('👥 Eleitos por cargo:', porCargo);

  // 5. Salvar políticos
  await emLotes(linhas, 500, 'políticos salvos', async (lote) => {
    const { error } = await supabase.from('politicos').upsert(lote, { onConflict: 'id' });
    if (error) throw new Error(erroDoBanco(error));
  });

  // 6. Salvar bens: troca todos os bens daquele ano (assim um bem retirado pelo TSE some daqui também).
  for (const [ano, bens] of bensPorAno) {
    const { error: erroApagar } = await supabase.from('politico_bens').delete().eq('ano', ano);
    if (erroApagar) throw new Error(erroDoBanco(erroApagar));
    await emLotes(bens, 1000, `bens de ${ano} salvos`, async (lote) => {
      const { error } = await supabase.from('politico_bens').insert(lote);
      if (error) throw new Error(erroDoBanco(error));
    });
  }

  console.log(`✅ ${linhas.length} políticos do TSE salvos` +
    (bensPorAno.size ? `, com ${[...bensPorAno.values()].reduce((s, b) => s + b.length, 0)} bens` : '') +
    (arquivos.votacao_candidato_munzona.length ? ' e votos' : '') + '.');
  if (!bensPorAno.size) console.log('   (sem pasta bem_candidato: bens não atualizados)');
  if (!arquivos.votacao_candidato_munzona.length) console.log('   (sem pasta votacao_candidato_munzona: votos não atualizados)');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
