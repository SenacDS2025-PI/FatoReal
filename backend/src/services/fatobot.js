// FatoBot — responde SOMENTE com base em fontes oficiais (RN02 e RN04).
//
// Pipeline (documentação v2, Figura 4):
//   1. Pergunta  →  2. Busca documental  →  3. Filtro de evidência
//   →  4. Síntese  →  5. Exibição com fontes e aviso
//
// A etapa 4 usa o Gemini (src/services/gemini.js), que recebe APENAS as evidências
// encontradas e precisa citá-las. Se a chave não estiver configurada, se o Gemini
// disser que as evidências não bastam ou se a resposta vier sem citações válidas,
// o FatoBot responde no modo "somente_fontes": só a lista de fatos, sem IA.
import { listarDeputados, obterDeputado } from './camara.js';
import { sintetizarComIA } from './gemini.js';
import { normalizar } from '../utils/texto.js';

export const AVISO =
  'O FatoBot pode errar. Confira sempre as fontes oficiais. ' +
  'Não encontrar evidência não significa que a informação é falsa.';

const MAX_DEPUTADOS_POR_PERGUNTA = 3;

// Etapa 2a: descobre quais deputados a pergunta cita (pelo nome parlamentar completo).
export async function identificarDeputados(pergunta) {
  const texto = ` ${normalizar(pergunta).replace(/[^a-z0-9]+/g, ' ')} `;
  const { dados } = await listarDeputados();

  return dados
    .filter((d) => {
      const nome = normalizar(d.nome).replace(/[^a-z0-9]+/g, ' ').trim();
      return nome.includes(' ') && texto.includes(` ${nome} `);
    })
    .slice(0, MAX_DEPUTADOS_POR_PERGUNTA);
}

function formatarData(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

// Etapa 3: transforma o perfil em evidências — cada fato com a sua fonte e data.
export function evidenciasDoPerfil({ dados: p, fonte }) {
  const ref = { fonte: fonte.nome, url: fonte.url, consultadoEm: fonte.consultadoEm };
  const evidencias = [];
  const add = (texto) => evidencias.push({ texto, ...ref });

  if (p.partido && p.uf) {
    add(`${p.nome} é deputado(a) federal pelo ${p.partido}-${p.uf}.`);
  }
  if (p.situacao) {
    const desde = formatarData(p.dataDoStatus);
    add(
      `Situação na Câmara: ${p.situacao}` +
        (p.condicaoEleitoral ? ` (${p.condicaoEleitoral.toLowerCase()})` : '') +
        (desde ? `, registrada em ${desde}.` : '.')
    );
  }
  if (p.legislatura) add(`Legislatura atual: ${p.legislatura}ª.`);
  if (p.escolaridade) add(`Escolaridade declarada: ${p.escolaridade}.`);
  if (p.municipioNascimento && p.ufNascimento) {
    add(`Naturalidade: ${p.municipioNascimento}-${p.ufNascimento}.`);
  }
  if (p.gabinete?.email) add(`E-mail oficial do gabinete: ${p.gabinete.email}.`);

  return evidencias;
}

// Etapas 2b e 3: busca o perfil de cada deputado e monta evidências e fontes.
// Formato das fontes = o que o front usa (frontend/src/app/core/modelos.ts → Fonte).
export async function evidenciasDosDeputados(deputados) {
  const perfis = await Promise.all(deputados.map((d) => obterDeputado(d.id)));
  return {
    evidencias: perfis.flatMap(evidenciasDoPerfil),
    fontes: perfis.map(({ dados, fonte }) => ({
      titulo: `${fonte.nome}: ${dados.nome}`,
      url: fonte.url,
      data: fonte.consultadoEm,
    })),
  };
}

export async function responder(pergunta) {
  const deputados = await identificarDeputados(pergunta);

  // Sem documento relacionado → declara incerteza em vez de especular (RN04).
  if (deputados.length === 0) {
    return {
      pergunta,
      tipo: 'sem_evidencia',
      modo: 'somente_fontes',
      resposta:
        'Não encontrei evidência nas fontes oficiais que consulto para responder a essa pergunta. ' +
        'Por enquanto consigo responder sobre deputados federais em exercício: ' +
        'tente incluir o nome parlamentar completo (ex.: "Quem é Tabata Amaral?").',
      evidencias: [],
      fontes: [],
      consultado_em: new Date().toISOString(),
      sem_evidencia: true,
      aviso: AVISO,
    };
  }

  const { evidencias, fontes } = await evidenciasDosDeputados(deputados);

  const sintese = await sintetizarComIA(pergunta, evidencias);

  return {
    pergunta,
    tipo: 'fontes_encontradas',
    modo: sintese ? 'ia_com_fontes' : 'somente_fontes',
    resposta:
      sintese?.texto ??
      'Encontrei estas informações nas fontes oficiais:\n' +
        evidencias.map((e) => `• ${e.texto}`).join('\n'),
    evidencias,
    fontes,
    consultado_em: new Date().toISOString(),
    sem_evidencia: false,
    aviso: AVISO,
  };
}
