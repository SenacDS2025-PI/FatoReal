// J14 — Conferência do site publicado, para a véspera e o dia da apresentação.
//
// Uso (na pasta backend; não precisa de .env nem de chave):
//   npm run conferir                                   → confere https://fato-real.vercel.app
//   npm run conferir -- https://outro-endereco.app     → confere outro endereço (ex.: uma prévia)
//
// Gasta ~3 chamadas da cota do Gemini (FatoBot, Constituição e tradutor).
const BASE = (process.argv[2] || 'https://fato-real.vercel.app').replace(/\/$/, '');
const PROJETO_PRODUCAO = 'aswssu'; // começo do endereço do Supabase de produção (ver supabase/AMBIENTES.md)

let problemas = 0;
let avisos = 0;
const ok = (msg) => console.log(`  ✅ ${msg}`);
const aviso = (msg) => (avisos++, console.log(`  ⚠️  ${msg}`));
const erro = (msg) => (problemas++, console.log(`  ❌ ${msg}`));

async function pedir(caminho, corpo) {
  const inicio = Date.now();
  const res = await fetch(`${BASE}${caminho}`, {
    method: corpo ? 'POST' : 'GET',
    headers: corpo ? { 'Content-Type': 'application/json' } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(40_000),
  });
  const texto = await res.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    /* não é JSON */
  }
  return { status: res.status, json, ms: Date.now() - inicio };
}

async function etapa(titulo, fn) {
  console.log(`\n${titulo}`);
  try {
    await fn();
  } catch (err) {
    erro(`não respondeu (${err.message})`);
  }
}

console.log(`Conferindo ${BASE} ...`);

await etapa('1. API no ar', async () => {
  const r = await pedir('/api/health');
  r.status === 200 ? ok(`respondeu em ${r.ms} ms`) : erro(`HTTP ${r.status}`);
});

await etapa('2. Fontes (/api/health/fontes?ia=1)', async () => {
  const r = await pedir('/api/health/fontes?ia=1');
  if (r.status === 404) return erro('rota não existe: o PR com o J12 ainda não está nesta versão');
  const f = r.json?.fontes;
  if (!f) return erro(`resposta inesperada (HTTP ${r.status})`);

  f.camara.status === 'ok' ? ok(`Câmara no ar (${f.camara.ms} ms)`) : aviso('Câmara fora do ar agora (o FatoBot usa o Supabase ou a cópia)');

  const s = f.supabase;
  if (s.status === 'ok') {
    ok(`Supabase com ${s.deputados} deputados e ${s.senadores ?? 0} senadores (projeto ${s.projeto})`);
    if (!s.senadores) aviso('sem senadores no banco: a aba Senadores fica vazia no site. Rode npm run importar.');
    if (!String(s.projeto).startsWith(PROJETO_PRODUCAO)) {
      aviso(`o projeto não é o de produção (${PROJETO_PRODUCAO}…). Confira as variáveis da Vercel.`);
    }
  } else if (s.status === 'vazio') erro('Supabase sem deputados: rode npm run importar no banco de produção');
  else if (s.status === 'nao_configurado') erro('Supabase não configurado na Vercel (SUPABASE_URL / SUPABASE_ANON_KEY)');
  else erro(`Supabase fora: ${s.detalhe ?? s.status}`);

  const c = f.copiaReserva;
  if (c.status === 'ok') ok(`Cópia de reserva com ${c.deputados} deputados (${c.diasDesdeColeta} dia(s))`);
  else aviso(`Cópia de reserva ${c.status}: rode npm run atualizar-deputados e faça commit`);

  const g = f.gemini;
  if (g.status === 'ok') ok(`Gemini respondendo (${g.teste?.modelo}, ${g.teste?.ms} ms); reserva: ${g.reserva ?? 'nenhum'}`);
  else if (g.status === 'sem_chave') erro('Gemini sem chave na Vercel (GEMINI_API_KEY)');
  else erro(`Gemini falhou: ${g.teste?.motivo ?? g.status}`);
  if (!g.reserva) aviso('sem GEMINI_MODEL_RESERVA na Vercel (recomendado: gemini-2.5-flash-lite)');

  const dia = g.cotaLocal?.porDia;
  if (dia) ok(`Cota local de hoje: ${dia.usados} de ${dia.max} chamadas`);
});

async function conferirFatoBot(pergunta, esperado) {
  const r = await pedir('/api/fatobot', { pergunta });
  if (r.status !== 200) return erro(`"${pergunta}" → HTTP ${r.status} ${r.json?.erro ?? ''}`);
  const b = r.json;
  const fonte = b.fontes?.[0]?.titulo ?? 'sem fonte';
  if (b.modo === 'ia_com_fontes' && esperado.test(b.resposta)) {
    ok(`"${pergunta}" (${r.ms} ms) → ${b.resposta.slice(0, 90)}… | fonte: ${fonte.slice(0, 60)}`);
  } else if (b.modo === 'ia_com_fontes') aviso(`"${pergunta}" respondeu, mas diferente do esperado: ${b.resposta.slice(0, 120)}`);
  else aviso(`"${pergunta}" respondeu SEM IA (${b.modo}, motivo: ${b.motivo_sem_ia ?? '-'})`);
}

await etapa('3. FatoBot', async () => {
  await conferirFatoBot('Qual o partido de Tabata Amaral?', /PSB/);
  await conferirFatoBot('O que são os Três Poderes?', /Legislativo|Executivo|Judiciário/);
  const r = await pedir('/api/fatobot', { pergunta: 'oi tudo bem' });
  r.status === 200 && r.json?.sem_evidencia ? ok('"oi tudo bem" → sem evidência, sem erro') : erro(`"oi tudo bem" → HTTP ${r.status}`);
});

await etapa('4. Tradutor de juridiquês (/api/traduzir)', async () => {
  const r = await pedir('/api/traduzir', {
    texto: 'Altera a Lei nº 8.069, de 13 de julho de 1990, para dispor sobre o uso de celulares nas escolas, e dá outras providências.',
  });
  if (r.status === 404) return aviso('rota não existe nesta versão (o front usa as regras locais)');
  r.status === 200 ? ok(`${r.json.explicacao.slice(0, 110)}…`) : aviso(`HTTP ${r.status}: o front usa as regras locais`);
});

await etapa('5. CEP (/api/cep)', async () => {
  const r = await pedir('/api/cep/70040010?politicos=0');
  r.status === 200 ? ok(`${r.json.endereco.logradouro}, ${r.json.endereco.cidade}-${r.json.endereco.uf}`) : aviso(`HTTP ${r.status}`);
});

console.log(
  `\nResultado: ${problemas === 0 ? '✅ pronto' : `❌ ${problemas} problema(s)`}` + (avisos ? `, ⚠️  ${avisos} aviso(s)` : '')
);
process.exit(problemas ? 1 : 0);
