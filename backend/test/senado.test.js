// Senadores (correção do relatório da Kelly: a aba Senadores estava vazia).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { senadoresDaLista, idsEmConflito, idsParaRemover, CARGO_SENADOR } from '../src/services/senado.js';

const JSON_SENADO = {
  ListaParlamentarEmExercicio: {
    Parlamentares: {
      Parlamentar: [
        {
          IdentificacaoParlamentar: {
            CodigoParlamentar: '5012',
            NomeParlamentar: 'Senadora Teste (exemplo)',
            NomeCompletoParlamentar: 'Fulana de Tal (exemplo)',
            SiglaPartidoParlamentar: 'ABC',
            UfParlamentar: 'DF',
            UrlFotoParlamentar: 'https://www.senado.leg.br/senadores/img/fotos-oficiais/senador5012.jpg',
            EmailParlamentar: 'teste@senado.leg.br',
            UrlPaginaParlamentar: 'https://www25.senado.leg.br/web/senadores/senador/-/perfil/5012',
          },
        },
        { IdentificacaoParlamentar: { NomeParlamentar: 'Sem código' } },
      ],
    },
  },
};

test('Senado: converte a lista oficial para a tabela politicos', () => {
  const [s, ...resto] = senadoresDaLista(JSON_SENADO, '2026-11-24T00:00:00.000Z');
  assert.equal(resto.length, 0, 'ignora registro sem código');
  assert.equal(s.id, 5012);
  assert.equal(s.cargo, CARGO_SENADOR);
  assert.equal(s.partido, 'ABC');
  assert.equal(s.uf, 'DF');
  assert.match(s.fonte_url, /senado\.leg\.br/);
  assert.equal(s.data_coleta, '2026-11-24T00:00:00.000Z');
});

test('Senado: aceita um único senador (objeto em vez de lista)', () => {
  const um = { ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: JSON_SENADO.ListaParlamentarEmExercicio.Parlamentares.Parlamentar[0] } } };
  assert.equal(senadoresDaLista(um).length, 1);
});

test('Senado: resposta vazia ou estranha → lista vazia (sem quebrar)', () => {
  assert.deepEqual(senadoresDaLista(null), []);
  assert.deepEqual(senadoresDaLista({}), []);
});

test('Senado: detecta id repetido entre deputado e senador', () => {
  assert.deepEqual(idsEmConflito([{ id: 1 }, { id: 5012 }], [{ id: 5012 }, { id: 7 }]), [5012]);
  assert.deepEqual(idsEmConflito([{ id: 1 }], [{ id: 2 }]), []);
});

test('Importação: remove do banco quem saiu da lista oficial', () => {
  assert.deepEqual(idsParaRemover([1, '2', 74383, 74295], [{ id: 1 }, { id: 2 }]), [74383, 74295]);
  assert.deepEqual(idsParaRemover([1, 2], [{ id: 1 }, { id: 2 }, { id: 3 }]), []);
});

test('Senado: foto sempre com https:// (evita "Mixed Content")', () => {
  const json = { ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: [{ IdentificacaoParlamentar: { CodigoParlamentar: '1', NomeParlamentar: 'Teste (exemplo)', UrlFotoParlamentar: 'http://www.senado.leg.br/senadores/img/fotos-oficiais/senador1.jpg' } }] } } };
  assert.equal(senadoresDaLista(json)[0].foto_url, 'https://www.senado.leg.br/senadores/img/fotos-oficiais/senador1.jpg');
});
