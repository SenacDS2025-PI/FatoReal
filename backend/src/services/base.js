// J11 — busca na base de conhecimento da Constituição (src/data/base-conhecimento.js).
//
// Busca simples por palavras-chave, que funciona até sem IA. Cada fato encontrado vira uma
// evidência com a fonte (Constituição Federal de 1988 + artigo) para o FatoBot citar.
import { BASE, CONSTITUICAO } from '../data/base-conhecimento.js';
import { normalizar } from '../utils/texto.js';

const MAX_ITENS = 3;
const limpar = (t) => ` ${normalizar(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Pré-processa as palavras-chave uma vez só.
const INDICE = BASE.map((item) => ({ item, palavras: item.palavras.map((p) => limpar(p)) }));

// Itens mais relacionados ao texto (mais palavras-chave em comum primeiro).
export function buscarNaBase(texto) {
  const alvo = limpar(texto);
  return INDICE.map(({ item, palavras }) => ({ item, pontos: palavras.filter((p) => alvo.includes(p)).length }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos || a.item.id.localeCompare(b.item.id))
    .slice(0, MAX_ITENS)
    .map((r) => r.item);
}

// Evidências no mesmo formato das da Câmara. Sem data de consulta: é o texto da Constituição.
export function evidenciasDaBase(itens) {
  return itens.map((item) => ({
    // Sem repetir o título quando o texto já começa com ele.
    texto: item.texto.startsWith(item.titulo) ? item.texto : `${item.titulo}: ${item.texto}`,
    fonte: `${CONSTITUICAO.nome}, ${item.artigo}`,
    url: CONSTITUICAO.url,
    consultadoEm: null,
  }));
}

// Fontes no formato do front (titulo, url, data).
export function fontesDaBase(itens) {
  return itens.map((item) => ({
    titulo: `${CONSTITUICAO.nome}, ${item.artigo} (${item.titulo})`,
    url: CONSTITUICAO.url,
    data: null,
  }));
}
