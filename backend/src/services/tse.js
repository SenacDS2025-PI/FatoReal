// Eleitos de todos os cargos (Presidente, Governadores, Deputados Estaduais, Prefeitos e
// Vereadores), a partir dos arquivos oficiais do TSE "Candidatos" (Portal de Dados Abertos do TSE).
//
// - Eleição de 2022: Presidente, Governador(a) e Deputado(a) Estadual/Distrital (e vices).
// - Eleição de 2024: Prefeito(a) e Vereador(a) (e vices).
// - Deputados federais e senadores NÃO vêm daqui: vêm da Câmara e do Senado, que mostram
//   quem está em exercício hoje (o TSE mostra quem foi eleito).
//
// O arquivo é um CSV separado por ";" com aspas, em latin1. Lemos pelo NOME da coluna,
// então uma coluna nova em outro ano não quebra nada.
//
// Também lemos (mesma pasta "odsele" do CDN do TSE):
// - bem_candidato_{ano}: bens declarados → tabela politico_bens e coluna bens_total;
// - votacao_candidato_munzona_{ano}: votos nominais → colunas votos e turno.
//
// LGPD: NÃO guardamos CPF, título de eleitor, e-mail, cor/raça (dado sensível) nem estado civil.
// Guardamos só o que o TSE publica sobre a candidatura de quem foi eleito: data e local de
// nascimento, ocupação, número de urna, coligação e gênero (só para escrever "eleito"/"eleita").
// CPF de outras pessoas que aparece na descrição dos bens é mascarado antes de salvar.
import { normalizar } from '../utils/texto.js';

export const FONTE_TSE_NOME = 'Tribunal Superior Eleitoral (TSE) — Dados Abertos';
export const fonteTseUrl = (ano) => `https://dadosabertos.tse.jus.br/dataset/candidatos-${ano}`;

// Código do cargo no TSE → nome do cargo no Fato Real (o mesmo do filtro do front).
export const CARGOS_TSE = {
  1: 'Presidente',
  2: 'Vice-presidente',
  3: 'Governador(a)',
  4: 'Vice-governador(a)',
  7: 'Deputado(a) Estadual',
  8: 'Deputado(a) Estadual', // distrital (DF): mesmo papel do estadual
  11: 'Prefeito(a)',
  12: 'Vice-prefeito(a)',
  13: 'Vereador(a)',
};
const CARGOS_MUNICIPAIS = new Set([11, 12, 13]);

// Foto oficial da candidatura no DivulgaCandContas. O endereço usa o código da eleição do
// DivulgaCand (não o CD_ELEICAO do CSV, que dava o boneco padrão "sem foto"). O script de
// importação confere se a foto é de verdade antes de salvar.
export const ELEICAO_DIVULGACAND = { 2022: '2040602022', 2024: '2045202024' };
export const fotoTse = (cdEleicao, sq, sgUe) =>
  `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${cdEleicao}/${sq}/${sgUe}`;

// Uma linha do CSV do TSE → lista de valores (aceita aspas e ";" dentro de aspas).
export function lerLinhaCsv(linha) {
  const valores = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') {
      valores.push(atual);
      atual = '';
    } else atual += c;
  }
  valores.push(atual.replace(/\r$/, ''));
  return valores;
}

// O TSE usa #NULO#, #NE# e -1 para "sem informação".
const vazio = (v) => v == null || v === '' || v === '#NULO#' || v === '#NE#' || v === '#NULO' || v === '-1' || v === '-3';
const valor = (v) => (vazio(v) ? null : v.trim());

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd']);
// "JOÃO DA SILVA" → "João da Silva" (o TSE escreve tudo em maiúsculas).
export function nomeProprio(texto) {
  if (!texto) return null;
  return texto
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('');
}

// "SUPERIOR COMPLETO" → "Superior completo".
const frase = (t) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : null);

export const eleito = (situacao) => normalizar(situacao ?? '').startsWith('eleito');

// Primeiro valor preenchido entre colunas com nomes que mudam de um ano para outro.
const col = (r, ...nomes) => {
  for (const n of nomes) if (!vazio(r[n])) return r[n].trim();
  return null;
};

