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
// LGPD: não guardamos CPF, título de eleitor, e-mail, gênero, cor/raça, estado civil nem data de nascimento.
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

// Foto oficial da candidatura no DivulgaCandContas (o script confere se o endereço abre).
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

  return {
    id: Number(r.SQ_CANDIDATO),
    nome,
    nome_civil: nomeProprio(valor(r.NM_CANDIDATO)),
    partido: valor(r.SG_PARTIDO),
    uf: valor(r.SG_UF), // "BR" para Presidente
    cargo,
    municipio,
    municipio_busca: municipio ? normalizar(municipio) : null,
    foto_url:
      valor(r.CD_ELEICAO) && valor(r.SG_UE) ? fotoTse(r.CD_ELEICAO.trim(), r.SQ_CANDIDATO.trim(), r.SG_UE.trim()) : null,
    email: null,
    situacao: `Eleito(a) em ${ano} (${String(r.DS_SIT_TOT_TURNO).trim().toLowerCase()})`,
    escolaridade: frase(valor(r.DS_GRAU_INSTRUCAO)),
    fonte_url: fonteTseUrl(ano),
    data_coleta: agora,
    atualizado_em: agora,
  };
}

// Lê as linhas de texto de um CSV do TSE e devolve os eleitos (sem repetir candidato:
// quem foi ao 2º turno aparece duas vezes, e só a linha do 2º turno diz "ELEITO").
export async function eleitosDoCsv(linhas, agora = new Date().toISOString()) {
  let cabecalho = null;
  const porId = new Map();
  for await (const linha of linhas) {
    if (!linha.trim()) continue;
    const campos = lerLinhaCsv(linha);
    if (!cabecalho) {
      cabecalho = campos.map((c) => c.trim().replace(/^﻿/, ''));
      for (const col of ['CD_CARGO', 'SQ_CANDIDATO', 'DS_SIT_TOT_TURNO']) {
        if (!cabecalho.includes(col)) throw new Error(`Arquivo do TSE sem a coluna ${col}: é o "consulta_cand"?`);
      }
      continue;
    }
    const r = Object.fromEntries(cabecalho.map((c, i) => [c, campos[i]]));
    const p = politicoDoTse(r, agora);
    if (p) porId.set(p.id, p);
  }
  return [...porId.values()];
}
