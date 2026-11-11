import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

/**
 * Cliente do Supabase. Fica null quando SUPABASE_URL não foi configurada:
 * nesse caso o site roda em MODO DEMONSTRAÇÃO, com dados salvos só no navegador.
 */
export const supabase: SupabaseClient | null =
  environment.supabaseUrl && environment.supabaseAnonKey
    ? createClient(environment.supabaseUrl, environment.supabaseAnonKey)
    : null;

export const modoDemo = supabase === null;

export const apiUrl = environment.apiUrl.replace(/\/$/, '');
