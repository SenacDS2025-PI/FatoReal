// Acha na pergunta os políticos citados, para o FatoBot e o Fato ou Fake.
//
// citadosNaPergunta: só pelo NOME COMPLETO (nome parlamentar ou de urna), ex.: "Quem é Tabata Amaral?".
//   Precisa ter duas palavras ou mais. Isso vira evidência.
// sugestoesDeNome: pelo SOBRENOME (ex.: "quem é o bolsonaro?") ou por nome de uma palavra só
//   (ex.: "Lula"). NÃO vira evidência (pode ser outra pessoa com o mesmo nome): o FatoBot só
//   pergunta "Você quis dizer...?".
import { normalizar } from './texto.js';

const limpar = (t) => ` ${normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;
// Nome sem o que está entre parênteses, ex.: "Fulano (exemplo)" → "fulano".
const limparNome = (t) => limpar(String(t ?? '').replace(/\([^)]*\)/g, ' '));

// Palavras comuns que não podem ser tratadas como nome de político.
const COMUNS = new Set([
  'brasil', 'senado', 'camara', 'governo', 'presidente', 'prefeito', 'prefeita', 'deputado', 'deputada',
  'senador', 'senadora', 'governador', 'governadora', 'vereador', 'vereadora', 'federal', 'estadual',
  'partido', 'eleicao', 'eleito', 'eleita', 'quem', 'sobre', 'pastor', 'delegado', 'coronel', 'doutor',
]);

export function citadosNaPergunta(pergunta, lista, max = 3) {
  const alvo = limpar(pergunta);
  const comNome = lista.map((p) => ({ p, nome: limparNome(p.nome).trim() })).filter((x) => x.nome);

  const porNome = comNome.filter(({ nome }) => nome.includes(' ') && alvo.includes(` ${nome} `));
  return porNome.slice(0, max).map((x) => x.p);
}

const MAX_SUGESTOES = 5;
export function sugestoesDeNome(pergunta, lista) {
  const alvo = limpar(pergunta);
  const palavras = new Set(alvo.trim().split(' ').filter((w) => w.length >= 5 && !COMUNS.has(w)));
  const achados = lista.filter((p) => {
    const partes = limparNome(p.nome).trim().split(' ');
    if (partes.length === 1) return partes[0].length >= 4 && !COMUNS.has(partes[0]) && alvo.includes(` ${partes[0]} `);
    return palavras.has(partes[partes.length - 1]);
  });
  // Sobrenome muito comum (ex.: "Silva") não ajuda: não sugere ninguém.
  return achados.length <= MAX_SUGESTOES ? achados : [];
}
