import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import AssetCard from '../components/AssetCard.jsx';
import PriceChart from '../components/PriceChart.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useBalanceVisibility, Masked } from '../context/BalanceVisibilityContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useInterval } from '../hooks/useInterval.js';
import * as portfolioService from '../services/portfolioService.js';
import * as marketService from '../services/marketService.js';
import { getWalletBalance } from '../services/walletService.js';
import { getAssetBySymbol, ASSET_TYPES } from '../constants/assets.js';
import { formatCurrency, formatPercent, formatQuantity } from '../utils/format.js';

// Self-contained hook — fetches on-chain balance directly using auth address.
// Polls every 30 s so incoming airdrops / transfers appear without a page reload.
function useWalletBalance(address) {
  const [state, setState] = useState({ sol: null, tokens: [], loading: !!address });
  const fetchRef = useRef(0);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    const id = ++fetchRef.current;
    const result = await getWalletBalance(address);
    if (fetchRef.current !== id) return;
    setState({ sol: result.sol, tokens: result.tokens, loading: false });
  }, [address]);

  // Initial fetch
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchBalance();
  }, [fetchBalance]);

  // Poll every 30 s — picks up new airdrops / incoming transfers automatically
  useInterval(fetchBalance, 30_000);

  return state;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'USDC', label: 'USDC' },
  { id: 'SOL', label: 'Solana' },
  { id: 'stocks', label: 'Stocks' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { portfolio, loading, refreshPortfolio } = usePortfolio();
  const { hidden } = useBalanceVisibility();
  const solanaAddress = user?.wallets?.solana || null;
  const walletBalance = useWalletBalance(solanaAddress);
  const { data: performance } = useAsync(() => portfolioService.getPortfolioPerformance('1M'), []);
  const { data: marketAssets, loading: marketLoading, error: marketError, reload: reloadMarket } = useAsync(() => marketService.getMarketAssets(), []);
  const [filter, setFilter] = useState('all');
  const [marketTab, setMarketTab] = useState(ASSET_TYPES.STOCK);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  const copyAddress = useCallback(async () => {
    if (!solanaAddress) return;
    try { await navigator.clipboard.writeText(solanaAddress); } catch {}
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  }, [solanaAddress]);

  // Auto-refresh market prices every 60 s and portfolio every 2 min
  useInterval(() => { marketService.prefetchMarket?.(); }, 60_000);
  useInterval(() => { refreshPortfolio(); }, 120_000);

  const holdings = portfolio?.holdings || [];
  const totalHoldingsValue = holdings.reduce((sum, h) => sum + h.currentValue, 0) || 1;
  const filteredHoldings = holdings
    .filter((h) => {
      if (filter === 'all') return true;
      if (filter === 'stocks') return getAssetBySymbol(h.symbol)?.type === ASSET_TYPES.STOCK;
      return h.symbol === filter;
    })
    .sort((a, b) => b.currentValue - a.currentValue);

  const positive = (portfolio?.profitLoss ?? 0) >= 0;

  return (
    <div className="app-main">
      <Header title="Home" />
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {loading && !portfolio && <LoadingState />}
        {!loading && !portfolio && <ErrorState message="Failed to load your balance." onRetry={refreshPortfolio} />}

        {portfolio && (
          <>
            {/* Balance card */}
            <section
              className="card"
              style={{
                padding: 'var(--space-5)',
                background: 'var(--color-accent-soft)',
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-secondary" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Total Portfolio Value
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'var(--font-display)', margin: '4px 0' }}>
                    <Masked hidden={hidden}>{formatCurrency(portfolio.totalValue)}</Masked>
                  </div>
                  <span className={`pill ${positive ? 'pill-positive' : 'pill-negative'}`}>
                    <Masked hidden={hidden}>{formatPercent(portfolio.profitLossPercent)} (24h)</Masked>
                  </span>
                </div>
                <button
                  onClick={() => navigate('/ai-assistant')}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    flexShrink: 0, textAlign: 'center',
                  }}
                  aria-label="Open Sona AI Assistant"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    ✦
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Sona AI</span>
                  <span className="text-tertiary" style={{ fontSize: 10 }}>Assistant</span>
                </button>
              </div>

              {performance && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <PriceChart series={performance.series.map((p) => ({ t: p.t, price: p.value }))} positive={positive} height={70} showAxes={false} />
                </div>
              )}
            </section>

            {/* Receive | Send | Swap | More */}
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
              <QuickAction icon="↓" label="Receive" onClick={() => navigate('/receive')} />
              <QuickAction icon="↑" label="Send" onClick={() => navigate('/send')} />
              <QuickAction icon="⇄" label="Swap" onClick={() => navigate('/swap')} />
              <QuickAction icon="•••" label="More" onClick={() => setMoreOpen(true)} />
            </section>

            {/* On-chain wallet balance — driven directly by auth address, independent of portfolio load */}
            {solanaAddress && (
              <section className="card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Wallet Balance</span>
                  {walletBalance.loading && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Loading…</span>}
                </div>

                {walletBalance.loading
                  ? null
                  : walletBalance.tokens.length > 0
                    ? walletBalance.tokens.map((t) => (
                      <div key={t.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {(() => { const m = getAssetBySymbol(t.symbol) || {}; return <AssetLogo symbol={t.symbol} color={m.color} monogram={m.monogram} size={28} />; })()}
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{t.symbol}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}><Masked hidden={hidden}>{formatQuantity(t.amount)}</Masked></span>
                      </div>
                    ))
                    : (
                      <div style={{ fontSize: 13 }} className="text-secondary">
                        No balance yet. Deposit SOL to get started.
                      </div>
                    )
                }

                <div
                  onClick={copyAddress}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--color-bg)', borderRadius: 8, padding: '6px 10px',
                    cursor: 'pointer', gap: 8,
                  }}
                >
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {solanaAddress}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-accent)', flexShrink: 0, fontWeight: 600 }}>
                    {addressCopied ? 'Copied!' : 'Copy'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 2 }}>
                  <button className="btn btn-secondary btn-sm btn-block" onClick={() => navigate('/receive')}>Deposit</button>
                  <button className="btn btn-secondary btn-sm btn-block" onClick={() => navigate('/send')}>Send</button>
                </div>
              </section>
            )}

            {/* My Portfolio */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h2 style={{ fontSize: 17 }}>My Portfolio</h2>
                <button
                  className="pill pill-neutral"
                  onClick={() => navigate('/portfolio')}
                  style={{ border: 'none', cursor: 'pointer' }}
                >
                  <Masked hidden={hidden}>{formatCurrency(portfolio.availableBalance)}</Masked> ›
                </button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', overflowX: 'auto' }} className="scroll-hide">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    className={`btn btn-sm ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter(f.id)}
                    style={{ flexShrink: 0 }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredHoldings.length === 0 ? (
                <EmptyState title="No holdings in this filter" message="Buy or swap into an asset to see it here." />
              ) : (
                <div className="card">
                  {filteredHoldings.map((h, i) => {
                    const meta = getAssetBySymbol(h.symbol) || {};
                    const percentOfPortfolio = (h.currentValue / totalHoldingsValue) * 100;
                    return (
                      <button
                        key={h.symbol}
                        onClick={() => navigate(`/asset/${h.symbol}`)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: 'var(--space-3) var(--space-4)', textAlign: 'left',
                          borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                          <AssetLogo symbol={h.symbol} color={meta.color} monogram={meta.monogram} size={34} />
                          <span style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{meta.name || h.symbol}</div>
                            <div className="text-tertiary" style={{ fontSize: 12 }}>{h.symbol}</div>
                          </span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                          <span style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 600 }}><Masked hidden={hidden}>{formatCurrency(h.currentValue)}</Masked></div>
                            <div className="text-tertiary" style={{ fontSize: 12 }}><Masked hidden={hidden}>{percentOfPortfolio.toFixed(2)}%</Masked></div>
                          </span>
                          <span className="text-tertiary" aria-hidden="true">›</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Market overview — browse all stocks/tokens, not just what you hold */}
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <h2 style={{ fontSize: 17 }}>Market Overview</h2>
                <button className="btn-ghost btn-sm" onClick={() => navigate('/markets')}>View all ›</button>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                <button
                  className={`btn btn-sm ${marketTab === ASSET_TYPES.STOCK ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMarketTab(ASSET_TYPES.STOCK)}
                >
                  Stocks
                </button>
                <button
                  className={`btn btn-sm ${marketTab === ASSET_TYPES.TOKEN ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMarketTab(ASSET_TYPES.TOKEN)}
                >
                  Tokens
                </button>
              </div>

              {marketLoading && <LoadingState />}
              {marketError && <ErrorState message="Failed to load market data." onRetry={reloadMarket} />}
              {!marketLoading && !marketError && (
                <div className="grid-responsive">
                  {marketAssets
                    ?.filter((a) => a.type === marketTab)
                    .map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
                </div>
              )}
            </section>

            {/* Sona AI section */}
            <section
              className="card"
              style={{
                padding: 'var(--space-5)', background: 'var(--color-accent-soft)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap',
              }}
            >
              <div style={{ maxWidth: 280 }}>
                <h3 style={{ fontSize: 15, marginBottom: 4 }}>Smarter decisions with Sona AI</h3>
                <p className="text-secondary" style={{ fontSize: 13, marginBottom: 'var(--space-3)' }}>
                  Ask anything. Get real-time insights, charts and more.
                </p>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/ai-assistant')}>
                  Chat Now →
                </button>
              </div>
              <span
                aria-hidden="true"
                style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                ✦
              </span>
            </section>
          </>
        )}
      </div>

      {moreOpen && (
        <div className="modal-overlay" onClick={() => setMoreOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div style={{ padding: 'var(--space-4)' }}>
              <h2 style={{ fontSize: 16, marginBottom: 'var(--space-3)', padding: '0 var(--space-2)' }}>More</h2>
              <MoreLink icon="↓" label="Buy" onClick={() => { setMoreOpen(false); navigate('/buy'); }} />
              <MoreLink icon="↑" label="Sell" onClick={() => { setMoreOpen(false); navigate('/sell'); }} />
              <MoreLink icon="≡" label="Markets" onClick={() => { setMoreOpen(false); navigate('/markets'); }} />
              <MoreLink icon="↔" label="Transaction history" onClick={() => { setMoreOpen(false); navigate('/transactions'); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      className="card"
      onClick={onClick}
      style={{
        padding: 'var(--space-3) var(--space-2)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 6, background: 'var(--color-accent-soft)', border: 'none',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, color: 'var(--color-accent)' }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)' }}>{label}</span>
    </button>
  );
}

function MoreLink({ icon, label, onClick }) {
  return (
    <button
      className="btn-ghost btn-block"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-2)', fontSize: 14 }}
    >
      <span aria-hidden="true" style={{ width: 22, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  );
}
