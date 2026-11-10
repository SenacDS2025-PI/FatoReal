// Base de conhecimento do FatoBot: fatos sobre como a política brasileira funciona,
// cada um com a fonte oficial (Constituição Federal de 1988, no site do Planalto).
//
// O FatoBot só pode responder com o que estiver aqui ou nos dados da Câmara.
// Para ensinar algo novo ao FatoBot, acrescente um item com:
//   id       → código único (B + número)
//   titulo   → nome curto do assunto
//   texto    → o fato, em linguagem simples, fiel ao texto da fonte
//   artigo   → onde está na fonte (aparece no título da referência)
//   palavras → termos que ajudam a achar o item quando a IA não está ligada
//
// Não use números que mudam com o tempo (ex.: total de deputados): esses vêm da API da Câmara.

export const CONSTITUICAO = {
  nome: 'Constituição Federal de 1988',
  url: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
};

export const BASE = [
  {
    id: 'B01',
    titulo: 'Origem do poder',
    artigo: 'art. 1º, parágrafo único',
    texto:
      'Todo o poder emana do povo, que o exerce por meio de representantes eleitos ou diretamente, nos termos da Constituição.',
    palavras: ['democracia', 'poder', 'povo', 'soberania'],
  },
  {
    id: 'B02',
    titulo: 'Três Poderes',
    artigo: 'art. 2º',
    texto:
      'São Poderes da União, independentes e harmônicos entre si, o Legislativo, o Executivo e o Judiciário.',
    palavras: ['poderes', 'tres poderes', 'legislativo', 'executivo', 'judiciario'],
  },
  {
    id: 'B03',
    titulo: 'Organização do Estado',
    artigo: 'art. 18',
    texto:
      'A organização político-administrativa do Brasil compreende a União, os Estados, o Distrito Federal e os Municípios, todos autônomos.',
    palavras: ['federacao', 'federativa', 'uniao', 'organizacao do estado', 'autonomia'],
  },
  {
    id: 'B04',
    titulo: 'Voto e participação direta',
    artigo: 'art. 14',
    texto:
      'A soberania popular é exercida pelo sufrágio universal e pelo voto direto e secreto, com valor igual para todos, e também por plebiscito, referendo e iniciativa popular. ' +
      'O voto é obrigatório para maiores de 18 anos e facultativo para analfabetos, maiores de 70 anos e jovens de 16 e 17 anos.',
    palavras: ['voto', 'votar', 'eleicao', 'plebiscito', 'referendo', 'obrigatorio', 'facultativo'],
  },
  {
    id: 'B05',
    titulo: 'Idade mínima para se candidatar',
    artigo: 'art. 14, § 3º, VI',
    texto:
      'Idade mínima para se candidatar: 35 anos para presidente, vice-presidente e senador; 30 anos para governador e vice; ' +
      '21 anos para deputado federal, deputado estadual ou distrital, prefeito, vice-prefeito e juiz de paz; 18 anos para vereador.',
    palavras: ['idade', 'candidato', 'candidatar', 'elegibilidade', 'minima'],
  },
  {
    id: 'B06',
    titulo: 'Reeleição',
    artigo: 'art. 14, § 5º',
    texto:
      'O presidente da República, os governadores e os prefeitos podem ser reeleitos para um único período seguinte.',
    palavras: ['reeleicao', 'reeleito', 'segundo mandato'],
  },
  {
    id: 'B07',
    titulo: 'Congresso Nacional',
    artigo: 'art. 44',
    texto:
      'O Poder Legislativo federal é exercido pelo Congresso Nacional, composto pela Câmara dos Deputados e pelo Senado Federal. Cada legislatura dura quatro anos.',
    palavras: ['congresso', 'legislatura', 'legislativo'],
  },
  {
    id: 'B08',
    titulo: 'Câmara dos Deputados',
    artigo: 'art. 45',
    texto:
      'A Câmara dos Deputados é formada por representantes do povo, eleitos pelo sistema proporcional em cada Estado e no Distrito Federal. ' +
      'O número de deputados é definido por lei complementar, proporcional à população, e nenhum Estado pode ter menos de oito nem mais de setenta deputados. ' +
      'O mandato de deputado federal é de quatro anos (uma legislatura).',
    palavras: ['camara', 'deputado', 'deputados', 'proporcional', 'quantos deputados'],
  },
  {
    id: 'B09',
    titulo: 'Senado Federal',
    artigo: 'art. 46',
    texto:
      'O Senado é formado por representantes dos Estados e do Distrito Federal, eleitos pelo princípio majoritário. Cada Estado e o Distrito Federal elegem três senadores, com mandato de oito anos. ' +
      'A representação é renovada de quatro em quatro anos, alternadamente, por um terço e por dois terços.',
    palavras: ['senado', 'senador', 'senadores'],
  },
  {
    id: 'B10',
    titulo: 'Como as Casas votam',
    artigo: 'art. 47',
    texto:
      'Salvo disposição constitucional em contrário, as decisões de cada Casa e de suas comissões são tomadas por maioria dos votos, presente a maioria absoluta dos seus membros.',
    palavras: ['votacao', 'maioria', 'quorum', 'plenario', 'votam'],
  },
  {
    id: 'B11',
    titulo: 'Funções do Congresso',
    artigo: 'arts. 48 e 49',
    texto:
      'Cabe ao Congresso Nacional, com a sanção do presidente, legislar sobre as matérias de competência da União. ' +
      'É competência exclusiva do Congresso, entre outras, julgar anualmente as contas do presidente da República e fiscalizar e controlar os atos do Poder Executivo.',
    palavras: ['funcao', 'faz', 'legislar', 'fiscalizar', 'papel', 'serve'],
  },
  {
    id: 'B12',
    titulo: 'Competências da Câmara',
    artigo: 'art. 51',
    texto:
      'Compete privativamente à Câmara dos Deputados, entre outras atribuições, autorizar, por dois terços de seus membros, a instauração de processo contra o presidente, o vice-presidente e os ministros de Estado.',
    palavras: ['impeachment', 'autorizar', 'processo contra o presidente'],
  },
  {
    id: 'B13',
    titulo: 'Competências do Senado',
    artigo: 'art. 52',
    texto:
      'Compete privativamente ao Senado, entre outras atribuições, processar e julgar o presidente e o vice-presidente nos crimes de responsabilidade e aprovar a escolha de ministros do Supremo Tribunal Federal.',
    palavras: ['impeachment', 'julgar', 'crime de responsabilidade', 'sabatina'],
  },
  {
    id: 'B14',
    titulo: 'Imunidade parlamentar',
    artigo: 'art. 53',
    texto:
      'Deputados e senadores são invioláveis, civil e penalmente, por quaisquer de suas opiniões, palavras e votos.',
    palavras: ['imunidade', 'inviolavel', 'parlamentar'],
  },
  {
    id: 'B15',
    titulo: 'Comissões',
    artigo: 'art. 58',
    texto:
      'O Congresso Nacional e suas Casas têm comissões permanentes e temporárias. Elas podem, por exemplo, discutir e votar projetos de lei e realizar audiências públicas. ' +
      'As comissões parlamentares de inquérito (CPIs) têm poderes de investigação próprios das autoridades judiciais e são criadas a requerimento de um terço dos membros.',
    palavras: ['comissao', 'comissoes', 'cpi', 'inquerito'],
  },
  {
    id: 'B16',
    titulo: 'Emenda à Constituição (PEC)',
    artigo: 'art. 60',
    texto:
      'A Constituição pode ser emendada por proposta de um terço dos deputados ou dos senadores, do presidente da República ou de mais da metade das Assembleias Legislativas. ' +
      'A proposta é votada em cada Casa em dois turnos e só é aprovada se obtiver três quintos dos votos. ' +
      'Não pode ser votada emenda que tente abolir a forma federativa, o voto direto, secreto, universal e periódico, a separação dos Poderes ou os direitos e garantias individuais (cláusulas pétreas).',
    palavras: ['pec', 'emenda', 'clausula petrea', 'constituicao'],
  },
  {
    id: 'B17',
    titulo: 'Quem pode propor leis',
    artigo: 'art. 61',
    texto:
      'Podem propor leis: qualquer deputado, senador ou comissão, o presidente da República, o Supremo Tribunal Federal, os Tribunais Superiores, o procurador-geral da República e os cidadãos. ' +
      'A iniciativa popular exige assinaturas de pelo menos 1% do eleitorado nacional, distribuídas por pelo menos cinco Estados, com no mínimo 0,3% dos eleitores de cada um deles.',
    palavras: ['propor', 'iniciativa', 'projeto de lei', 'iniciativa popular', 'assinaturas'],
  },
  {
    id: 'B18',
    titulo: 'Medida provisória',
    artigo: 'art. 62',
    texto:
      'Em caso de relevância e urgência, o presidente pode adotar medidas provisórias, com força de lei, e deve submetê-las de imediato ao Congresso. ' +
      'Elas perdem a validade se não forem convertidas em lei em 60 dias, prazo que pode ser prorrogado uma vez por mais 60.',
    palavras: ['medida provisoria', 'mp'],
  },
  {
    id: 'B19',
    titulo: 'Caminho de um projeto de lei',
    artigo: 'arts. 64 e 65',
    texto:
      'Projetos de lei apresentados pelo presidente, pelo STF ou pelos Tribunais Superiores começam a tramitar na Câmara dos Deputados. ' +
      'O projeto aprovado por uma Casa é revisto pela outra em um só turno: se a outra Casa aprovar, segue para sanção; se rejeitar, é arquivado; se emendar, volta à Casa onde começou.',
    palavras: ['projeto de lei', 'lei', 'tramitacao', 'como uma lei', 'criada', 'aprovada'],
  },
  {
    id: 'B20',
    titulo: 'Sanção e veto',
    artigo: 'art. 66',
    texto:
      'Depois de aprovado, o projeto vai ao presidente, que pode sancioná-lo ou vetá-lo, total ou parcialmente, em 15 dias úteis; se ficar em silêncio nesse prazo, o projeto é considerado sancionado. ' +
      'O veto é analisado em sessão conjunta do Congresso e só pode ser derrubado pelo voto da maioria absoluta dos deputados e dos senadores.',
    palavras: ['sancao', 'veto', 'vetar', 'sancionar', 'derrubar'],
  },
  {
    id: 'B21',
    titulo: 'Poder Executivo',
    artigo: 'arts. 76 e 82',
    texto:
      'O Poder Executivo é exercido pelo presidente da República, auxiliado pelos ministros de Estado. O mandato do presidente é de quatro anos.',
    palavras: ['presidente', 'executivo', 'ministro', 'ministros', 'mandato do presidente'],
  },
  {
    id: 'B22',
    titulo: 'Eleição do presidente',
    artigo: 'art. 77',
    texto:
      'É eleito presidente o candidato que obtiver a maioria absoluta dos votos, sem contar brancos e nulos. Se ninguém alcançar isso no primeiro turno, há segundo turno entre os dois mais votados.',
    palavras: ['segundo turno', 'eleicao presidencial', 'eleito', 'turno'],
  },
  {
    id: 'B23',
    titulo: 'Supremo Tribunal Federal',
    artigo: 'arts. 101 e 102',
    texto:
      'O Supremo Tribunal Federal é composto por onze ministros e tem como função principal a guarda da Constituição.',
    palavras: ['stf', 'supremo', 'judiciario', 'ministros do stf'],
  },
  {
    id: 'B24',
    titulo: 'Estados e municípios',
    artigo: 'arts. 27, 28 e 29',
    texto:
      'Cada Estado tem um governador e uma Assembleia Legislativa formada por deputados estaduais, com mandatos de quatro anos. ' +
      'Cada município tem prefeito, vice-prefeito e vereadores, também com mandatos de quatro anos.',
    palavras: ['governador', 'prefeito', 'vereador', 'assembleia', 'deputado estadual', 'municipio'],
  },
];
