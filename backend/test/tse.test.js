// Eleitos do TSE (todos os cargos): leitura do CSV oficial "consulta_cand".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lerLinhaCsv, nomeProprio, politicoDoTse, eleitosDoCsv, CARGOS_TSE, dataIso, valorBr, mascararCpf, bensDoCsv, votosDoCsv, situacaoDe,
} from '../src/services/tse.js';

const COLUNAS = [
  'DT_GERACAO', 'ANO_ELEICAO', 'NR_TURNO', 'CD_ELEICAO', 'SG_UF', 'SG_UE', 'NM_UE', 'CD_CARGO', 'DS_CARGO',
  'SQ_CANDIDATO', 'NM_CANDIDATO', 'NM_URNA_CANDIDATO', 'NR_CPF_CANDIDATO', 'DS_EMAIL', 'SG_PARTIDO',
  'DT_NASCIMENTO', 'DS_GRAU_INSTRUCAO', 'DS_SIT_TOT_TURNO',
  'NR_CANDIDATO', 'NM_MUNICIPIO_NASCIMENTO', 'SG_UF_NASCIMENTO', 'DS_OCUPACAO', 'ST_REELEICAO',
  'DS_COMPOSICAO_COLIGACAO', 'DS_GENERO', 'DS_COR_RACA',
];
const linha = (v) => COLUNAS.map((c) => `"${v[c] ?? '#NULO#'}"`).join(';');
const BASE = { ANO_ELEICAO: '2024', CD_ELEICAO: '619', SG_UF: 'SP', SG_UE: '62910', NM_UE: 'SÃO JOSÉ DOS CAMPOS' };

const PREFEITO_T1 = { ...BASE, NR_TURNO: '1', CD_CARGO: '11', SQ_CANDIDATO: '250000000001', NM_CANDIDATO: 'FULANO DE TAL DA SILVA', NM_URNA_CANDIDATO: 'FULANO (EXEMPLO)', NR_CPF_CANDIDATO: '12345678900', DS_EMAIL: 'fulano@exemplo.com', SG_PARTIDO: 'ABC', DT_NASCIMENTO: '15/03/1970', DS_GRAU_INSTRUCAO: 'SUPERIOR COMPLETO', DS_SIT_TOT_TURNO: '2º TURNO', NR_CANDIDATO: '45', NM_MUNICIPIO_NASCIMENTO: 'GARANHUNS', SG_UF_NASCIMENTO: 'PE', DS_OCUPACAO: 'ADVOGADO', ST_REELEICAO: 'S', DS_COMPOSICAO_COLIGACAO: 'ABC / DEF', DS_GENERO: 'FEMININO', DS_COR_RACA: 'PARDA' };
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
  assert.equal(p.situacao, 'Eleita em 2024');
  assert.equal(p.fonte_url, 'https://dadosabertos.tse.jus.br/dataset/candidatos-2024');
  // Campos novos (contrato com o front)
  assert.equal(p.numero_urna, 45);
  assert.equal(p.data_nascimento, '1970-03-15');
  assert.equal(p.municipio_nascimento, 'Garanhuns/PE');
  assert.equal(p.ocupacao, 'Advogado');
  assert.equal(p.reeleicao, true);
  assert.equal(p.coligacao, 'ABC / DEF');
  assert.equal(p.genero, 'F');
  assert.match(p.foto_url, /\/img\/2045202024\/250000000001\/62910$/, 'código da eleição do DivulgaCand');
  // LGPD: nada de CPF, e-mail nem cor/raça
  const texto = JSON.stringify(p);
  for (const pessoal of ['12345678900', 'fulano@exemplo.com', 'PARDA', 'Parda']) assert.ok(!texto.includes(pessoal), pessoal);
  assert.equal(p.email, null);
  assert.ok(!('cor_raca' in p));
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

