/**
 * Notícias em destaque na aba Notícias. Selecionadas pela equipe, sempre com link para a fonte original.
 * Para trocar: edite esta lista (máximo 3 a 5 itens). Use só notícias de fontes confiáveis e confira a data.
 * Quando o back-end tiver o feed automático, esta lista pode vir da API.
 */
export interface Noticia {
  titulo: string;
  /** Uma ou duas frases fiéis à matéria original, sem opinião. */
  resumo: string;
  tema: string;
  icone: string;
  /** Data como aparece no card (ex.: "10 nov. 2026"). */
  data: string;
  fonte: string;
  url: string;
  /** Imagem do card. As do próprio site são ilustrativas. */
  imagem: string;
  imagemIlustrativa: boolean;
  /** Pergunta sugerida para o FatoBot sobre o assunto. */
  pergunta: string;
}

export const NOTICIAS_DESTAQUE: Noticia[] = [
  {
    titulo: 'TSE multa Meta em R$ 7,5 milhões por descumprir ordens nas eleições',
    resumo:
      'Por unanimidade, o Tribunal Superior Eleitoral entendeu que a empresa respondeu de forma incompleta e com atraso a ordens sobre a distribuição de conteúdo político nas eleições de 2026. A multa não encerra o caso: o tribunal continua investigando se houve favorecimento de candidaturas.',
    tema: 'Eleições',
    icone: 'how_to_vote',
    data: '10 nov. 2026',
    fonte: 'Tribunal Superior Eleitoral',
    url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Novembro/tse-multa-facebook-em-r-7-5-milhoes-por-descumprir-determinacoes-judiciais',
    imagem: 'img/noticia-tse-meta.svg',
    imagemIlustrativa: true,
    pergunta: 'Que regras as plataformas digitais precisam seguir durante as eleições no Brasil?',
  },
  {
    titulo: 'MEC aprova diretrizes para o uso de inteligência artificial em cada etapa da educação',
    resumo:
      'As regras, propostas pelo Conselho Nacional de Educação, tratam a IA como ferramenta de apoio que não substitui o professor. Entre os pontos estão a proibição de usar IA para corrigir redações e provas dissertativas e limites ao uso sem supervisão por crianças até o 5º ano.',
    tema: 'Educação',
    icone: 'school',
    data: 'nov. 2026',
    fonte: 'Agência Brasil',
    url: 'https://agenciabrasil.ebc.com.br/educacao/noticia/2026-11/mec-aprova-diretrizes-para-uso-de-ia-em-cada-etapa-da-educacao',
    imagem: 'img/noticia-ia-educacao.svg',
    imagemIlustrativa: true,
    pergunta: 'O que é o Conselho Nacional de Educação e como ele define regras para as escolas?',
  },
  {
    titulo: 'Monitor do El Niño: apenas 284 municípios têm planos de contingência',
    resumo:
      'Levantamento mostra que só 284 cidades brasileiras têm um plano de contingência para os efeitos do El Niño, fenômeno que altera chuvas e temperaturas no país. Esse plano define áreas de risco, abrigos e rotas de evacuação antes de a emergência acontecer.',
    tema: 'Meio ambiente',
    icone: 'thermostat',
    data: 'nov. 2026',
    fonte: 'Agência Brasil',
    url: 'https://agenciabrasil.ebc.com.br/meio-ambiente/noticia/2026-11/monitor-do-el-nino-apenas-284-municipios-tem-planos-de-contingencia',
    imagem: 'img/noticia-el-nino.svg',
    imagemIlustrativa: true,
    pergunta: 'O que é um plano de contingência municipal e quem é responsável por ele?',
  },
];
