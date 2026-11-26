// Catálogo de fontes OFICIAIS e confiáveis do Fato Real (pedido do Guilherme, 24/11/2026).
//
// Dois tipos:
// - "integrada": o FatoBot e o Fato ou Fake leem os dados dela e citam como evidência.
// - "consulta":  o Fato Real só INDICA o link ("onde conferir") quando não tem evidência.
//   Nunca é usada como evidência, porque o sistema não leu o conteúdo.
//
// Só órgãos públicos (Poderes, tribunais, órgãos de controle, estatísticas oficiais e a
// agência pública de notícias). Nada de blog, rede social ou site partidário.
// GET /api/fontes devolve esta lista para o front (ex.: tela "Fontes" ou rodapé).
import { normalizar } from '../utils/texto.js';

export const FONTES_OFICIAIS = [
  // ---------- Integradas (viram evidência) ----------
  {
    id: 'camara',
    nome: 'Câmara dos Deputados — Dados Abertos',
    orgao: 'Câmara dos Deputados',
    url: 'https://dadosabertos.camara.leg.br',
    tipo: 'integrada',
    cobre: 'Deputados federais em exercício: perfil, partido, UF, gabinete, projetos, votações e despesas.',
    palavras: ['deputado', 'deputada', 'camara', 'projeto de lei', 'votacao', 'cota parlamentar'],
  },
  {
    id: 'senado',
    nome: 'Senado Federal — Dados Abertos',
    orgao: 'Senado Federal',
    url: 'https://legis.senado.leg.br/dadosabertos',
    tipo: 'integrada',
    cobre: 'Senadores em exercício: perfil, partido e UF.',
    palavras: ['senador', 'senadora', 'senado'],
  },
  {
    id: 'tse',
    nome: 'Tribunal Superior Eleitoral (TSE) — Dados Abertos',
    orgao: 'Justiça Eleitoral',
    url: 'https://dadosabertos.tse.jus.br',
    tipo: 'integrada',
    cobre: 'Eleitos para Presidente, Governador, Deputado Estadual (2022), Prefeito e Vereador (2024).',
    palavras: ['eleito', 'eleicao', 'prefeito', 'prefeita', 'vereador', 'vereadora', 'governador', 'governadora', 'presidente'],
  },
  {
    id: 'constituicao',
    nome: 'Constituição Federal de 1988 (Planalto)',
    orgao: 'Presidência da República',
    url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    tipo: 'integrada',
    cobre: 'Regras básicas: Três Poderes, direitos, voto, funções de cada cargo.',
    palavras: ['constituicao', 'direito', 'poderes', 'cidadania'],
  },

  // ---------- Consulta (só indicamos o link) ----------
  {
    id: 'divulgacand',
    nome: 'DivulgaCandContas (TSE)',
    orgao: 'Justiça Eleitoral',
    url: 'https://divulgacandcontas.tse.jus.br',
    tipo: 'consulta',
    cobre: 'Candidaturas, bens declarados e prestação de contas de campanha.',
    palavras: ['bens', 'patrimonio', 'campanha', 'doacao', 'doador', 'candidato', 'candidata', 'candidatura', 'prestacao de contas'],
  },
  {
    id: 'fato-ou-boato',
    nome: 'Fato ou Boato (Justiça Eleitoral)',
    orgao: 'Justiça Eleitoral',
    url: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/',
    tipo: 'consulta',
    cobre: 'Checagem oficial de boatos sobre eleições, urna eletrônica e voto.',
    palavras: ['urna', 'fraude', 'voto', 'eleicao', 'boato', 'fake', 'biometria', 'titulo de eleitor'],
  },
  {
    id: 'transparencia',
    nome: 'Portal da Transparência (CGU)',
    orgao: 'Controladoria-Geral da União',
    url: 'https://portaldatransparencia.gov.br',
    tipo: 'consulta',
    cobre: 'Gastos do governo federal, salários de servidores, contratos, convênios e benefícios sociais.',
    palavras: ['gasto', 'gastou', 'despesa', 'salario', 'contrato', 'licitacao', 'convenio', 'bolsa familia', 'beneficio', 'verba', 'dinheiro publico', 'emenda'],
  },
  {
    id: 'tcu',
    nome: 'Tribunal de Contas da União (TCU)',
    orgao: 'TCU',
    url: 'https://portal.tcu.gov.br',
    tipo: 'consulta',
    cobre: 'Fiscalização do uso do dinheiro público federal, auditorias e contas julgadas irregulares.',
    palavras: ['auditoria', 'irregular', 'superfaturamento', 'desvio', 'obra', 'licitacao', 'contas'],
  },
  {
    id: 'stf',
    nome: 'Supremo Tribunal Federal (STF)',
    orgao: 'STF',
    url: 'https://portal.stf.jus.br',
    tipo: 'consulta',
    cobre: 'Processos e decisões do STF (inclusive contra autoridades com foro). Processo não é condenação.',
    palavras: ['stf', 'supremo', 'ministro', 'julgamento', 'processo', 'condenado', 'condenacao', 'inquerito', 'foro', 'preso', 'prisao'],
  },
  {
    id: 'cnj',
    nome: 'Conselho Nacional de Justiça (CNJ)',
    orgao: 'CNJ',
    url: 'https://www.cnj.jus.br',
    tipo: 'consulta',
    cobre: 'Dados e informações do Poder Judiciário.',
    palavras: ['justica', 'juiz', 'tribunal', 'processo', 'judiciario'],
  },
  {
    id: 'dou',
    nome: 'Diário Oficial da União',
    orgao: 'Imprensa Nacional',
    url: 'https://www.in.gov.br',
    tipo: 'consulta',
    cobre: 'Leis, decretos, nomeações e atos oficiais publicados pelo governo federal.',
    palavras: ['lei', 'decreto', 'medida provisoria', 'nomeado', 'nomeacao', 'exonerado', 'portaria', 'sancionou', 'diario oficial'],
  },
  {
    id: 'ibge',
    nome: 'Instituto Brasileiro de Geografia e Estatística (IBGE)',
    orgao: 'IBGE',
    url: 'https://www.ibge.gov.br',
    tipo: 'consulta',
    cobre: 'População, desemprego, inflação (IPCA), PIB e dados das cidades.',
    palavras: ['populacao', 'habitantes', 'desemprego', 'inflacao', 'ipca', 'pib', 'censo', 'pobreza', 'renda'],
  },
  {
    id: 'bcb',
    nome: 'Banco Central do Brasil',
    orgao: 'Banco Central',
    url: 'https://www.bcb.gov.br',
    tipo: 'consulta',
    cobre: 'Taxa de juros (Selic), câmbio (dólar) e dados da economia.',
    palavras: ['selic', 'juros', 'dolar', 'cambio', 'banco central', 'pix'],
  },
  {
    id: 'dados-gov',
    nome: 'Portal Brasileiro de Dados Abertos',
    orgao: 'Governo Federal',
    url: 'https://dados.gov.br',
    tipo: 'consulta',
    cobre: 'Catálogo com os dados abertos de todos os órgãos federais.',
    palavras: ['dados abertos', 'estatistica', 'dados do governo'],
  },
  {
    id: 'agencia-brasil',
    nome: 'Agência Brasil (EBC)',
    orgao: 'Empresa Brasil de Comunicação',
    url: 'https://agenciabrasil.ebc.com.br',
    tipo: 'consulta',
    cobre: 'Notícias da agência pública de comunicação.',
    palavras: ['noticia', 'aconteceu', 'anunciou', 'governo'],
  },
  {
    id: 'agencia-senado',
    nome: 'Agência Senado',
    orgao: 'Senado Federal',
    url: 'https://www12.senado.leg.br/noticias',
    tipo: 'consulta',
    cobre: 'Notícias oficiais do Senado: votações, projetos e sessões.',
    palavras: ['senado aprovou', 'senado votou', 'senadores aprovaram'],
  },
  {
    id: 'agencia-camara',
    nome: 'Agência Câmara de Notícias',
    orgao: 'Câmara dos Deputados',
    url: 'https://www.camara.leg.br/noticias',
    tipo: 'consulta',
    cobre: 'Notícias oficiais da Câmara: votações, projetos e sessões.',
    palavras: ['camara aprovou', 'camara votou', 'deputados aprovaram'],
  },
];

// Formato público (sem as palavras-chave internas).
export const catalogoPublico = () => FONTES_OFICIAIS.map(({ palavras, ...f }) => f);

const MAX_SUGESTOES = 3;
const limpar = (t) => ` ${normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;
const INDICE = FONTES_OFICIAIS.map((f) => ({ f, palavras: f.palavras.map(limpar) }));

// Fontes de "consulta" mais ligadas ao texto (para indicar onde conferir). Pode vir vazia.
export function sugerirFontes(texto) {
  const alvo = limpar(texto);
  return INDICE.filter(({ f }) => f.tipo === 'consulta')
    .map(({ f, palavras }) => ({ f, pontos: palavras.filter((p) => alvo.includes(p)).length }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, MAX_SUGESTOES)
    .map(({ f }) => ({ nome: f.nome, url: f.url, cobre: f.cobre }));
}
