// Conexão com a IA (Claude, da Anthropic).
//
// A chave fica SÓ no servidor, na variável ANTHROPIC_API_KEY (veja .env.example).
// Sem chave, a IA fica desligada e o FatoBot responde no modo "somente fontes".
//
// A IA nunca recebe a internet nem inventa fontes: ela recebe só as evidências que o
// backend encontrou e devolve um JSON com o formato fixo (structured outputs).
import Anthropic from '@anthropic-ai/sdk';

const MODELO_PADRAO = 'claude-opus-5-5';

let cliente; // undefined = ainda não criado; null = IA desligada

function chave() {
  // AI_API_KEY é aceito por compatibilidade com o .env antigo do projeto.
  return process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '';
}

function obterCliente() {
  if (cliente === undefined) {
    cliente = chave() ? new Anthropic({ apiKey: chave(), timeout: 60_000, maxRetries: 2 }) : null;
  }
  return cliente;
}

export function iaLigada() {
  return obterCliente() !== null;
}

// Só para os testes: troca o cliente por um falso (ou null para desligar a IA).
export function definirClienteIA(novo) {
  cliente = novo;
}

/**
 * Pede à IA uma resposta em JSON que siga o `schema`.
 * Devolve o objeto, ou null se a IA estiver desligada, recusar ou falhar
 * (quem chama deve cair no modo "somente fontes").
 */
export async function gerarJson({ instrucoes, mensagem, schema, maxTokens = 4000 }) {
  const ia = obterCliente();
  if (!ia) return null;

  try {
    const resposta = await ia.beta.messages.create({
      model: process.env.AI_MODEL || MODELO_PADRAO,
      max_tokens: maxTokens,
      // Se o modelo principal recusar por política de segurança, a Anthropic tenta de novo
      // automaticamente com o modelo reserva recomendado para aquele caso.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // As instruções e a base de conhecimento não mudam entre perguntas: ficam em cache.
      system: [{ type: 'text', text: instrucoes, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: mensagem }],
      output_config: {
        effort: process.env.AI_EFFORT || 'low',
        format: { type: 'json_schema', schema },
      },
    });

    if (resposta.stop_reason === 'refusal') {
      console.warn('[ia] pedido recusado:', resposta.stop_details?.category ?? 'sem categoria');
      return null;
    }
    if (resposta.stop_reason === 'max_tokens') {
      console.warn('[ia] resposta cortada por max_tokens');
      return null;
    }

    const texto = resposta.content.find((b) => b.type === 'text')?.text;
    return texto ? JSON.parse(texto) : null;
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[ia] chave ANTHROPIC_API_KEY inválida');
    } else if (err instanceof Anthropic.RateLimitError) {
      console.warn('[ia] limite de uso da API atingido');
    } else if (err instanceof Anthropic.APIError) {
      console.error(`[ia] erro da API (${err.status}):`, err.message);
    } else if (err instanceof SyntaxError) {
      console.error('[ia] resposta não veio em JSON válido');
    } else {
      console.error('[ia] falha inesperada:', err);
    }
    return null;
  }
}