test('TSE: datas dd/mm/aaaa', () => {
  assert.equal(dataIso('15/03/1965'), '1965-03-15');
  assert.equal(dataIso('31/02/1990'), null, 'data que não existe');
  assert.equal(dataIso('#NULO#'), null);
  assert.equal(dataIso(''), null);
});

test('TSE: valores com vírgula decimal', () => {
  assert.equal(valorBr('150000,00'), 150000);
  assert.equal(valorBr('1.234.567,89'), 1234567.89);
  assert.equal(valorBr('0,5'), 0.5);
  assert.equal(valorBr('#NULO#'), null);
  assert.equal(valorBr('abc'), null);
});

test('TSE: CPF de terceiros mascarado (com e sem pontos)', () => {
  assert.equal(mascararCpf('Quotas da empresa, sócio CPF 123.456.789-00'), 'Quotas da empresa, sócio CPF [CPF oculto]');
  assert.equal(mascararCpf('crédito com 12345678900 a receber'), 'crédito com [CPF oculto] a receber');
  assert.equal(mascararCpf('Apartamento 1203, matrícula 98765'), 'Apartamento 1203, matrícula 98765', 'número curto fica');
});

test('TSE: situação com gênero (sem "(a)") e detalhe de quociente', () => {
  assert.equal(situacaoDe('ELEITO', '2022', 'M'), 'Eleito em 2022');
  assert.equal(situacaoDe('ELEITO POR QP', '2024', 'F'), 'Eleita em 2024 (por quociente partidário)');
  assert.equal(situacaoDe('ELEITO POR MÉDIA', '2024', null), 'Venceu a eleição de 2024 (por média)');
});

const BENS_COLS = ['ANO_ELEICAO', 'SQ_CANDIDATO', 'NR_ORDEM_BEM_CANDIDATO', 'DS_TIPO_BEM_CANDIDATO', 'DS_BEM_CANDIDATO', 'VR_BEM_CANDIDATO'];
async function* arquivo(cols, linhas) {
  yield cols.map((c) => `"${c}"`).join(';');
  for (const l of linhas) yield l.map((v) => `"${v}"`).join(';');
}

test('TSE: bens só dos eleitos, com total e CPF mascarado', async () => {
  const ids = new Set([250000000001]);
  const { bens, totais } = await bensDoCsv(
    arquivo(BENS_COLS, [
      ['2024', '250000000001', '1', 'APARTAMENTO', 'APTO EM BRASÍLIA', '350000,50'],
      ['2024', '250000000001', '2', 'QUOTAS OU QUINHÕES DE CAPITAL', 'EMPRESA X, SÓCIO 123.456.789-00', '10.000,00'],
      ['2024', '999', '1', 'CASA', 'DE QUEM NÃO FOI ELEITO', '1,00'],
    ]),
    ids
  );
  assert.equal(bens.length, 2, 'ignora quem não foi eleito');
  assert.equal(totais.get(250000000001), 360000.5);
  assert.deepEqual(bens[0], { politico_id: 250000000001, ordem: 1, tipo: 'Apartamento', descricao: 'APTO EM BRASÍLIA', valor: 350000.5, ano: 2024 });
  assert.equal(bens[1].descricao, 'EMPRESA X, SÓCIO [CPF oculto]');
});

test('TSE: votos somados por zona, ficando com o último turno', async () => {
  const cols = ['SQ_CANDIDATO', 'NR_TURNO', 'NR_ZONA', 'QT_VOTOS_NOMINAIS'];
  const ids = new Set([1, 2]);
  const votos = await votosDoCsv(
    arquivo(cols, [
      ['1', '1', '10', '100'], ['1', '1', '11', '50'], ['1', '2', '10', '300'], ['1', '2', '11', '200'],
      ['2', '1', '10', '42'], ['3', '1', '10', '999'],
    ]),
    ids
  );
  assert.deepEqual(votos.get(1), { votos: 500, turno: 2 });
  assert.deepEqual(votos.get(2), { votos: 42, turno: 1 });
  assert.equal(votos.has(3), false, 'só eleitos');
});