// "15/03/1965" → "1965-03-15" (data inválida → null).
export function dataIso(texto) {
  const m = String(texto ?? '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const dt = new Date(`${a}-${mes}-${d}T00:00:00Z`);
  return Number.isNaN(dt.getTime()) || dt.getUTCDate() !== Number(d) ? null : `${a}-${mes}-${d}`;
}

// "1.234.567,89" / "150000,00" / "150000.5" → número. Vazio ou inválido → null.
export function valorBr(texto) {
  let t = String(texto ?? '').trim();
  if (vazio(t)) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// LGPD: CPF (de qualquer pessoa) no meio de um texto → "[CPF oculto]".
export const mascararCpf = (texto) =>
  texto == null ? texto : String(texto).replace(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g, '[CPF oculto]');

// "MASCULINO" / "FEMININO" (ou o código 2 / 4) → 'M' / 'F'.
export function generoDe(r) {
  const ds = normalizar(col(r, 'DS_GENERO') ?? '');
  if (ds.startsWith('fem')) return 'F';
  if (ds.startsWith('mas')) return 'M';
  const cd = col(r, 'CD_GENERO');
  return cd === '4' ? 'F' : cd === '2' ? 'M' : null;
}

// "Eleita em 2024 (por quociente partidário)" — usa o gênero; sem ele, frase neutra.
export function situacaoDe(dsSituacao, ano, genero) {
  const s = normalizar(dsSituacao ?? '');
  const detalhe = s.includes('qp') ? ' (por quociente partidário)' : s.includes('media') ? ' (por média)' : '';
  if (genero === 'F') return `Eleita em ${ano}${detalhe}`;
  if (genero === 'M') return `Eleito em ${ano}${detalhe}`;
  return `Venceu a eleição de ${ano}${detalhe}`;
}

// "Partido isolado" / vazio → null; senão a composição como o TSE escreve ("PT / PC do B / PV").
function coligacaoDe(r) {
  for (const v of [col(r, 'DS_COMPOSICAO_COLIGACAO'), col(r, 'DS_COMPOSICAO_FEDERACAO'), col(r, 'NM_COLIGACAO')]) {
    if (v && !/isolad/i.test(v)) return v;
  }
  return null;
}

function municipioNascimentoDe(r) {
  const cidade = nomeProprio(col(r, 'NM_MUNICIPIO_NASCIMENTO'));
  const uf = col(r, 'SG_UF_NASCIMENTO');
  if (!cidade) return null;
  return uf && /^[A-Z]{2}$/.test(uf) ? `${cidade}/${uf}` : cidade;
}

function reeleicaoDe(r) {
  const v = col(r, 'ST_REELEICAO');
  return v === 'S' ? true : v === 'N' ? false : null;
}

// Registro do CSV (objeto coluna → valor) → linha da tabela `politicos`, ou null se não for
// um eleito de um cargo que importamos.
export function politicoDoTse(r, agora = new Date().toISOString()) {
  const cdCargo = Number(r.CD_CARGO);
  const cargo = CARGOS_TSE[cdCargo];
  if (!cargo || !eleito(r.DS_SIT_TOT_TURNO) || vazio(r.SQ_CANDIDATO)) return null;

  const ano = valor(r.ANO_ELEICAO);
  const municipal = CARGOS_MUNICIPAIS.has(cdCargo);
  const municipio = municipal ? nomeProprio(valor(r.NM_UE)) : null;
  const nome = nomeProprio(valor(r.NM_URNA_CANDIDATO) ?? valor(r.NM_CANDIDATO));
  if (!nome) return null;

  const genero = generoDe(r);
  const numero = Number(col(r, 'NR_CANDIDATO'));
  const cdDivulga = ELEICAO_DIVULGACAND[ano] ?? valor(r.CD_ELEICAO);

  return {
    id: Number(r.SQ_CANDIDATO),
    nome,
    nome_civil: nomeProprio(valor(r.NM_CANDIDATO)),
    partido: valor(r.SG_PARTIDO),
    uf: valor(r.SG_UF), // "BR" para Presidente
    cargo,
    municipio,
    municipio_busca: municipio ? normalizar(municipio) : null,
    foto_url: cdDivulga && valor(r.SG_UE) ? fotoTse(cdDivulga, r.SQ_CANDIDATO.trim(), r.SG_UE.trim()) : null,
    email: null,
    situacao: situacaoDe(r.DS_SIT_TOT_TURNO, ano, genero),
    escolaridade: frase(valor(r.DS_GRAU_INSTRUCAO)),
    // Campos novos (contrato com o front: supabase/politicos-tse-detalhes.sql)
    numero_urna: Number.isInteger(numero) && numero > 0 ? numero : null,
    data_nascimento: dataIso(col(r, 'DT_NASCIMENTO')),
    municipio_nascimento: municipioNascimentoDe(r),
    ocupacao: frase(col(r, 'DS_OCUPACAO')),
    reeleicao: reeleicaoDe(r),
    coligacao: coligacaoDe(r),
    genero,
    fonte_url: fonteTseUrl(ano),
    data_coleta: agora,
    atualizado_em: agora,
  };
}

// Lê um CSV do TSE linha a linha (pelo nome da coluna) e chama `porLinha(registro)`.
async function lerCsv(linhas, obrigatorias, tipo, porLinha) {
  let cabecalho = null;
  for await (const linha of linhas) {
    if (!linha.trim()) continue;
    const campos = lerLinhaCsv(linha);
    if (!cabecalho) {
      cabecalho = campos.map((c) => c.trim().replace(/^\uFEFF/, ''));
      for (const c of obrigatorias) {
        if (!cabecalho.includes(c)) throw new Error(`Arquivo do TSE sem a coluna ${c}: é o "${tipo}"?`);
      }
      continue;
    }
    porLinha(Object.fromEntries(cabecalho.map((c, i) => [c, campos[i]])));
  }
}

// Eleitos do arquivo "consulta_cand" (sem repetir candidato: quem foi ao 2º turno aparece duas
// vezes, e só a linha do 2º turno diz "ELEITO").
export async function eleitosDoCsv(linhas, agora = new Date().toISOString()) {
  const porId = new Map();
  await lerCsv(linhas, ['CD_CARGO', 'SQ_CANDIDATO', 'DS_SIT_TOT_TURNO'], 'consulta_cand', (r) => {
    const p = politicoDoTse(r, agora);
    if (p) porId.set(p.id, p);
  });
  return [...porId.values()];
}

// Bens declarados ("bem_candidato_{ano}"), só de quem está em `ids` (os eleitos).
// Devolve { bens: [linhas de politico_bens], totais: Map(id → soma) }.
export async function bensDoCsv(linhas, ids) {
  const bens = [];
  const totais = new Map();
  const ordemPorId = new Map();
  await lerCsv(linhas, ['SQ_CANDIDATO', 'VR_BEM_CANDIDATO'], 'bem_candidato', (r) => {
    const id = Number(r.SQ_CANDIDATO);
    if (!ids.has(id)) return;
    const ordemCsv = Number(col(r, 'NR_ORDEM_BEM_CANDIDATO', 'NR_ORDEM_CANDIDATO'));
    const ordem = Number.isInteger(ordemCsv) && ordemCsv > 0 ? ordemCsv : (ordemPorId.get(id) ?? 0) + 1;
    ordemPorId.set(id, Math.max(ordem, ordemPorId.get(id) ?? 0));
    const v = valorBr(r.VR_BEM_CANDIDATO);
    bens.push({
      politico_id: id,
      ordem,
      tipo: frase(col(r, 'DS_TIPO_BEM_CANDIDATO')),
      descricao: mascararCpf(col(r, 'DS_BEM_CANDIDATO')),
      valor: v,
      ano: Number(col(r, 'ANO_ELEICAO')) || null,
    });
    totais.set(id, Math.round(((totais.get(id) ?? 0) + (v ?? 0)) * 100) / 100);
  });
  return { bens, totais };
}

// Votos ("votacao_candidato_munzona_{ano}"): soma QT_VOTOS_NOMINAIS de todas as zonas, por
// candidato e turno, e fica com o ÚLTIMO turno disputado. Devolve Map(id → { votos, turno }).
export async function votosDoCsv(linhas, ids, acumulado = new Map()) {
  const porTurno = new Map(); // "id|turno" → votos
  await lerCsv(linhas, ['SQ_CANDIDATO', 'NR_TURNO'], 'votacao_candidato_munzona', (r) => {
    const id = Number(r.SQ_CANDIDATO);
    if (!ids.has(id)) return;
    const votos = Number(col(r, 'QT_VOTOS_NOMINAIS', 'QT_VOTOS_NOMINAIS_VALIDOS')) || 0;
    const chave = `${id}|${Number(r.NR_TURNO)}`;
    porTurno.set(chave, (porTurno.get(chave) ?? 0) + votos);
  });
  for (const [chave, votos] of porTurno) {
    const [id, turno] = chave.split('|').map(Number);
    const atual = acumulado.get(id);
    if (!atual || turno > atual.turno) acumulado.set(id, { votos, turno });
    else if (turno === atual.turno) atual.votos += votos; // mesmo turno vindo de outro arquivo (UF)
  }
  return acumulado;
}
