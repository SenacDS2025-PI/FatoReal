// Eleitos do TSE (todos os cargos): leitura do CSV oficial "consulta_cand".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerLinhaCsv, nomeProprio, politicoDoTse, eleitosDoCsv, CARGOS_TSE } from '../src/services/tse.js';

const COLUNAS = [
  'DT_GERACAO', 'ANO_ELEICAO', 'NR_TURNO', 'CD_ELEICAO', 'SG_UF', 'SG_UE', 'NM_UE', 'CD_CARGO', 'DS_CARGO',
  'SQ_CANDIDATO', 'NM_CANDIDATO', 'NM_URNA_CANDIDATO', 'NR_CPF_CANDIDATO', 'DS_EMAIL', 'SG_PARTIDO',
  'DT_NASCIMENTO', 'DS_GRAU_INSTRUCAO', 'DS_SIT_TOT_TURNO',
];
const linha = (v) => COLUNAS.map((c) => `"${v[c] ?? '#NULO#'}"`).join(';');
const BASE = { ANO_ELEICAO: '2024', CD_ELEICAO: '619', SG_UF: 'SP', SG_UE: '62910', NM_UE: 'SÃO JOSÉ DOS CAMPOS' };

const PREFEITO_T1 = { ...BASE, NR_TURNO: '1', CD_CARGO: '11', SQ_CANDIDATO: '250000000001', NM_CANDIDATO: 'FULANO DE TAL DA SILVA', NM_URNA_CANDIDATO: 'FULANO (EXEMPLO)', NR_CPF_CANDIDATO: '12345678900', DS_EMAIL: 'fulano@exemplo.com', SG_PARTIDO: 'ABC', DT_NASCIMENTO: '01/01/1970', DS_GRAU_INSTRUCAO: 'SUPERIOR COMPLETO', DS_SIT_TOT_TURNO: '2º TURNO' };
const PREFEITO_T2 = { ...PREFEITO_T1, NR_TURNO: '2', DS_SIT_TOT_TURNO: 'ELEITO' };
const VEREADOR = { ...BASE, NR_TURNO: '1', CD_CARGO: '13', SQ_CANDIDATO: '250000000002', NM_CANDIDATO: 'MARIA DOS SANTOS', NM_URNA_CANDIDATO: 'MARIA DO BAIRRO (EXEMPLO)', SG_PARTIDO: 'XYZ', DS_SIT_TOT_TURNO: 'ELEITO POR QP' };
const SUPLENTE = { ...VEREADOR, SQ_CANDIDATO: '250000000003', DS_SIT_TOT_TURNO: 'SUPLENTE' };
const GOVERNADOR = { ANO_ELEICAO: '2022', CD_ELEICAO: '546', SG_UF: 'MG', SG_UE: 'MG', NM_UE: 'MINAS GERAIS', NR_TURNO: '1', CD_CARGO: '3', SQ_CANDIDATO: '130000000004', NM_URNA_CANDIDATO: 'GOVERNADOR TESTE (EXEMPLO)', SG_PARTIDO: 'DEF', DS_SIT_TOT_TURNO: 'ELEITO' };
const DEP_FEDERAL = { ...GOVERNADOR, CD_CARGO: '6', SQ_CANDIDATO: '130000000005' };

async function* comoArquivo(registros) {
  yield COLUNAS.map((c) => `"${c}"`).join(';');
  for (const r of registros) yield linha(r);
}

test('TSE: lê linha com aspas, ";" dentro de aspas e aspas duplicadas', () => {
  assert.deepEqual(lerLinhaCsv('"a";"b;c";"d ""e"""'), ['a', 'b;c', 'd "e"']);
});

test('TSE: nome em maiúsculas vira nome próprio', () => {
  assert.equal(nomeProprio('JOÃO DA SILVA DOS SANTOS'), 'João da Silva dos Santos');
  assert.equal(nomeProprio('MARIA-JOSÉ D\'ÁVILA'), "Maria-José d'Ávila");
});

test('TSE: só eleitos dos cargos importados; quem foi ao 2º turno aparece uma vez', async () => {
  const eleitos = await eleitosDoCsv(comoArquivo([PREFEITO_T1, PREFEITO_T2, VEREADOR, SUPLENTE, GOVERNADOR, DEP_FEDERAL]), '2026-11-24T00:00:00.000Z');
  assert.deepEqual(eleitos.map((e) => e.cargo).sort(), ['Governador(a)', 'Prefeito(a)', 'Vereador(a)']);
});

test('TSE: linha do prefeito com município, fonte e sem dados pessoais (LGPD)', async () => {
  const [p] = await eleitosDoCsv(comoArquivo([PREFEITO_T2]), '2026-11-24T00:00:00.000Z');
  assert.equal(p.id, 250000000001);
  assert.equal(p.nome, 'Fulano (exemplo)');
  assert.equal(p.municipio, 'São José dos Campos');
  assert.equal(p.municipio_busca, 'sao jose dos campos');
  assert.equal(p.uf, 'SP');
  assert.equal(p.escolaridade, 'Superior completo');
  assert.equal(p.situacao, 'Eleito(a) em 2024 (eleito)');
  assert.equal(p.fonte_url, 'https://dadosabertos.tse.jus.br/dataset/candidatos-2024');
  const texto = JSON.stringify(p);
  for (const pessoal of ['12345678900', 'fulano@exemplo.com', '1970']) assert.ok(!texto.includes(pessoal), pessoal);
  assert.equal(p.email, null);
});

test('TSE: governador não tem município', () => {
  const p = politicoDoTse(GOVERNADOR);
  assert.equal(p.municipio, null);
  assert.equal(p.uf, 'MG');
});

test('TSE: deputado federal e senador ficam de fora (vêm da Câmara e do Senado)', () => {
  assert.equal(CARGOS_TSE[5], undefined);
  assert.equal(CARGOS_TSE[6], undefined);
});

test('TSE: arquivo errado → erro claro', async () => {
  async function* errado() { yield '"A";"B"'; }
  await assert.rejects(eleitosDoCsv(errado()), /consulta_cand/);
});
