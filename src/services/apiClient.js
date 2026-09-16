/**
 * apiClient.js — thin fetch wrapper for a future backend.
 *
 * All data is now live:
 *   - Auth/Portfolio/Transactions/Watchlist → Firebase (authService, portfolioService, etc.)
 *   - Market prices → Finnhub + CoinGecko (marketService)
 *
 * This file stays as a seam for any future custom backend endpoint that
 * doesn't fit Firebase directly (e.g. AI assistant, PIN verification).
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || '';

export async function apiRequest(path, { method = 'GET', body, headers } = {}) {
  if (!BASE_URL) {
    throw new Error(`apiRequest: VITE_BACKEND_URL is not set. Cannot call ${path}`);
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}
