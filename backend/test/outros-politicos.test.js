// FatoBot com todos os políticos: senadores, presidente, governadores, prefeitos e vereadores.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, mockCamara, perguntar } from './ajuda.js';
import { _setClient as setSupabase } from '../src/services/supabase.js';
import { clienteFalso } from './supabase-falso.js';
import { cidadeDoTexto, ufDoTexto } from '../src/services/outros-politicos.js';

const TSE24 = 'https://dadosabertos.tse.jus.br/dataset/candidatos-2024';
const TSE22 = 'https://dadosabertos.tse.jus.br/dataset/candidatos-2022';
const coleta = '2026-11-24T00:00:00.000Z';
const LINHAS = [
  { id: 5012, nome: 'Senadora Teste (exemplo)', partido: 'ABC', uf: 'MG', cargo: 'Senador(a)', fonte_url: 'https://www25.senado.leg.br/web/senadores/senador/-/perfil/5012', data_coleta: coleta },
  { id: 130000000004, nome: 'Governador Teste (exemplo)', partido: 'DEF', uf: 'MG', cargo: 'Governador(a)', situacao: 'Eleito(a) em 2022 (eleito)', fonte_url: TSE22, data_coleta: coleta },
  { id: 250000000001, nome: 'Prefeito Teste (exemplo)', partido: 'GHI', uf: 'SP', cargo: 'Prefeito(a)', municipio: 'Campinas', municipio_busca: 'campinas', situacao: 'Eleito(a) em 2024 (eleito)', fonte_url: TSE24, data_coleta: coleta },
  ...Array.from({ length: 12 }, (_, i) => ({ id: 250000000100 + i, nome: `Vereador ${i} (exemplo)`, partido: 'JKL', uf: 'PE', cargo: 'Vereador(a)', municipio: 'Recife', municipio_busca: 'recife', situacao: 'Eleito(a) em 2024 (eleito por qp)', fonte_url: TSE24, data_coleta: coleta })),
];

let srv;
let camara;
beforeEach(async () => {
  srv = await iniciar();
  camara = mockCamara('ok');
  setSupabase(clienteFalso(LINHAS));
});
afterEach(async () => {
  camara.restaurar();
  setSupabase(undefined);
  await srv.encerrar();
});

test('entende a cidade e o estado da pergunta', () => {
  assert.deepEqual(cidadeDoTexto('Quem é o prefeito de São José dos Campos - SP?'), { cidade: 'sao jose dos campos', uf: 'SP' });
  assert.deepEqual(cidadeDoTexto('quem sao os vereadores de recife'), { cidade: 'recife', uf: null });
  assert.equal(cidadeDoTexto('o que faz um prefeito?'), null);
  assert.equal(ufDoTexto('senadores de Minas Gerais'), 'MG');
  assert.equal(ufDoTexto('governador do Mato Grosso do Sul'), 'MS');
  assert.equal(ufDoTexto('governador de SP'), 'SP');
});

test('prefeito pela cidade, com fonte do TSE e "foi eleito" (não "é")', async () => {
  const r = await perguntar(srv.base, 'Quem é o prefeito de Campinas?');
  assert.equal(r.status, 200);
  assert.equal(r.body.tipo, 'fontes_encontradas');
  assert.match(r.body.evidencias[0].texto, /Prefeito Teste \(exemplo\) \(GHI\) foi eleito\(a\) para Prefeito\(a\) de Campinas-SP na eleição de 2024/);
  assert.equal(r.body.fontes[0].url, TSE24);
});

test('muitos vereadores → resumo com total e alguns nomes', async () => {
  const r = await perguntar(srv.base, 'Quem são os vereadores de Recife?');
  assert.equal(r.body.evidencias.length, 1);
  assert.match(r.body.evidencias[0].texto, /12 vereadores eleitos em Recife-PE/);
});

test('senadores e governador pelo estado', async () => {
  const s = await perguntar(srv.base, 'Quem são os senadores de Minas Gerais?');
  assert.match(s.body.evidencias[0].texto, /Senadora Teste \(exemplo\) é senador\(a\) pelo ABC-MG/);
  const g = await perguntar(srv.base, 'Quem é o governador de MG?');
  assert.match(g.body.evidencias[0].texto, /Governador Teste \(exemplo\).*Governador\(a\) de Minas Gerais na eleição de 2022/);
});

test('acha senador pelo nome completo', async () => {
  const r = await perguntar(srv.base, 'Quem é Senadora Teste (exemplo)?');
  assert.ok(r.body.evidencias.some((e) => /senador\(a\) pelo ABC-MG/.test(e.texto)));
});

test('cidade que não está no banco → sem evidência (não inventa)', async () => {
  const r = await perguntar(srv.base, 'Quem é o prefeito de Cidade Inexistente?');
  // Pode vir a regra da Constituição sobre prefeitos, mas nenhum nome do TSE.
  assert.ok(!(r.body.evidencias ?? []).some((e) => /TSE/.test(e.fonte)));
  assert.ok(!JSON.stringify(r.body).includes('Prefeito Teste'));
});

test('sem evidência → indica onde conferir (só links oficiais, fora das fontes)', async () => {
  const r = await perguntar(srv.base, 'Quanto o governo gastou com contratos de licitação?');
  assert.equal(r.body.tipo, 'sem_evidencia');
  assert.deepEqual(r.body.fontes, []);
  assert.ok(r.body.onde_conferir.some((f) => f.url === 'https://portaldatransparencia.gov.br'));
  assert.match(r.body.resposta, /Você pode conferir em: .*Portal da Transparência/);
});

test('Câmara fora e Supabase com prefeitos → ainda responde', async () => {
  camara.restaurar();
  camara = mockCamara('fora');
  const r = await perguntar(srv.base, 'Quem é o prefeito de Campinas?');
  assert.equal(r.status, 200);
  assert.equal(r.body.tipo, 'fontes_encontradas');
});

test('só o sobrenome → não responde como fato, sugere "Você quis dizer"', async () => {
  const r = await perguntar(srv.base, 'quem foi o teste?'); // "Senadora Teste", "Governador Teste"...
  assert.equal(r.body.tipo, 'sem_evidencia');
  assert.deepEqual(r.body.evidencias, []);
  const nomes = r.body.voce_quis_dizer.map((s) => s.nome);
  assert.ok(nomes.includes('Senadora Teste (exemplo)'), JSON.stringify(nomes));
  assert.match(r.body.resposta, /Você quis dizer: .*Senadora Teste \(exemplo\) \(Senador\(a\), ABC-MG\)/);
});
