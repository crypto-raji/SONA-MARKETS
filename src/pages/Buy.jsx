import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import AssetLogo from '../components/AssetLogo.jsx';
import BuyModal from '../components/BuyModal.jsx';
import { ALL_ASSETS } from '../constants/assets.js';
import { useAsync } from '../hooks/useAsync.js';
import * as marketService from '../services/marketService.js';
import { formatCurrency, formatPercent } from '../utils/format.js';

export default function Buy() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [symbol, setSymbol] = useState(params.get('symbol') || 'AAPL');
  const [modalOpen, setModalOpen] = useState(false);
  const { data: asset } = useAsync(() => marketService.getAssetDetails(symbol), [symbol]);

  return (
    <div className="app-main">
      <Header title="Buy" />
      <div className="page-container" style={{ maxWidth: 520 }}>
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <label className="text-secondary" style={{ fontSize: 13 }}>Select asset</label>
          <select className="input-field" value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ margin: '6px 0 var(--space-4)' }}>
            {ALL_ASSETS.map((a) => (
              <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol})</option>
            ))}
          </select>

          {asset && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} />
                <div>
                  <div style={{ fontWeight: 600 }}>{asset.name}</div>
                  <div className="text-tertiary" style={{ fontSize: 12 }}>{asset.symbol}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{formatCurrency(asset.quote.price)}</div>
                <span className={asset.quote.changePercent >= 0 ? 'text-positive' : 'text-negative'} style={{ fontSize: 12 }}>
                  {formatPercent(asset.quote.changePercent)}
                </span>
              </div>
            </div>
          )}

          <button className="btn btn-primary btn-block" onClick={() => setModalOpen(true)}>
            Continue to buy {symbol}
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-2)' }} onClick={() => navigate('/markets')}>
            Browse markets instead
          </button>
        </div>
      </div>
      <BuyModal asset={asset} open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
