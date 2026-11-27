// Atuação no mandato (services/atuacao.js) e o script das leis (scripts/gerar-leis-deputados.js).
import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { clearCache } from '../src/utils/cache.js';
import {
  CONFIG_ATUACAO,
  LIMITES_ATUACAO,
  _setLeisArquivo,
  atuacaoDeputado,
  atuacaoSenador,
  evidenciasRegistros,
  totalPeloLink,
  valorDespesa,
} from '../src/services/atuacao.js';
import { lerCsv } from '../scripts/gerar-leis-deputados.js';

const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
const ultima = (n) => ({ dados: [{}], links: [{ rel: 'last', href: `https://x/api?pagina=${n}&itens=1` }] });

// Câmara falsa: responde por trecho do endereço.
function camaraFalsa(url) {
  const u = String(url);
  if (u.includes('/proposicoes?') && u.includes('itens=1') && u.includes('siglaTipo=PL&')) return json(ultima(12));
  if (u.includes('/proposicoes?') && u.includes('itens=1')) return json({ dados: [], links: [] });
  if (u.includes('/proposicoes?') && u.includes('itens=3'))
    return json({ dados: [{ id: 99, siglaTipo: 'PL', numero: 10, ano: 2026, ementa: 'Cria o programa X.' }] });
  if (u.includes('/despesas'))
    return json({ dados: [{ valorDocumento: 100, valorGlosa: 0, valorLiquido: -100, dataDocumento: '2026-11-19' }, { valorDocumento: 50.5, valorLiquido: 50.5, dataDocumento: '2026-10-01' }], links: [] });
  if (u.includes('/discursos')) return json(ultima(7));
  if (/\/votacoes\?/.test(u)) return json({ dados: [{ id: 'v1', dataHoraRegistro: '2026-11-24T20:00:00', descricao: 'Aprovado o texto.' }] });
  if (u.endsWith('/votacoes/v1/votos')) return json({ dados: [{ tipoVoto: 'Sim', deputado_: { id: 1, siglaPartido: 'PSB' } }] });
  if (u.endsWith('/votacoes/v1')) return json({ dados: { proposicoesAfetadas: [{ siglaTipo: 'PL', numero: 5, ano: 2025, ementa: 'Trata de Y.' }] } });
  if (u.includes('/senador/7/autorias'))
    return json({
      MateriasAutoriaParlamentar: {
        Parlamentar: {
          Autorias: {
            Autoria: [
              { IndicadorAutorPrincipal: 'Sim', Materia: { Codigo: '1', Sigla: 'PL', Numero: '3', Ano: '2026', DescricaoIdentificacao: 'PL 3/2026', Ementa: 'Trata de Z.', Data: '2026-11-05' } },
              { IndicadorAutorPrincipal: 'Não', Materia: { Codigo: '2', Sigla: 'RQS', Numero: '1', Ano: '2023', Ementa: 'Sessão.', Data: '2023-03-01' } },
              { IndicadorAutorPrincipal: 'Sim', Materia: { Codigo: '3', Sigla: 'PL', Numero: '1', Ano: '2019', Ementa: 'Antigo.', Data: '2019-01-01' } },
            ],
          },
        },
      },
    });
  if (u.includes('/senador/7/votacoes'))
    return json({
      VotacaoParlamentar: {
        Parlamentar: {
          Votacoes: {
            Votacao: [
              { SessaoPlenaria: { DataSessao: '2026-11-18' }, Materia: { Codigo: '9', DescricaoIdentificacao: 'PLP 299/2026' }, DescricaoVotacao: 'Votação do texto', SiglaDescricaoVoto: 'Sim' },
              { SessaoPlenaria: { DataSessao: '2026-11-10' }, Materia: { Codigo: '8' }, SiglaDescricaoVoto: 'LS', DescricaoVoto: 'Licença saúde' },
            ],
          },
        },
      },
    });
  return json({}, 404);
}

beforeEach(() => {
  clearCache();
  CONFIG_ATUACAO.ligada = true;
  _setLeisArquivo({ geradoEm: '2026-11-27T10:00:00Z', deputados: { 1: { projetos: 8, leis: [{ id: 50, sigla: 'PL', numero: 1564, ano: 2024, ementa: 'Medidas emergenciais.' }] } } });
  mock.method(globalThis, 'fetch', async (url) => camaraFalsa(url));
});
afterEach(() => mock.restoreAll());

test('totalPeloLink lê o número da última página; sem link, conta os itens', () => {
  assert.equal(totalPeloLink(ultima(162)), 162);
  assert.equal(totalPeloLink({ dados: [1, 2], links: [] }), 2);
});

test('valorDespesa: usa documento − glosa (o líquido vem com sinal trocado)', () => {
  assert.equal(valorDespesa({ valorDocumento: 170, valorGlosa: 0, valorLiquido: -170 }), 170);
  assert.equal(valorDespesa({ valorLiquido: -40 }), 40);
});

