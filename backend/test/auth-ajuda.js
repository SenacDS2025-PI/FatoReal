// Apoio dos testes da área de autenticação (não é teste: não termina em .test.js).
// Supabase FALSO, sem internet: imita auth.getUser, from().select().eq() e rpc().
import app from '../src/app.js';
import { _setFabrica } from '../src/auth/supabase-usuario.js';
import { _zerarLimites } from '../src/utils/limite.js';
import { _zerarLimiteConta } from '../src/auth/limite.js';

export const TOKEN_ANA = 'token-ana';
export const TOKEN_MOD = 'token-moderador';

export const USUARIOS = {
  [TOKEN_ANA]: { id: 'u-ana', email: 'ana@exemplo.com' },
  [TOKEN_MOD]: { id: 'u-mod', email: 'mod@exemplo.com' },
};

export const PERFIS = {
  'u-ana': { id: 'u-ana', nome: 'Ana (exemplo)', foto_url: null, bio: 'Oi', cidade: 'Brasília', uf: 'DF', capa: 'verde', is_moderador: false, criado_em: '2026-11-20T10:00:00Z' },
  'u-mod': { id: 'u-mod', nome: 'Mod (exemplo)', foto_url: null, bio: null, cidade: null, uf: null, capa: null, is_moderador: true, criado_em: '2026-11-20T10:00:00Z' },
};

// Totais devolvidos pelas contagens: chave = "tabela" ou "tabela:coluna=valor".
export const CONTAGENS = {
  perfis: 42,
  comunidades: 10,
  'publicacoes:removida=false': 120,
  'publicacoes:removida=true': 3,
  'denuncias:status=aberta': 5,
};

// opcoes: { falhaGetUser, erroGetUser, falhaPerfil, falhaContagem, falhaRpc }
//   falhaGetUser: o getUser LANÇA um erro (ex.: rede caiu)
//   erroGetUser:  o getUser DEVOLVE esse erro, como o supabase-js faz (ex.: { name, status, message })
export function supabaseFalso(opcoes = {}) {
  const registro = { tokens: [], rpc: [], consultas: [] };
  _setFabrica((token) => {
    registro.tokens.push(token);
    return {
      auth: {
        getUser: async (t) => {
          if (opcoes.falhaGetUser) throw new Error('rede caiu');
          if (opcoes.erroGetUser) return { data: { user: null }, error: opcoes.erroGetUser };
          const user = USUARIOS[t];
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'JWT inválido' } };
        },
      },
      from(tabela) {
        const filtros = [];
        const consulta = {
          select(colunas, opcoesSelect) {
            consulta.colunas = colunas;
            consulta.contar = Boolean(opcoesSelect?.count);
            return consulta;
          },
          eq(coluna, valor) {
            filtros.push(`${coluna}=${valor}`);
            return consulta;
          },
          async maybeSingle() {
            registro.consultas.push({ tabela, colunas: consulta.colunas, filtros: [...filtros] });
            if (opcoes.falhaPerfil) return { data: null, error: { message: 'erro no banco' } };
            const id = filtros.find((f) => f.startsWith('id='))?.slice(3);
            return { data: tabela === 'perfis' ? PERFIS[id] ?? null : null, error: null };
          },
          // Contagem: o código faz "await" direto no select(...).eq(...).
          then(resolver, rejeitar) {
            const chave = [tabela, ...filtros].join(':');
            registro.consultas.push({ tabela, filtros: [...filtros], contar: consulta.contar });
            const erro = opcoes.falhaContagem === chave ? { message: 'erro na contagem' } : null;
            return Promise.resolve({ count: erro ? null : CONTAGENS[chave] ?? 0, error: erro }).then(resolver, rejeitar);
          },
        };
        return consulta;
      },
      async rpc(nome) {
        registro.rpc.push({ nome, token });
        return { data: null, error: opcoes.falhaRpc ? { message: 'erro no rpc' } : null };
      },
    };
  });
  return registro;
}

export async function iniciar() {
  _zerarLimites();
  _zerarLimiteConta();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://localhost:${server.address().port}`;
  return {
    base,
    async encerrar() {
      _setFabrica(undefined);
      await new Promise((r) => server.close(r));
    },
  };
}

export async function pedir(base, caminho, { token, metodo = 'GET', cabecalho, ip } = {}) {
  const headers = {};
  if (ip) headers['X-Forwarded-For'] = ip;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cabecalho) headers.Authorization = cabecalho;
  const res = await fetch(`${base}${caminho}`, { method: metodo, headers });
  const texto = await res.text();
  return { status: res.status, body: texto ? JSON.parse(texto) : null, texto, headers: res.headers };
}
