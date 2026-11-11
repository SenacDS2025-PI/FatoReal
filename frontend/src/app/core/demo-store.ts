// Armazenamento do MODO DEMONSTRAÇÃO: guarda os dados no localStorage do navegador.
// Serve para o front funcionar antes do Supabase estar pronto. Nada disso vai para servidor.

const PREFIXO = 'fatoreal-demo:';

export function lerDemo<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function salvarDemo<T>(chave: string, valor: T): void {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch {
    /* navegador sem localStorage: segue só em memória */
  }
}

export function proximoId(lista: { id: number }[]): number {
  return lista.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}
