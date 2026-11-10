// Gera src/environments/environment.ts a partir das variáveis de ambiente.
// Roda sozinho antes de "npm start" e "npm run build" (veja package.json).
// Localmente: crie um arquivo .env (copie de .env.exemplo). Na Vercel: Settings → Environment Variables.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const vars = { ...process.env };
if (existsSync('.env')) {
  for (const linha of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && vars[m[1]] === undefined) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = {
  supabaseUrl: vars.SUPABASE_URL ?? '',
  supabaseAnonKey: vars.SUPABASE_ANON_KEY ?? '',
  apiUrl: vars.API_URL ?? '/api',
  // true = rotas com # (para hospedagem sem servidor, como o link de teste do claude.ai)
  roteamentoHash: vars.HASH_ROUTING === 'true',
};

mkdirSync('src/environments', { recursive: true });
writeFileSync(
  'src/environments/environment.ts',
  `// ARQUIVO GERADO por scripts/gerar-env.mjs. Não edite e não suba para o Git.\nexport const environment = ${JSON.stringify(env, null, 2)};\n`,
);
console.log(
  env.supabaseUrl
    ? '[env] Supabase configurado.'
    : '[env] Sem SUPABASE_URL: o site vai rodar em MODO DEMONSTRAÇÃO (dados locais).',
);
