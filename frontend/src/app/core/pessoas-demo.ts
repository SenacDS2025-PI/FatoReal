// Pessoas de exemplo do MODO DEMONSTRAÇÃO (sem Supabase). Servem para testar perfis, seguir e o feed.
// Todas têm "(exemplo)" no nome para não serem confundidas com pessoas reais.
import { PerfilPublico } from './modelos';

export const PESSOAS_EXEMPLO: PerfilPublico[] = [
  {
    id: 'equipe', nome: 'Fato Real', foto_url: 'logo.svg', moderador: true, capa: 'verde',
    bio: 'Perfil oficial do Fato Real. Publicamos informação com fonte oficial e data.', cidade: null, uf: null,
    criado_em: '2026-08-01T12:00:00Z',
  },
  {
    id: 'ex-ana', nome: 'Ana Ribeiro (exemplo)', foto_url: null, moderador: false, capa: 'roxo',
    bio: 'Professora de história. Gosto de explicar como funciona o Congresso.', cidade: 'Salvador', uf: 'BA',
    criado_em: '2026-09-12T12:00:00Z',
  },
  {
    id: 'ex-bruno', nome: 'Bruno Tavares (exemplo)', foto_url: null, moderador: false, capa: 'azul',
    bio: 'Estudante de economia. Acompanho as contas públicas e a cota parlamentar.', cidade: 'Belo Horizonte', uf: 'MG',
    criado_em: '2026-10-03T12:00:00Z',
  },
  {
    id: 'ex-carla', nome: 'Carla Nogueira (exemplo)', foto_url: null, moderador: false, capa: 'laranja',
    bio: 'Jornalista em formação, apaixonada por checagem de fatos.', cidade: 'Porto Alegre', uf: 'RS',
    criado_em: '2026-10-20T12:00:00Z',
  },
  {
    id: 'ex-diego', nome: 'Diego Martins (exemplo)', foto_url: null, moderador: false, capa: 'grafite',
    bio: 'Técnico em informática. Quero entender melhor o que acontece na Câmara.', cidade: 'Fortaleza', uf: 'CE',
    criado_em: '2026-10-25T12:00:00Z',
  },
  {
    id: 'ex-fernanda', nome: 'Fernanda Lopes (exemplo)', foto_url: null, moderador: false, capa: 'brasil',
    bio: 'Mãe, enfermeira e curiosa por saúde pública e educação.', cidade: 'Curitiba', uf: 'PR',
    criado_em: '2026-11-02T12:00:00Z',
  },
];

/** Quem segue quem no início da demonstração. */
export const SEGUIR_EXEMPLO: { seguidor: string; seguido: string }[] = [
  { seguidor: 'ex-ana', seguido: 'equipe' },
  { seguidor: 'ex-bruno', seguido: 'equipe' },
  { seguidor: 'ex-carla', seguido: 'equipe' },
  { seguidor: 'ex-carla', seguido: 'ex-ana' },
  { seguidor: 'ex-ana', seguido: 'ex-carla' },
  { seguidor: 'ex-bruno', seguido: 'ex-ana' },
];

/** Publicações das pessoas de exemplo (comunidade pelo slug). */
export const PUBLICACOES_EXEMPLO: { autor: string; comunidade: string; texto: string; link_url: string | null; horas: number }[] = [
  {
    autor: 'ex-ana', comunidade: 'camara-e-senado-em-pauta', horas: 5, link_url: 'https://www.camara.leg.br/',
    texto: 'Dica para quem está começando: nas votações nominais da Câmara, o voto de cada deputado fica registrado e pode ser consultado no site oficial.',
  },
  {
    autor: 'ex-bruno', comunidade: 'contas-publicas', horas: 9, link_url: null,
    texto: 'Vocês sabiam que dá para ver quanto cada deputado gastou da cota parlamentar? Aqui no Fato Real aparece no perfil de cada um, em Candidatos.',
  },
  {
    autor: 'ex-carla', comunidade: 'checagem-de-fatos', horas: 14, link_url: null,
    texto: 'Antes de compartilhar o print de uma notícia, procurem a matéria no site do próprio veículo. Print sem link é o formato preferido de boato.',
  },
];

