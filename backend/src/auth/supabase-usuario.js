// G2 — Supabase "como o usuário".
//
// Cria um cliente com a chave PÚBLICA (SUPABASE_ANON_KEY) e o token de quem fez o pedido.
// Assim o banco enxerga o pedido como se fosse a própria pessoa, e as regras de segurança
// (RLS) do supabase/schema.sql valem: cada um só lê e altera o que tem permissão.
//
// NUNCA usar a service_role aqui: ela ignora o RLS e daria acesso a tudo.
import { createClient } from '@supabase/supabase-js';

let fabricaDeTeste;

// true quando a API tem SUPABASE_URL e SUPABASE_ANON_KEY (ou nos testes).
export function authConfigurado() {
  return Boolean(fabricaDeTeste) || Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

// Um cliente novo por pedido: o token de uma pessoa nunca fica guardado para outra.
export function clienteDoUsuario(token) {
  if (fabricaDeTeste) return fabricaDeTeste(token);
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// Só para os testes trocarem o Supabase por um falso (recebe o token, devolve o cliente).
export function _setFabrica(fabrica) {
  fabricaDeTeste = fabrica;
}
