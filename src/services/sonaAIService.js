/**
 * sonaAIService.js — AI assistant integration.
 *
 * Priority order:
 *   1. Groq (free, fast) — set VITE_GROQ_API_KEY in .env
 *      Model: llama-3.3-70b-versatile (current Groq production model, ~280 t/s)
 *      Sign up: https://console.groq.com
 *      NOTE: the key is bundled into the browser build (VITE_ prefix).
 *      Fine for dev/personal use; add a backend proxy for production.
 *   2. Custom backend — set VITE_SONA_API_URL to proxy through your server
 *   3. Local intent parser — no key needed, parses simple commands offline
 *
 * SAFETY BOUNDARY: the AI never receives private keys, seed phrases, or
 * PINs, and never executes transactions directly.
 */
import { getAssetBySymbol } from '../constants/assets.js';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY;
const AI_URL   = import.meta.env.VITE_SONA_API_URL;

const GROQ_SYSTEM = `You are Sona AI, the intelligent assistant inside the Sona trading platform.
You help users understand markets, manage their portfolio of stocks and crypto, and make trading decisions.
You can suggest trades, explain price movements, and analyze holdings.
Keep responses concise and actionable. When suggesting a trade, format it so the UI can parse it.
Never ask for or mention private keys, seed phrases, or PINs.
Assets on the platform: AAPL, MSFT, NVDA, AMZN, TSLA, GOOGL, META, NFLX, COIN (stocks) and SOL, BTC, ETH, BNB, USDC (crypto).`;

// Models tried in order — first success wins. Groq rotates/deprecates models;
// this list covers the current active free-tier models.
const GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'groq/compound',
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

let cachedActiveModels = null;

async function getAvailableGroqModels() {
  if (cachedActiveModels && cachedActiveModels.length > 0) {
    return cachedActiveModels;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
    });
    if (!res.ok) return GROQ_MODELS;
    const data = await res.json();
    const dynamicModels = (data.data || [])
      .filter((m) => m.active !== false && !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('orpheus'))
      .map((m) => m.id);
    
    // Combine discovered models with priority fallbacks without duplicates
    const combined = Array.from(new Set([...GROQ_MODELS, ...dynamicModels]));
    cachedActiveModels = combined;
    return combined;
  } catch (e) {
    return GROQ_MODELS;
  }
}

