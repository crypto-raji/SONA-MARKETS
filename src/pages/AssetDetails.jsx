import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import PriceChart from '../components/PriceChart.jsx';
import LoadingState from '../components/LoadingState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import BuyModal from '../components/BuyModal.jsx';
import SellModal from '../components/SellModal.jsx';
import AIButton from '../components/ai/AIButton.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useInterval } from '../hooks/useInterval.js';
import * as marketService from '../services/marketService.js';
import { getAssetBySymbol, CHART_TIMEFRAMES } from '../constants/assets.js';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';

export default function AssetDetails() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { portfolio, watchlist, toggleWatchlist } = usePortfolio();
  const [timeframe, setTimeframe] = useState('1M');
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);

  // Synchronous metadata — always available immediately (no network)
  const meta = getAssetBySymbol(symbol) || { symbol, name: symbol, color: '#888', monogram: symbol?.[0] };

  const { data: asset, loading, error, reload } = useAsync(() => marketService.getAssetDetails(symbol), [symbol]);
  const { data: history } = useAsync(() => marketService.getHistoricalPrices(symbol, timeframe), [symbol, timeframe]);

  // Refresh quote every 30 s while viewing
  useInterval(useCallback(() => {
    marketService.getAssetDetails(symbol).catch(() => {});
  }, [symbol]), 30_000);

  const holding = portfolio?.holdings?.find((h) => h.symbol === symbol);
  const isWatched = watchlist?.includes(symbol);
  const quote = asset?.quote;
  const positive = (quote?.changePercent ?? 0) >= 0;

  return (
    <div className="app-main">
      <Header title={symbol} />
      <div className="page-container">
        <button className="btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-3)' }}>
          ← Back
        </button>

        {/* Header — always visible immediately using sync metadata */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <AssetLogo symbol={meta.symbol} color={meta.color} monogram={meta.monogram} size={48} />
            <div>
              <h1 style={{ fontSize: 20 }}>{meta.name || symbol}</h1>
              <div className="text-tertiary" style={{ fontSize: 13 }}>
                {symbol}{meta.sector ? ` · ${meta.sector}` : meta.network ? ` · ${meta.network}` : ''}
              </div>
            </div>
          </div>

          {/* Price — skeleton while loading, real price once ready */}
          <div style={{ textAlign: 'right' }}>
            {quote ? (
              <>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {formatCurrency(quote.price)}
                </div>
                <span className={`pill ${positive ? 'pill-positive' : 'pill-negative'}`}>
                  {formatCurrency(quote.change)} ({formatPercent(quote.changePercent)})
                </span>
              </>
            ) : (
              <div>
                <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 8, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: 80, height: 20, borderRadius: 10 }} />
              </div>
            )}
          </div>
        </div>

        {/* Live badge */}
        {quote?.isLive && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 600,
            padding: '3px 9px', borderRadius: 10,
            background: 'rgba(34,197,94,0.10)', color: '#16a34a',
            marginBottom: 'var(--space-4)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
            Live Market Feed
          </div>
        )}

        {/* Chart — always visible, shows empty series while loading */}
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            {CHART_TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                className={`btn btn-sm ${timeframe === tf ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setTimeframe(tf)}
              >
                {tf}
              </button>
            ))}
          </div>
          {history?.series?.length > 0
            ? <PriceChart series={history.series} positive={positive} />
            : <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
          }
        </div>

        {/* Error state */}
        {error && <ErrorState message="Failed to load live price." onRetry={reload} />}

        {/* Stats — shown once price data arrives */}
        {quote && (
          <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-3)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Today's stats
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2) var(--space-4)' }}>
              {[
                { label: 'Open',       value: formatCurrency(quote.open) },
                { label: 'Prev close', value: formatCurrency(quote.previousClose) },
                { label: "Day's high", value: formatCurrency(quote.high) },
                { label: "Day's low",  value: formatCurrency(quote.low) },
              ].filter(({ value }) => value && value !== '$0.00').map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions — always visible so user can interact immediately */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
          <button className="btn btn-primary" onClick={() => setBuyOpen(true)}>Buy</button>
          <button className="btn btn-secondary" onClick={() => setSellOpen(true)} disabled={!holding}>Sell</button>
          <button className="btn btn-secondary" onClick={() => toggleWatchlist(symbol)}>
            {isWatched ? '★ Watchlisted' : '☆ Add to watchlist'}
          </button>
          <AIButton context={{ symbol }} label={`Ask Sona AI about ${symbol}`} />
        </div>

        {/* About — always visible */}
        {meta.about && (
          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <h3 style={{ fontSize: 15, marginBottom: 'var(--space-2)' }}>About</h3>
            <p className="text-secondary" style={{ fontSize: 14, lineHeight: 1.6 }}>{meta.about}</p>
          </div>
        )}
      </div>

      <BuyModal asset={asset || meta} open={buyOpen} onClose={() => setBuyOpen(false)} />
      <SellModal asset={asset || meta} holding={holding} open={sellOpen} onClose={() => setSellOpen(false)} />
    </div>
  );
}
