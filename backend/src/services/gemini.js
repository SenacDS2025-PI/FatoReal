// Conexão com a IA do FatoBot: Gemini (Google).
//
// A chave fica SÓ no servidor, na variável de ambiente GEMINI_API_KEY.
// Sem chave, gerarJson() devolve null e o FatoBot continua no modo "somente_fontes".
//
// A IA não acessa a internet nem escreve links: ela recebe só as evidências que o backend
// encontrou e devolve um JSON com formato fixo (responseJsonSchema), citando as evidências
// pelo código. Quem monta as referências é o backend.
import { GoogleGenAI, ApiError } from '@google/genai';

export const MODELO_PADRAO = 'gemini-3.8-flash';
const TIMEOUT_MS = 20_000; // se o Gemini não responder em 20s, o FatoBot responde sem IA
// Uma nova tentativa quando o Gemini está sobrecarregado (503) ou no limite (429).
const RETRY = { attempts: 2, initialDelay: 1, maxDelay: 2, httpStatusCodes: [429, 500, 503] };

let client;
function getClient() {
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

// Só para os testes trocarem o cliente por um falso (undefined volta ao normal).
export function _setClient(fake) {
  client = fake;
}

export function iaConfigurada() {
  return Boolean(process.env.GEMINI_API_KEY) || Boolean(client);
}

/**
 * Pede ao Gemini uma resposta em JSON que siga o `schema` (JSON Schema).
 * Devolve o objeto, ou null quando: não há chave; o Gemini bloqueou a pergunta ou cortou a
 * resposta; o JSON veio inválido; ou houve erro/timeout na API.
 * Quem chama deve cair no modo "somente_fontes".
 */
export async function gerarJson({ instrucoes, mensagem, schema }) {
  if (!iaConfigurada()) return null;

  const modelo = process.env.GEMINI_MODEL || MODELO_PADRAO;

  try {
    const response = await getClient().models.generateContent({
      model: modelo,
      contents: mensagem,
      config: {
        systemInstruction: instrucoes,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        temperature: 0.2, // respostas estáveis e fiéis às evidências
        httpOptions: { timeout: TIMEOUT_MS, retryOptions: RETRY },
      },
    });

    if (response.promptFeedback?.blockReason) {
      console.warn('[gemini] pergunta bloqueada:', response.promptFeedback.blockReason);
      return null;
    }
    const fim = response.candidates?.[0]?.finishReason;
    if (fim && fim !== 'STOP') {
      console.warn('[gemini] resposta interrompida:', fim);
      return null;
    }

    const texto = (response.text ?? '').trim();
    return texto ? JSON.parse(texto) : null;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 400 || err.status === 403) {
        console.error(`[gemini] GEMINI_API_KEY ou GEMINI_MODEL inválido (erro ${err.status})`);
      } else if (err.status === 429) {
        console.error('[gemini] limite de uso da API atingido');
      } else if (err.status === 503) {
        console.error('[gemini] sobrecarregado (503). Tente de novo ou troque GEMINI_MODEL.');
      } else {
        console.error(`[gemini] erro ${err.status} na API`);
      }
    } else if (err instanceof SyntaxError) {
      console.error('[gemini] resposta não veio em JSON válido');
    } else {
      console.error('[gemini] falha ao chamar a API:', err.message);
    }
    return null;
  }
}
