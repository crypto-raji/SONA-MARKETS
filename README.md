# Sona — Stocks & Tokens Trading Platform (Frontend)

A production-ready **frontend** for a stocks + crypto/token trading platform,
built with React + Vite. This project is UI-complete and runs entirely in
**demo mode** out of the box — no backend required to explore it — while
every piece of real infrastructure (market data, auth, wallets, transactions,
smart contracts, and your own Sona AI) has a clearly defined, documented
integration seam.

## Stack

- React 18 + Vite
- React Router (routing)
- Recharts (financial charts)
- Plain modern CSS (custom properties for theming, no CSS framework)
- No backend, database, or blockchain SDKs are bundled — see "Connecting real
  infrastructure" below for what to add when you're ready.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # preview the production build
```

The app runs fully in **demo mode** by default (`VITE_DEMO_MODE=true` in
`.env.example`). Copy `.env.example` to `.env` to configure it:

```bash
cp .env.example .env
```

## Demo data vs. live data

Every price, chart, balance, and transaction you see out of the box is
**demo data**, deterministically generated per asset so the UI is stable to
click through. It is never presented as live:

- Asset detail pages show a visible **"DEMO DATA"** badge.
- Every quote/history object returned by `marketService` includes
  `isLive: false` and `source: 'DEMO'`.
- Every demo transaction is tagged `isDemo: true`.
- Sona AI's mock responses are labeled **"DEMO RESPONSE"** in the chat UI.

Nothing here should ever be mistaken for a real trade, transfer, balance, or
AI answer.

## Real assets

Stocks and tokens use real, recognizable companies and their real tickers
(AAPL, MSFT, NVDA, AMZN, TSLA, GOOGL, META, NFLX, COIN, plus SOL, USDC, BTC,
ETH, BNB) — see `src/constants/assets.js`. Their logos are rendered as
color-coded monogram badges rather than traced/copied brand artwork; swap in
licensed logo images there once you have the rights to use them.

The app's own brand mark (Sona, not the listed assets) is the provided logo
at `public/assets/logo.png` (and pre-sized `logo-192.png` / `favicon-32.png`)
— used in the sidebar and browser tab. Swap that file for an updated brand
asset any time; nothing else needs to change.

## Project structure

```
stock-platform/
├── src/
│   ├── main.jsx, App.jsx
│   ├── components/        # shared UI (cards, modals, nav, charts, states)
│   │   └── ai/             # Sona AI chat components
│   ├── pages/              # one file per route
│   ├── services/           # ALL backend/market/wallet/AI communication
│   ├── context/             # Theme, Auth, Portfolio providers
│   ├── hooks/, utils/, constants/
│   └── styles/              # variables.css, globals.css, responsive.css
├── .env.example
└── package.json
```

No component talks to a network API directly — everything routes through
`src/services/*`. That's the seam a backend/blockchain developer connects to.

## Solana Network & Architecture

Sona operates on **Solana Mainnet Beta** for live transactions and real funds.

- The network configuration is centralized in `src/constants/network.js`
  (`getActiveNetwork()` / `getRpcUrl()`), and read by `walletService.js` and
  `contractService.js`.
- The Anchor trading program address is configured via `VITE_TRADING_PROGRAM_ID_MAINNET`
  in `.env`.
- For production traffic, configure `VITE_SOLANA_RPC_URL` with a dedicated RPC provider
  (Helius, QuickNode, Triton, etc.).

## Trading model: funded in crypto, plus a general Swap

Buy and Sell are **not** fiat-denominated — every buy is funded with USDC or
SOL, and every sell pays out in USDC or SOL (see `FUNDING_ASSETS` in
`src/constants/assets.js`). `BuyModal`/`SellModal` let the user pick which of
the two to use, converting at that asset's own live price.

Separately, **Swap** (`/swap`, in the sidebar and mobile nav) is a
general-purpose asset-to-asset exchange — any listed stock or token on
either side, with a direction-flip control, live rate, fee, and slippage
display, matching a typical DEX-style trade screen. Buy/Sell are effectively
specialized swaps fixed to USDC/SOL on one side, but are kept as their own
flows since they're presented separately in the UI. All three (`buyAsset`,
`sellAsset`, `swapAsset`) live in `transactionService.js` and record a
`BUY` / `SELL` / `SWAP` entry respectively in Transaction history.

## Connecting real infrastructure

Every service file has a comment block at the top explaining exactly what to
change. Summary:

| Service | Connect to |
|---|---|
| `marketService.js` | A market-data provider (Polygon.io, Finnhub, Alpaca, CoinGecko, etc.) via your backend proxy |
| `authService.js` | Google Identity Services + your backend session/PIN endpoints |
| `walletService.js` | `@solana/wallet-adapter-*` for real Phantom/Solflare/Backpack connections |
| `transactionService.js` | Your backend, which executes trades/transfers and/or calls `contractService.js` |
| `contractService.js` | Your deployed Solana program(s) — fill in `VITE_TRADING_PROGRAM_ID` / `VITE_TRANSFER_PROGRAM_ID` |
| `portfolioService.js` | Your backend/database for real holdings and performance |
| `watchlistService.js`, `userService.js` | Your backend/database (e.g. Supabase) |
| `sonaAIService.js` | Your existing Sona AI API, via `VITE_SONA_API_URL` and a backend proxy |

In every case, replace the body of the exported functions with a call to
`apiRequest()` (see `src/services/apiClient.js`) — the return shape already
matches what components expect, so no UI changes are needed.

## Security notes

- No private keys, seed phrases, or PINs are ever stored client-side. Demo
  mode only ever persists a boolean `pinIsSet` flag — never the PIN value.
- `.env.example` documents which secrets must live on your backend and never
  in a `VITE_` variable (market-data provider keys, Google OAuth client
  secret, Sona AI secret key, DB credentials, contract-authority keys).
- `contractService.js` never invents contract addresses — it reads
  `VITE_*_PROGRAM_ID` and throws a clear "not configured" error until you
  supply real ones.
- Sona AI can only **propose** a `BUY_ASSET` / `SELL_ASSET` / `SEND_ASSET`
  action (see `AIActionConfirmation.jsx`); accepting a proposal routes into
  the normal Buy/Sell/Send pages, which still require full review and PIN or
  wallet approval. The AI never executes a transaction directly and never
  receives private keys, seed phrases, passwords, or PINs.

## Sona AI integration

`src/services/sonaAIService.js` is the only place that talks to Sona AI. In
demo mode it uses a small local mock adapter (clearly labeled) so the chat UI
works with no backend. To connect your real Sona AI API:

1. Point `VITE_SONA_API_URL` at your backend's Sona AI proxy.
2. Set `VITE_DEMO_MODE=false`.
3. Replace the bodies of `sendMessage`, `analyzeAsset`, `analyzePortfolio`,
   `explainTransaction`, and `getConversationHistory` with real
   `apiRequest()` calls — keep the same return shapes.

No component or page needs to change.

## Responsive design

Desktop uses a fixed sidebar; mobile/tablet (`<1024px`) switch to a bottom
navigation bar and stacked single-column layouts. Tables convert to
label/value card rows below 640px (see `.table-to-cards` in
`responsive.css`). Modals become bottom sheets on small screens.

## Theming

Light/dark mode is driven entirely by CSS custom properties in
`src/styles/variables.css`, toggled via `data-theme` on `<html>` and
persisted to `localStorage`. There is one accent color, used only for
primary actions/links; green/red are reserved for price direction.
