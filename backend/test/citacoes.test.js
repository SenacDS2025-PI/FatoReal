// Citações da IA: "[11, 12]" vira "[11][12]" e abreviações não quebram a frase (gemini.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citacoesValidas, dividirFrases, separarCitacoes } from '../src/services/gemini.js';

test('separarCitacoes: [11, 12] e [16,17;18] viram citações separadas', () => {
  assert.equal(separarCitacoes('Virou lei [11, 12]. Votou [16,17;18].'), 'Virou lei [11][12]. Votou [16][17][18].');
  assert.equal(separarCitacoes('Só uma [3].'), 'Só uma [3].');
});

test('resposta real da IA com citações agrupadas passa na validação (antes era descartada)', () => {
  const ia =
    'O projeto que virou lei foi o PL 1564/2024, sobre medidas emergenciais no Rio Grande do Sul [11, 12]. ' +
    'Nas votações recentes, ele votou "Não" no PL 4887/2023 e "Sim" em uma emenda do PLP 299/2026 [16, 17, 18].';
  assert.equal(citacoesValidas(ia, 18), false, 'sem separar, o formato agrupado não é aceito');
  assert.equal(citacoesValidas(separarCitacoes(ia), 18), true);
  assert.equal(citacoesValidas(separarCitacoes(ia), 17), false, 'citação [18] inexistente continua inválida');
});

test('abreviações (art., Dep., nº.) não terminam a frase', () => {
  assert.deepEqual(dividirFrases('Altera o art. 154-A do Código Penal [2]. Foi relatado pelo Dep. Fulano [3].'), [
    'Altera o art. 154-A do Código Penal [2].',
    'Foi relatado pelo Dep. Fulano [3].',
  ]);
  assert.equal(citacoesValidas('Altera o art. 154-A do Código Penal [2].', 2), true);
});

test('frase sem citação continua derrubando a resposta inteira', () => {
  assert.equal(citacoesValidas('Ele apresentou 54 projetos [1]. Ele é muito trabalhador.', 3), false);
});