test('deputado: projetos, leis, gastos, discursos e votos, cada um com fonte', async () => {
  const ev = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  const textos = ev.map((e) => e.texto).join('\n');
  assert.match(textos, /apresentou na Câmara: 12 projetos de lei\./);
  assert.match(textos, /PL 10\/2026, que trata de: "Cria o programa X\."/);
  assert.match(textos, /Dos 8 projetos .* 1 virou lei, segundo a situação registrada na Câmara em 27\/11\/2026/);
  assert.match(textos, /Virou lei: PL 1564\/2024/);
  assert.match(textos, /R\$\s?150,50 da cota parlamentar, em 2 despesas/);
  assert.match(textos, /fez 7 discursos/);
  assert.match(textos, /registrou voto em 1\./);
  assert.match(textos, /sobre o PL 5\/2025, que trata de: "Trata de Y\." \(resultado: Aprovado o texto\.\), Fulana Teste votou "Sim"/);
  for (const e of ev) assert.ok(e.fonte && e.url, `sem fonte: ${e.texto}`);
});

test('deputado sem nenhuma lei: diz "nenhum virou lei" (só quando há projetos)', async () => {
  _setLeisArquivo({ geradoEm: '2026-11-27', deputados: { 1: { projetos: 3, leis: [] } } });
  const ev = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.ok(ev.some((e) => /nenhum virou lei/.test(e.texto)));
  _setLeisArquivo({ geradoEm: '2026-11-27', deputados: {} });
  const ev2 = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.ok(!ev2.some((e) => /virou lei/.test(e.texto)));
});

test('sem o arquivo de leis, não afirma nada sobre leis', async () => {
  _setLeisArquivo(null);
  const ev = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.ok(!ev.some((e) => /virou lei|viraram lei/.test(e.texto)));
});

test('Câmara fora do ar: a atuação vem vazia, sem erro e sem número inventado', async () => {
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('rede caiu');
  });
  _setLeisArquivo(null);
  const ev = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.deepEqual(ev, []);
});

test('Câmara lenta: o FatoBot não espera mais que o limite', async () => {
  mock.restoreAll();
  mock.method(globalThis, 'fetch', (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abortado')))));
  const antes = { ...LIMITES_ATUACAO };
  LIMITES_ATUACAO.esperaMs = 200;
  LIMITES_ATUACAO.requisicaoMs = 300;
  const t = Date.now();
  await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.ok(Date.now() - t < 1500);
  Object.assign(LIMITES_ATUACAO, antes);
});

test('429 da Câmara: espera e tenta de novo', async () => {
  let vezes = 0;
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async (url) => {
    if (String(url).includes('/discursos') && vezes++ === 0) return new Response('', { status: 429, headers: { 'retry-after': '0' } });
    return camaraFalsa(url);
  });
  const ev = await atuacaoDeputado({ id: 1, nome: 'Fulana Teste' });
  assert.ok(ev.some((e) => /fez 7 discursos/.test(e.texto)));
  assert.equal(vezes, 2);
});

test('senador: matérias desde 2023, votos de fato (licença não conta como voto)', async () => {
  const ev = await atuacaoSenador({ id: 7, nome: 'Senadora Teste' });
  const textos = ev.map((e) => e.texto).join('\n');
  assert.match(textos, /2 matérias de autoria ou coautoria .* autor\(a\) principal de 1 \(entre elas: 1 projeto de lei\)/);
  assert.match(textos, /PL 3\/2026, apresentada em 05\/11\/2026/);
  assert.match(textos, /2 votações nominais .* em 1 delas votou/);
  assert.match(textos, /PLP 299\/2026 — Votação do texto\), Senadora Teste votou "Sim"/);
  assert.ok(!/Antigo/.test(textos), 'matéria de 2019 não entra');
});

test('registros verificados: só com o nome exato e com o link da fonte', () => {
  const ev = evidenciasRegistros('alexandre ramagem', 'camara');
  assert.equal(ev.length, 1);
  assert.match(ev[0].texto, /^Condenação \(11\/09\/2025\): Condenado pela Primeira Turma do STF/);
  assert.match(ev[0].url, /^https:\/\/noticias\.stf\.jus\.br\//);
  assert.equal(evidenciasRegistros('Alexandre', 'camara').length, 0);
  assert.equal(evidenciasRegistros('Alexandre Ramagem', 'senado').length, 0);
});

test('lerCsv: aspas, ";" e quebra de linha dentro do campo, BOM no começo', () => {
  const csv = '﻿"id";"ementa"\n"1";"Altera a lei; e dá ""outras"" providências"\n"2";"linha 1\nlinha 2"\n';
  assert.deepEqual(lerCsv(csv), [
    { id: '1', ementa: 'Altera a lei; e dá "outras" providências' },
    { id: '2', ementa: 'linha 1\nlinha 2' },
  ]);
});
