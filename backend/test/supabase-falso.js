// Supabase falso (sem internet) para os testes: imita a tabela `politicos` com
// .from().select(colunas, { count }) → .eq() → .order() / .maybeSingle() / await (contagem).
export function clienteFalso(linhas, erro = null) {
  const consulta = (filtradas) => ({
    eq: (col, valor) => consulta(filtradas.filter((l) => String(l[col]) === String(valor))),
    in: (col, valores) => consulta(filtradas.filter((l) => valores.map(String).includes(String(l[col])))),
    limit: () => consulta(filtradas),
    order: () => consulta(filtradas),
    maybeSingle: async () => ({ data: erro ? null : filtradas[0] ?? null, error: erro }),
    then: (ok, falha) =>
      Promise.resolve({ data: erro ? null : filtradas, count: erro ? null : filtradas.length, error: erro }).then(ok, falha),
  });
  return { from: () => ({ select: () => consulta(linhas) }) };
}
