// Registros reais levantados pela equipe em fontes oficiais (STF e Agência Brasil), em 16/11/2026.
// CÓPIA de frontend/src/app/core/registros-verificados.ts (o FatoBot usa no back-end).
// Ao corrigir ou acrescentar um registro, mude OS DOIS arquivos.
// Regra: só fatos publicados em fonte oficial ou agência pública; nada de opinião ou adjetivo.
// Só vale quando o nome bate EXATAMENTE (sem acento/maiúsculas), para nunca cair na pessoa errada.
const AP_2670 = 'https://noticias.stf.jus.br/postsnoticias/stf-condena-sete-reus-por-desvio-de-emendas-parlamentares-destinadas-a-municipio-do-maranhao-2/';

export const REGISTROS_VERIFICADOS = [
  {
    nome: 'Josimar Maranhãozinho', casa: 'camara', tipo: 'Condenação', data: '2026-03-17', orgao: 'STF', fonte_url: AP_2670,
    titulo: 'Condenado pela Primeira Turma do STF por corrupção passiva (AP 2670)',
    descricao: 'Caso de desvio de emendas parlamentares destinadas a São José de Ribamar (MA). Foi absolvido da acusação de organização criminosa. Regime inicial semiaberto; o STF deixou para a Câmara decidir sobre o mandato.',
  },
  {
    nome: 'Pastor Gil', casa: 'camara', tipo: 'Condenação', data: '2026-03-17', orgao: 'STF', fonte_url: AP_2670,
    titulo: 'Condenado pela Primeira Turma do STF por corrupção passiva (AP 2670)',
    descricao: 'Caso de desvio de emendas parlamentares destinadas a São José de Ribamar (MA). Foi absolvido da acusação de organização criminosa. Regime inicial semiaberto; o STF deixou para a Câmara decidir sobre o mandato.',
  },
  {
    nome: 'Alexandre Ramagem', casa: 'camara', tipo: 'Condenação', data: '2025-09-11', orgao: 'STF',
    fonte_url: 'https://noticias.stf.jus.br/postsnoticias/stf-condena-os-oito-reus-da-acao-por-golpe-de-estado/',
    titulo: 'Condenado pela Primeira Turma do STF na ação sobre a tentativa de golpe de Estado (AP 2668)',
    descricao: 'Era um dos oito réus do chamado Núcleo 1 da ação penal sobre a tentativa de golpe de Estado, julgada pela Primeira Turma do STF.',
  },
  {
    nome: 'Gilvan da Federal', casa: 'camara', tipo: 'Processo em andamento', data: '2026-08-18', orgao: 'Agência Brasil (decisão do STF)',
    fonte_url: 'https://agenciabrasil.ebc.com.br/justica/noticia/2026-08/deputado-vira-reu-no-stf-por-injuria-contra-lula',
    titulo: 'Virou réu no STF por injúria contra o presidente da República',
    descricao: 'A Primeira Turma do STF recebeu a acusação de injúria contra o presidente Luiz Inácio Lula da Silva. Ser réu não é ser condenado: o processo ainda será julgado.',
  },
  {
    nome: 'Camarinha', casa: 'camara', tipo: 'Processo em andamento', data: null, orgao: 'STF',
    fonte_url: 'https://noticias.stf.jus.br/postsnoticias/deputado-federal-camarinha-respondera-a-acao-penal-no-supremo-por-calunia-a-jornalista/',
    titulo: 'Responde a ação penal no STF por calúnia contra jornalista',
    descricao: 'O STF recebeu queixa-crime e ele passou à condição de réu em ação penal privada por calúnia. Ser réu não é ser condenado.',
  },
  {
    nome: 'José Nelto', casa: 'camara', tipo: 'Absolvição ou arquivamento', data: null, orgao: 'STF',
    fonte_url: 'https://noticias.stf.jus.br/postsnoticias/1a-turma-do-stf-rejeita-queixa-crime-por-ofensas-entre-deputados-federais-em-podcast/',
    titulo: 'STF rejeitou queixa-crime por ofensas em podcast',
    descricao: 'A Primeira Turma do STF rejeitou, por empate, a queixa-crime apresentada por outro deputado por ofensas ditas em um podcast. Ele não se tornou réu nesse caso.',
  },
];
