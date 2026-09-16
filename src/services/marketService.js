/**
 * marketService.js — live market data.
 *
 * Quotes  (stocks)  → Finnhub /quote           (free, 60 req/min, VITE_FINNHUB_API_KEY)
 * History (stocks)  → Finnhub /stock/candle     (free tier, CORS-safe, replaces Yahoo)
 * Quotes  (crypto)  → CoinGecko /simple/price   (free, no key)
 * History (crypto)  → CoinGecko /market_chart   (free, no key)
 *
 * Caching: in-memory + localStorage (stale-while-revalidate)
 * Quote TTL: 2 min · History TTL: 30 min
 */
import { ALL_ASSETS, getAssetBySymbol, ASSET_TYPES } from '../constants/assets.js';

const FINNHUB_KEY    = import.meta.env.VITE_FINNHUB_API_KEY;
const FINNHUB_BASE   = 'https://finnhub.io/api/v1';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const COINGECKO_ID = {
  SOL:  'solana',
  BTC:  'bitcoin',
  ETH:  'ethereum',
  BNB:  'binancecoin',
  USDC: 'usd-coin',
};

// ── Cache ──────────────────────────────────────────────────────────────────────
const QUOTE_TTL   = 120_000;      // 2 min
const HISTORY_TTL = 1_800_000;    // 30 min
const mem = new Map();
const LS  = 'sona_mkt_';

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS + key);
    if (!raw) return null;
    return JSON.parse(raw); // { data, ts }
  } catch { return null; }
}
function lsSet(key, data) {
  try { localStorage.setItem(LS + key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

/**
 * Stale-while-revalidate cache:
 * 1. Fresh in-memory → return immediately.
 * 2. Fresh localStorage → hydrate memory, return immediately.
 * 3. Stale localStorage → return stale data NOW, revalidate in background.
 * 4. No cache → wait for fetch.
 */
function cached(key, ttl, fn) {
  const now = Date.now();

  const m = mem.get(key);
  if (m && now - m.ts < ttl) return Promise.resolve(m.data);

  const ls = lsGet(key);
  const lsFresh = ls && now - ls.ts < ttl;

  if (lsFresh) {
    mem.set(key, ls);
    return Promise.resolve(ls.data);
  }

  const req = fn().then((data) => {
    const entry = { data, ts: Date.now() };
    mem.set(key, entry);
    lsSet(key, data);
    return data;
  });

  // Stale: return old data immediately, refresh silently in background
  if (ls) {
    mem.set(key, ls);
    req.catch(() => {});
    return Promise.resolve(ls.data);
  }

  return req;
}

// ── Finnhub — quotes ───────────────────────────────────────────────────────────
async function finnhubQuote(symbol) {
  if (!FINNHUB_KEY) throw new Error('VITE_FINNHUB_API_KEY is not set.');
  const res = await fetch(`${FINNHUB_BASE}/quote?symbol=${symbol}&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error(`Finnhub ${res.status}`);
  const d = await res.json();
  if (!d.c) throw new Error(`No quote data for ${symbol}`);
  return {
    symbol,
    price:         d.c,
    previousClose: d.pc,
    change:        d.d,
    changePercent: d.dp,
    high:          d.h,
    low:           d.l,
    open:          d.o,
    isLive:        true,
    source:        'Finnhub',
    asOf:          new Date().toISOString(),
  };
}

// ── Finnhub — stock candles (replaces Yahoo Finance, no CORS issues) ───────────
const FINNHUB_RES = {
  '1D': { resolution: '5',  days: 1   },
  '1W': { resolution: '60', days: 7   },
  '1M': { resolution: 'D',  days: 30  },
  '3M': { resolution: 'D',  days: 90  },
  '1Y': { resolution: 'W',  days: 365 },
  '5Y': { resolution: 'M',  days: 1825 },
};

async function finnhubHistory(symbol, timeframe) {
  if (!FINNHUB_KEY) throw new Error('VITE_FINNHUB_API_KEY is not set.');
  const { resolution, days } = FINNHUB_RES[timeframe] || FINNHUB_RES['1M'];
  const to   = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;
  const res  = await fetch(
    `${FINNHUB_BASE}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${FINNHUB_KEY}`
  );
  if (!res.ok) throw new Error(`Finnhub candle ${res.status}`);
  const d = await res.json();
  if (d.s !== 'ok' || !d.t?.length) throw new Error(`No candle data for ${symbol}`);
  const series = d.t
    .map((t, i) => ({ t, price: d.c[i] }))
    .filter((p) => p.price != null);
  if (series.length === 0) throw new Error(`Empty series for ${symbol}`);
  return { symbol, timeframe, isLive: true, source: 'Finnhub', series };
}

// ── CoinGecko ─────────────────────────────────────────────────────────────────
async function coingecko(path) {
  const res = await fetch(`${COINGECKO_BASE}${path}`);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json();
}

async function fetchCryptoQuotes(symbols) {
  const ids  = symbols.map((s) => COINGECKO_ID[s]).filter(Boolean).join(',');
  const data = await coingecko(
    `/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`
  );
  return symbols.map((symbol) => {
    const id = COINGECKO_ID[symbol];
    const d  = data[id];
    if (!d) throw new Error(`No CoinGecko data for ${symbol}`);
    return {
      symbol,
      price:         d.usd,
      previousClose: d.usd / (1 + (d.usd_24h_change || 0) / 100),
      change:        d.usd * ((d.usd_24h_change || 0) / 100),
      changePercent: d.usd_24h_change || 0,
      isLive:        true,
      source:        'CoinGecko',
      asOf:          new Date(d.last_updated_at * 1000).toISOString(),
    };
  });
}

async function fetchCryptoHistory(symbol, timeframe) {
  const id   = COINGECKO_ID[symbol];
  const days = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365, '5Y': 1825 }[timeframe] || 30;
  const data = await coingecko(`/coins/${id}/market_chart?vs_currency=usd&days=${days}`);
  return {
    symbol, timeframe, isLive: true, source: 'CoinGecko',
    series: data.prices.map(([t, price]) => ({ t: Math.floor(t / 1000), price })),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getAssetPrice(symbol) {
  const meta = getAssetBySymbol(symbol);
  if (!meta) throw new Error(`Unknown asset: ${symbol}`);
  return cached(`quote:${symbol}`, QUOTE_TTL, () =>
    meta.type === ASSET_TYPES.TOKEN
      ? fetchCryptoQuotes([symbol]).then(([q]) => q)
      : finnhubQuote(symbol)
  );
}

export async function getMarketAssets() {
  return cached('market:all', QUOTE_TTL, async () => {
    const stocks = ALL_ASSETS.filter((a) => a.type === ASSET_TYPES.STOCK);
    const tokens = ALL_ASSETS.filter((a) => a.type === ASSET_TYPES.TOKEN);

    const [stockResults, cryptoQuotes] = await Promise.all([
      Promise.allSettled(stocks.map((s) => finnhubQuote(s.symbol))),
      fetchCryptoQuotes(tokens.map((t) => t.symbol)).catch(() => []),
    ]);

    const quoteMap = {};
    stockResults.forEach((r, i) => {
      if (r.status === 'fulfilled') quoteMap[stocks[i].symbol] = r.value;
    });
    cryptoQuotes.forEach((q) => { quoteMap[q.symbol] = q; });

    return ALL_ASSETS.map((a) => ({ ...a, quote: quoteMap[a.symbol] ?? null }));
  });
}

export async function getAssetDetails(symbol) {
  const meta  = getAssetBySymbol(symbol);
  if (!meta) throw new Error(`Unknown asset: ${symbol}`);
  const quote = await getAssetPrice(symbol);
  return { ...meta, quote };
}

export async function getHistoricalPrices(symbol, timeframe = '1M') {
  return cached(`history:${symbol}:${timeframe}`, HISTORY_TTL, async () => {
    const meta = getAssetBySymbol(symbol);
    if (!meta) throw new Error(`Unknown asset: ${symbol}`);
    return meta.type === ASSET_TYPES.TOKEN
      ? fetchCryptoHistory(symbol, timeframe)
      : finnhubHistory(symbol, timeframe);
  });
}

export async function searchAssets(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matched = ALL_ASSETS.filter(
    (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  );
  return Promise.all(
    matched.map(async (a) => {
      try { return { ...a, quote: await getAssetPrice(a.symbol) }; }
      catch { return { ...a, quote: null }; }
    })
  );
}

export async function getTrendingAssets() {
  const all = await getMarketAssets();
  return [...all]
    .sort((a, b) => Math.abs(b.quote?.changePercent || 0) - Math.abs(a.quote?.changePercent || 0))
    .slice(0, 6);
}

export async function getTopGainers() {
  const all = await getMarketAssets();
  return [...all].sort((a, b) => (b.quote?.changePercent || 0) - (a.quote?.changePercent || 0)).slice(0, 5);
}

export async function getTopLosers() {
  const all = await getMarketAssets();
  return [...all].sort((a, b) => (a.quote?.changePercent || 0) - (b.quote?.changePercent || 0)).slice(0, 5);
}

/** Warm the market cache immediately (call once at app startup). */
export function prefetchMarket() {
  getMarketAssets().catch(() => {});
}
