// Senadores em exercício (API de Dados Abertos do Senado), no formato da tabela `politicos`.
// Mesmo formato que o front já usa (frontend/src/app/core/politicos.service.ts → senadoresSenado):
// id = CodigoParlamentar do Senado e cargo = 'Senador(a)'.
export const SENADO_LISTA = 'https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json';
export const CARGO_SENADOR = 'Senador(a)';
export const CARGO_DEPUTADO = 'Deputado(a) Federal';

const perfilSenado = (codigo) => `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${codigo}`;

// Recebe o JSON da lista atual do Senado e devolve as linhas para gravar no Supabase.
// Não guarda nada além do que o Senado publica para o mandato (LGPD).
export function senadoresDaLista(json, agora = new Date().toISOString()) {
  const brutos = json?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar ?? [];
  return (Array.isArray(brutos) ? brutos : [brutos])
    .map((p) => p?.IdentificacaoParlamentar)
    .filter((i) => i?.CodigoParlamentar && i?.NomeParlamentar)
    .map((i) => ({
      id: Number(i.CodigoParlamentar),
      nome: i.NomeParlamentar,
      nome_civil: i.NomeCompletoParlamentar ?? null,
      partido: i.SiglaPartidoParlamentar ?? null,
      uf: i.UfParlamentar ?? null,
      cargo: CARGO_SENADOR,
      foto_url: i.UrlFotoParlamentar ?? null,
      email: i.EmailParlamentar ?? null,
      situacao: 'Exercício',
      fonte_url: i.UrlPaginaParlamentar || perfilSenado(i.CodigoParlamentar),
      data_coleta: agora,
      atualizado_em: agora,
    }));
}

// A tabela `politicos` usa o id como chave: um senador não pode ter o mesmo id de um deputado.
export function idsEmConflito(deputados, senadores) {
  const ids = new Set(deputados.map((d) => Number(d.id)));
  return senadores.filter((s) => ids.has(Number(s.id))).map((s) => s.id);
}

// Quem está no banco com esse cargo, mas saiu da lista oficial atual (ex.: deputado que deixou
// o mandato). Esses precisam sair da tabela, senão continuam aparecendo como se estivessem no cargo.
export function idsParaRemover(idsNoBanco, linhasAtuais) {
  const atuais = new Set(linhasAtuais.map((l) => Number(l.id)));
  return idsNoBanco.map(Number).filter((id) => !atuais.has(id));
}

export const FONTE_SENADO_NOME = 'Senado Federal — Dados Abertos';

// Lista atual direto da API do Senado (reserva quando o Supabase não tem senadores).
export async function buscarSenadoresDaApi(ms = 4_000) {
  const res = await fetch(SENADO_LISTA, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`Senado respondeu ${res.status}`);
  const lista = senadoresDaLista(await res.json());
  if (!lista.length) throw new Error('O Senado devolveu a lista vazia');
  return lista;
}