/** Mensagens dos grupos das comunidades (pelo slug), da mais antiga para a mais nova. */
export const GRUPOS_EXEMPLO: { comunidade: string; autor: string; texto: string; horas: number }[] = [
  { comunidade: 'politica-brasileira', autor: 'ex-diego', horas: 6, texto: 'Alguém sabe onde ver a pauta do plenário da Câmara desta semana?' },
  { comunidade: 'politica-brasileira', autor: 'ex-ana', horas: 5.5, texto: 'Fica na Agenda do site da Câmara, atualizada todo dia. Dá para filtrar por plenário e comissões.' },
  { comunidade: 'politica-brasileira', autor: 'ex-fernanda', horas: 5, texto: 'Valeu! Vou acompanhar pela TV Câmara também.' },
  { comunidade: 'eleicoes-e-voto', autor: 'ex-carla', horas: 9, texto: 'Gente, resultado oficial de eleição é no site do TSE. Não confiem em print de grupo.' },
  { comunidade: 'eleicoes-e-voto', autor: 'ex-bruno', horas: 8, texto: 'E no DivulgaCandContas dá para ver bens e prestação de contas de cada candidatura.' },
  { comunidade: 'checagem-de-fatos', autor: 'ex-fernanda', horas: 4, texto: 'Recebi um áudio dizendo que o título vai ser cancelado se eu não fizer recadastramento até amanhã. É verdade?' },
  { comunidade: 'checagem-de-fatos', autor: 'ex-carla', horas: 3.5, texto: 'Desconfia de prazo urgente em áudio. Confere no site do TSE ou do TRE do seu estado antes de repassar.' },
  { comunidade: 'checagem-de-fatos', autor: 'equipe', horas: 3, texto: 'Boa, Carla! Fernanda, se quiser, envie o áudio na página Verificar Informação.' },
  { comunidade: 'contas-publicas', autor: 'ex-bruno', horas: 12, texto: 'Comparei a cota parlamentar de três deputados do meu estado pelo perfil deles aqui. Dá para ver por categoria.' },
  { comunidade: 'contas-publicas', autor: 'ex-diego', horas: 11, texto: 'Não sabia que dava para ver passagem aérea separada. Muito bom.' },
  { comunidade: 'camara-e-senado-em-pauta', autor: 'ex-ana', horas: 20, texto: 'Dica: na ficha de tramitação de cada projeto aparecem o relator, os pareceres e o andamento.' },
  { comunidade: 'direitos-e-cidadania', autor: 'ex-diego', horas: 30, texto: 'Alguém já usou a Lei de Acesso à Informação para pedir dado da prefeitura?' },
  { comunidade: 'direitos-e-cidadania', autor: 'ex-ana', horas: 29, texto: 'Já! O prazo de resposta é de 20 dias, prorrogável por mais 10.' },
  { comunidade: 'educacao-para-todos', autor: 'ex-fernanda', horas: 7, texto: 'Viram que saíram diretrizes para o uso de IA nas escolas? Tem um resumo na aba Notícias.' },
  { comunidade: 'saude-publica-e-sus', autor: 'ex-fernanda', horas: 26, texto: 'O calendário de vacinação por idade fica no site do Ministério da Saúde. Vale salvar nos favoritos.' },
];

/** Mensagens privadas que pessoas de exemplo mandam para quem usa a demonstração. "eu" = a pessoa logada. */
export const PRIVADAS_EXEMPLO: { de: string; para: string; texto: string; horas: number; lida: boolean }[] = [
  { de: 'ex-ana', para: 'eu', horas: 2, lida: false, texto: 'Oi! Vi que você entrou nas comunidades de política. Se precisar de ajuda para achar alguma votação, é só falar.' },
  { de: 'ex-bruno', para: 'eu', horas: 6, lida: false, texto: 'E aí! Você também acompanha a cota parlamentar? Montei uma planilha com os gastos, posso compartilhar.' },
  { de: 'ex-carla', para: 'eu', horas: 26, lida: true, texto: 'Obrigada por participar! Amanhã vou postar umas dicas de checagem na comunidade Checagem de Fatos.' },
  { de: 'eu', para: 'ex-carla', horas: 25, lida: true, texto: 'Valeu, Carla! Vou acompanhar.' },
];
