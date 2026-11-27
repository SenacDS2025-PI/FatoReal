// Log do Fato ou Fake: mostra as etapas sem vazar dados pessoais (LGPD).
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { previa, dominio, criarLogVerificar } from '../src/utils/log-verificar.js';
import { iniciar, mockCamara } from './ajuda.js';

test('prévia esconde números longos (CPF, telefone) e corta textos grandes', () => {
  assert.equal(previa('Fulano tem CPF 12345678900'), 'Fulano tem CPF •••••••••••');
  assert.equal(previa('a'.repeat(100)).length, 61);
  assert.equal(previa('Em 2026 houve eleição?'), 'Em 2026 houve eleição?', 'ano sozinho não é dado pessoal');
  assert.ok(!previa('CPF 123.456.789-00').includes('789'), 'CPF com pontos');
  assert.ok(!previa('ligue 61 99999-8888').includes('8888'), 'telefone com traço');
});

test('do link só guarda o site', () => {
  assert.equal(dominio('https://exemplo.com.br/noticia?id=1&email=x@y.com'), 'exemplo.com.br');
  assert.equal(dominio('nao é link'), 'inválido');
});

test('LOG_VERIFICAR=0 desliga o log', () => {
  const info = mock.method(console, 'info', () => {});
  process.env.LOG_VERIFICAR = '0';
  try {
    criarLogVerificar().info('teste');
    assert.equal(info.mock.callCount(), 0);
  } finally {
    delete process.env.LOG_VERIFICAR;
    info.mock.restore();
  }
});

test('POST /api/verificar escreve as etapas no console, sem o texto inteiro', async () => {
  const linhas = [];
  const guardar = (...a) => linhas.push(a.join(' '));
  const info = mock.method(console, 'info', guardar);
  const warn = mock.method(console, 'warn', guardar);
  const srv = await iniciar();
  const camara = mockCamara('ok');
  try {
    const afirmacao = 'Tabata Amaral é deputada pelo PSB e o CPF dela é 12345678900';
    const res = await fetch(`${srv.base}/api/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ afirmacao, link: 'https://exemplo.com/materia/123' }),
    });
    assert.equal(res.status, 200);
    const log = linhas.filter((l) => l.startsWith('[verificar ')).join('\n');
    for (const etapa of ['1. pedido recebido', '2. dados conferidos', '3. evidências encontradas', '4. resposta da IA', '6. resposta enviada']) {
      assert.ok(log.includes(etapa), `faltou a etapa "${etapa}"\n${log}`);
    }
    assert.ok(log.includes('exemplo.com'));
    assert.ok(!log.includes('12345678900'), 'não pode vazar o CPF');
    assert.ok(!log.includes('/materia/123'), 'do link, só o site');
  } finally {
    camara.restaurar();
    info.mock.restore();
    warn.mock.restore();
    await srv.encerrar();
  }
});

test('só link ou só anexo, sem afirmação → 400 com mensagem que explica o que fazer', async () => {
  const srv = await iniciar();
  const info = mock.method(console, 'info', () => {});
  const warn = mock.method(console, 'warn', () => {});
  try {
    const enviar = (corpo) =>
      fetch(`${srv.base}/api/verificar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const soLink = await enviar({ afirmacao: '', link: 'https://www.gov.br/noticia' });
    assert.equal(soLink.status, 400);
    assert.match((await soLink.json()).erro, /Escreva a afirmação/);
    const soAnexo = await enviar({ afirmacao: '', anexos: [{ nome: 'print.png', tipo: 'image/png', tamanho: 1000 }] });
    assert.match((await soAnexo.json()).erro, /anexos sozinhos não são analisados/);
    const longa = await enviar({ afirmacao: 'a'.repeat(1001) });
    assert.match((await longa.json()).erro, /no máximo 1000/);
  } finally {
    info.mock.restore();
    warn.mock.restore();
    await srv.encerrar();
  }
});