async function callGroqModel(model, messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages:    [{ role: 'system', content: GROQ_SYSTEM }, ...messages],
      max_tokens:  512,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq ${res.status}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGroq(messages) {
  let lastErr;
  const modelsToTry = await getAvailableGroqModels();
  for (const model of modelsToTry) {
    try {
      const reply = await callGroqModel(model, messages);
      return reply;
    } catch (e) {
      lastErr = e;
      // Only retry if it's a model-not-found / decommissioned error; bail on auth errors
      const msg = e.message || '';
      if (msg.includes('401') || msg.includes('Invalid API Key') || msg.includes('invalid_api_key')) {
        throw e;
      }
    }
  }
  throw lastErr;
}

async function callBackend(path, body) {
  const res = await fetch(`${AI_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI API error ${res.status}`);
  return res.json();
}

// ── Local intent parser (runs when no AI API is configured) ──────────────────

function parseLocalIntent(text) {
  const t = text.toLowerCase();

  const buyMatch = text.match(/buy\s+\$?(\d+(?:\.\d+)?)\s+(?:of\s+)?([a-zA-Z]{2,6})/i);
  if (buyMatch) {
    const amount = Number(buyMatch[1]);
    const symbol = buyMatch[2].toUpperCase();
    const asset  = getAssetBySymbol(symbol);
    if (asset) {
      return {
        reply: `I've prepared a proposal to buy $${amount} of ${asset.name} (${asset.symbol}). Review the details below before confirming.`,
        actionProposal: { type: 'BUY_ASSET', asset: asset.symbol, amountUsd: amount },
      };
    }
  }

  const sendMatch = text.match(/send\s+(\d+(?:\.\d+)?)\s+([a-zA-Z]{2,6})\s+to\s+(\S+)/i);
  if (sendMatch) {
    const amount    = Number(sendMatch[1]);
    const symbol    = sendMatch[2].toUpperCase();
    const recipient = sendMatch[3];
    const asset     = getAssetBySymbol(symbol);
    if (asset) {
      return {
        reply: `I've prepared a proposal to send ${amount} ${asset.symbol} to ${recipient}. Nothing is sent until you confirm.`,
        actionProposal: { type: 'SEND_ASSET', asset: asset.symbol, amount, recipient },
      };
    }
  }

  if (t.includes('portfolio') || t.includes('balance')) {
    return {
      reply: 'Open the Portfolio tab to see your current holdings and P&L. Connect the Sona AI API for AI-driven portfolio analysis.',
      actionProposal: null,
    };
  }

  return {
    reply: GROQ_KEY
      ? 'Groq key found but the request failed — check the browser console for details.'
      : 'Groq AI is not connected. Add VITE_GROQ_API_KEY to your .env file (free at console.groq.com), then restart the dev server with npm run dev.',
    actionProposal: null,
  };
}

// ── In-memory conversation store (per browser session) ───────────────────────

const conversations = new Map();

function getHistory(conversationId) {
  return conversations.get(conversationId) || [];
}

function appendToHistory(conversationId, message) {
  const history = getHistory(conversationId);
  history.push(message);
  conversations.set(conversationId, history.slice(-200));
  return message;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function sendMessage({ conversationId, text, context }) {
  const userMessage = appendToHistory(conversationId, {
    id:             `msg-${Date.now()}-u`,
    conversationId,
    role:           'user',
    text,
    context:        context || null,
    timestamp:      new Date().toISOString(),
  });

  // 1. Try Groq (free, fast)
  if (GROQ_KEY) {
    try {
      const history  = getHistory(conversationId);
      const messages = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)  // last 5 exchanges for context
        .map((m) => ({ role: m.role, content: m.text }));

      const reply = await callGroq(messages);
      const assistantMessage = appendToHistory(conversationId, {
        id:             `msg-${Date.now()}-a`,
        conversationId,
        role:           'assistant',
        text:           reply,
        actionProposal: null,
        timestamp:      new Date().toISOString(),
      });
      return { message: assistantMessage, userMessage };
    } catch (e) {
      console.error('[SonaAI] Groq error:', e.message);
    }
  }

  // 2. Try custom backend
  if (AI_URL) {
    try {
      const response = await callBackend('/messages', { conversationId, text, context });
      appendToHistory(conversationId, response.message);
      return response;
    } catch (e) {
      console.error('[SonaAI] Backend error:', e);
    }
  }

  // 3. Local fallback
  await new Promise((r) => setTimeout(r, 300));
  const { reply, actionProposal } = parseLocalIntent(text);
  const assistantMessage = appendToHistory(conversationId, {
    id:             `msg-${Date.now()}-a`,
    conversationId,
    role:           'assistant',
    text:           reply,
    actionProposal,
    timestamp:      new Date().toISOString(),
  });
  return { message: assistantMessage, userMessage };
}

export async function analyzeAsset(symbol) {
  if (GROQ_KEY) {
    try {
      const asset = getAssetBySymbol(symbol);
      const reply = await callGroq([
        { role: 'user', content: `Give a concise market and investment analysis of ${asset?.name || symbol} (${symbol}). Keep it under 3 sentences.` },
      ]);
      return { symbol, summary: reply };
    } catch (e) {
      console.error('[SonaAI] analyzeAsset error:', e);
    }
  }
  if (AI_URL) return callBackend('/analyze/asset', { symbol });
  const asset = getAssetBySymbol(symbol);
  return {
    symbol,
    summary: asset
      ? `${asset.name} (${asset.symbol}) is currently available for trading on Sona.`
      : `Unknown asset: ${symbol}`,
  };
}

export async function analyzePortfolio(portfolioContext) {
  if (GROQ_KEY) {
    try {
      const reply = await callGroq([
        { role: 'user', content: `Analyze this user portfolio context: ${JSON.stringify(portfolioContext)}. Provide concise actionable insights in 2-3 sentences.` },
      ]);
      return { summary: reply };
    } catch (e) {
      console.error('[SonaAI] analyzePortfolio error:', e);
    }
  }
  if (AI_URL) return callBackend('/analyze/portfolio', portfolioContext);
  return { summary: 'Portfolio is well-balanced across current positions.' };
}

export async function explainTransaction(transaction) {
  if (GROQ_KEY) {
    try {
      const reply = await callGroq([
        { role: 'user', content: `Explain this transaction simply: ${JSON.stringify(transaction)}. Keep it to 1-2 sentences.` },
      ]);
      return { explanation: reply };
    } catch (e) {
      console.error('[SonaAI] explainTransaction error:', e);
    }
  }
  if (AI_URL) return callBackend('/explain/transaction', transaction);
  return {
    explanation: `This was a ${transaction?.type || 'transaction'} of ${transaction?.symbol || 'an asset'}.`,
  };
}

export async function getConversationHistory(conversationId) {
  return getHistory(conversationId);
}

export async function clearConversation(conversationId) {
  conversations.delete(conversationId);
  return { success: true };
}

export function createActionProposal(type, payload) {
  return { type, ...payload, createdAt: new Date().toISOString() };
}
