// Gera a lista de projetos de cada deputado que VIRARAM LEI nesta legislatura (desde 01/02/2023).
//
// Por que um script: a API da Câmara ignora o filtro de situação (codSituacao) na lista de
// proposições, e abrir projeto por projeto leva minutos e gera bloqueio (429). Os arquivos
// completos da Câmara (atualizados todo dia) trazem a situação atual de cada proposição.
//
// Uso:  cd backend && npm run gerar-leis
// Saída: backend/src/data/leis-deputados.json  (FatoBot)
//        frontend/public/dados/leis-deputados.json  (perfil do político)
// Rodar de novo antes da apresentação para atualizar (leva 1–3 minutos; baixa ~380 MB).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ARQUIVOS = 'https://dadosabertos.camara.leg.br/arquivos';
const INICIO = '2023-02-01';
const ANOS = [];
for (let a = 2023; a <= new Date().getFullYear(); a++) ANOS.push(a);
const TIPOS = new Set(['PL', 'PLP', 'PEC', 'PDL']);
const VIROU_LEI = '1140'; // "Transformado em Norma Jurídica"

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SAIDAS = [join(raiz, 'backend/src/data/leis-deputados.json'), join(raiz, 'frontend/public/dados/leis-deputados.json')];

/** CSV da Câmara: separado por ";", campos entre aspas, "" = aspas dentro do campo, pode ter quebra de linha. */
export function lerCsv(texto) {
  const linhas = [];
  let campo = '';
  let linha = [];
  let aspas = false;
  for (let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') (campo += '"'), i++;
        else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') linha.push(campo), (campo = '');
    else if (c === '\n') linha.push(campo.replace(/\r$/, '')), linhas.push(linha), (linha = []), (campo = '');
    else campo += c;
  }
  if (campo || linha.length) linha.push(campo), linhas.push(linha);
  const [cab, ...resto] = linhas;
  return resto.filter((l) => l.length === cab.length).map((l) => Object.fromEntries(cab.map((k, i) => [k, l[i]])));
}

// --pasta <dir>: lê os CSVs já baixados (o servidor da Câmara corta downloads longos; dá para baixar
// com "curl -C - --retry 40 -O <url>", que continua de onde parou, e passar a pasta aqui).
const iPasta = process.argv.indexOf('--pasta');
const PASTA = iPasta > 0 ? process.argv[iPasta + 1] : null;

async function baixar(caminho, tentativa = 1) {
  if (PASTA) {
    const texto = readFileSync(join(PASTA, caminho.split('/').at(-1)), 'utf8');
    console.log(`  ${caminho}: ${(texto.length / 1e6).toFixed(0)} MB (arquivo local)`);
    return lerCsv(texto);
  }
  return baixarDaInternet(caminho, tentativa);
}

// O servidor da Câmara às vezes corta o download no meio: tenta de novo até 4 vezes.
async function baixarDaInternet(caminho, tentativa = 1) {
  const url = `${ARQUIVOS}/${caminho}`;
  const t = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`${url} respondeu ${res.status}`);
    const texto = await res.text();
    console.log(`  ${caminho}: ${(texto.length / 1e6).toFixed(0)} MB em ${((Date.now() - t) / 1000).toFixed(0)} s`);
    return lerCsv(texto);
  } catch (err) {
    if (tentativa >= 4) throw err;
    console.warn(`  ${caminho}: falhou (${err.message}); tentando de novo...`);
    await new Promise((r) => setTimeout(r, 3000 * tentativa));
    return baixarDaInternet(caminho, tentativa + 1);
  }
}

async function main() {
  console.log(`Baixando os arquivos da Câmara (${ANOS.join(', ')})...`);
  const projetos = new Map(); // id → dados do projeto
  for (const ano of ANOS) {
    for (const p of await baixar(`proposicoes/csv/proposicoes-${ano}.csv`)) {
      if (!TIPOS.has(p.siglaTipo) || (p.dataApresentacao ?? '') < INICIO) continue;
      projetos.set(p.id, {
        id: Number(p.id),
        sigla: p.siglaTipo,
        numero: Number(p.numero),
        ano: Number(p.ano),
        ementa: p.ementa.trim(),
        apresentacao: p.dataApresentacao.slice(0, 10),
        virouLei: p.ultimoStatus_idSituacao === VIROU_LEI,
        situacao: p.ultimoStatus_descricaoSituacao,
      });
    }
  }
  console.log(`${projetos.size} projetos (PL, PLP, PEC, PDL) apresentados desde ${INICIO}.`);

  const porDeputado = new Map(); // idDeputado → Set de ids de projeto
  for (const ano of ANOS) {
    for (const a of await baixar(`proposicoesAutores/csv/proposicoesAutores-${ano}.csv`)) {
      if (!a.idDeputadoAutor || !projetos.has(a.idProposicao)) continue;
      if (!porDeputado.has(a.idDeputadoAutor)) porDeputado.set(a.idDeputadoAutor, new Set());
      porDeputado.get(a.idDeputadoAutor).add(a.idProposicao);
    }
  }

  const deputados = {};
  for (const [id, ids] of porDeputado) {
    const lista = [...ids].map((x) => projetos.get(x));
    deputados[id] = {
      projetos: lista.length,
      leis: lista
        .filter((p) => p.virouLei)
        .sort((a, b) => b.apresentacao.localeCompare(a.apresentacao))
        .map(({ id: pid, sigla, numero, ano, ementa }) => ({ id: pid, sigla, numero, ano, ementa })),
    };
  }
  const saida = {
    geradoEm: new Date().toISOString(),
    desde: INICIO,
    fonte: 'Dados Abertos da Câmara dos Deputados — arquivos de proposições e autores',
    fonteUrl: 'https://dadosabertos.camara.leg.br/swagger/api.html#staticfile',
    regra: 'Projetos PL, PLP, PEC e PDL apresentados desde 01/02/2023, de autoria ou coautoria do deputado, com situação atual "Transformado em Norma Jurídica" (código 1140).',
    deputados,
  };
  for (const f of SAIDAS) {
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, JSON.stringify(saida));
    console.log(`Gravado: ${f}`);
  }
  const comLei = Object.values(deputados).filter((d) => d.leis.length).length;
  console.log(`${Object.keys(deputados).length} deputados com projetos; ${comLei} com pelo menos um que virou lei.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
