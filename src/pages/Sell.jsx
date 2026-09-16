import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import SellModal from '../components/SellModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as marketService from '../services/marketService.js';
import { formatCurrency, formatQuantity } from '../utils/format.js';

export default function Sell() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { portfolio } = usePortfolio();
  const holdings = portfolio?.holdings || [];
  const [symbol, setSymbol] = useState(params.get('symbol') || holdings[0]?.symbol);
  const [modalOpen, setModalOpen] = useState(false);

  const holding = holdings.find((h) => h.symbol === symbol);
  const { data: asset } = useAsync(() => (symbol ? marketService.getAssetDetails(symbol) : Promise.resolve(null)), [symbol]);

  if (!holdings.length) {
    return (
      <div className="app-main">
        <Header title="Sell" />
        <div className="page-container" style={{ maxWidth: 520 }}>
          <EmptyState
            title="Nothing to sell yet"
            message="You don't hold any assets. Buy something first."
            action={<button className="btn btn-primary" onClick={() => navigate('/markets')}>Browse markets</button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-main">
      <Header title="Sell" />
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <label className="text-secondary" style={{ fontSize: 13 }}>Select a holding</label>
          <select className="input-field" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ margin: '6px 0 var(--space-4)' }}>
            {holdings.map((h) => (
              <option key={h.symbol} value={h.symbol}>{h.symbol} — {formatQuantity(h.quantity)} available</option>
            ))}
          </select>

          {asset && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} />
                <div>
                  <div style={{ fontWeight: 600 }}>{asset.name}</div>
                  <div className="text-tertiary" style={{ fontSize: 12 }}>Value: {formatCurrency(holding?.currentValue)}</div>
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>{formatCurrency(asset.quote.price)}</div>
            </div>
          )}

          <button className="btn btn-primary btn-block" onClick={() => setModalOpen(true)}>
            Continue to sell {symbol}
          </button>
        </div>
      </div>
      <SellModal asset={asset} holding={holding} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
