import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetLogo from './AssetLogo.jsx';
import MiniChart from './MiniChart.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import * as marketService from '../services/marketService.js';
import { usePortfolio } from '../context/PortfolioContext.jsx';

/**
 * Unified card for both stocks and tokens (StockCard / TokenCard share this
 * implementation since their required fields are identical).
 */
export default function AssetCard({ asset, layout = 'grid' }) {
  const navigate = useNavigate();
  const { watchlist, toggleWatchlist } = usePortfolio();
  const [history, setHistory] = useState([]);
  const isWatched = watchlist.includes(asset.symbol);
  const positive = (asset.quote?.changePercent ?? 0) >= 0;

  useEffect(() => {
    let active = true;
    marketService.getHistoricalPrices(asset.symbol, '1M').then((h) => {
      if (active) setHistory(h.series.filter((_, i) => i % 3 === 0));
    });
    return () => {
      active = false;
    };
  }, [asset.symbol]);

  const handleOpen = () => navigate(`/asset/${asset.symbol}`);

  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
      style={{
        padding: 'var(--space-4)',
        display: 'flex',
        flexDirection: layout === 'row' ? 'row' : 'column',
        alignItems: layout === 'row' ? 'center' : 'stretch',
        justifyContent: layout === 'row' ? 'space-between' : undefined,
        gap: 'var(--space-3)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{asset.name}</div>
          <div className="text-tertiary" style={{ fontSize: 12 }}>{asset.symbol}</div>
        </div>
      </div>

      {layout !== 'row' && <MiniChart series={history} positive={positive} width={120} height={36} />}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{formatCurrency(asset.quote?.price)}</div>
          <span className={`pill ${positive ? 'pill-positive' : 'pill-negative'}`}>
            {formatPercent(asset.quote?.changePercent)}
          </span>
        </div>
        <button
          className="btn-ghost"
          aria-label={isWatched ? `Remove ${asset.symbol} from watchlist` : `Add ${asset.symbol} to watchlist`}
          onClick={(e) => {
            e.stopPropagation();
            toggleWatchlist(asset.symbol);
          }}
          style={{ fontSize: 18, color: isWatched ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}
        >
          {isWatched ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
}
