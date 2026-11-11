// Deixa o texto em minúsculas e sem acentos, para a busca achar "joao" em "João".
export function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
