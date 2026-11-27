// Log do Fato ou Fake (POST /api/verificar) no console do servidor, para saber o que acontece
// em cada verificação: o que chegou, quais fontes foram achadas, o que a IA respondeu e o resultado.
// Na Vercel aparece em Deployments → Logs (ou Observability → Logs).
//
// LGPD: NÃO registra o texto inteiro da afirmação, só o tamanho e o começo (com números longos
// escondidos, para não vazar CPF ou telefone). Do link, só o site (domínio). Nada de IP.
// Para desligar: LOG_VERIFICAR=0 no .env.
import { randomBytes } from 'node:crypto';

const ligado = () => process.env.LOG_VERIFICAR !== '0';

// "CPF 123.456.789-00, tel (61) 9999-8888" → números com pontos, traços, barras e espaços escondidos (até 60 letras)
export function previa(texto, max = 60) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').replace(/\d[\d.\-\/ ]{6,}\d/g, (m) => '•'.repeat(m.length));
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function dominio(link) {
  try {
    return new URL(link).hostname;
  } catch {
    return 'inválido';
  }
}

// Cria um log com um código curto por pedido, para seguir as linhas de uma mesma verificação.
export function criarLogVerificar() {
  const id = randomBytes(3).toString('hex');
  const inicio = Date.now();
  const escrever = (nivel, etapa, dados) => {
    if (!ligado()) return;
    const tempo = `${Date.now() - inicio}ms`;
    console[nivel](`[verificar ${id}] ${etapa} (${tempo})`, dados && Object.keys(dados).length ? JSON.stringify(dados) : '');
  };
  return {
    id,
    info: (etapa, dados) => escrever('info', etapa, dados),
    aviso: (etapa, dados) => escrever('warn', etapa, dados),
    erro: (etapa, dados) => escrever('error', etapa, dados),
  };
}

// Log que não escreve nada (padrão quando quem chama não passa um log).
export const SEM_LOG = { id: '-', info() {}, aviso() {}, erro() {} };
