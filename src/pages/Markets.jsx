import React, { useState, useMemo } from 'react';
import Header from '../components/Header.jsx';
import AssetCard from '../components/AssetCard.jsx';
import { LoadingRows } from '../components/LoadingState.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAsync } from '../hooks/useAsync.js';
import * as marketService from '../services/marketService.js';
import { ASSET_TYPES } from '../constants/assets.js';

const TABS = [
  { id: 'all', label: 'All' },
  { id: ASSET_TYPES.STOCK, label: 'Stocks' },
  { id: ASSET_TYPES.TOKEN, label: 'Tokens' },
  { id: 'gainers', label: 'Top gainers' },
  { id: 'losers', label: 'Top losers' },
];

export default function Markets() {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const { data: assets, loading, error, reload } = useAsync(() => marketService.getMarketAssets(), []);
  const { data: gainers } = useAsync(() => marketService.getTopGainers(), []);
  const { data: losers }  = useAsync(() => marketService.getTopLosers(), []);

  const base = useMemo(() => {
    if (tab === 'gainers') return gainers || [];
    if (tab === 'losers')  return losers  || [];
    if (tab === 'all')     return assets  || [];
    return (assets || []).filter((a) => a.type === tab);
  }, [tab, assets, gainers, losers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [base, query]);

  return (
    <div className="app-main">
      <Header title="Markets" />
      <div className="page-container">

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: 'var(--color-text-tertiary)', pointerEvents: 'none',
          }}>⌕</span>
          <input
            className="input-field"
            placeholder="Search stocks or tokens…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: 'var(--color-text-tertiary)', lineHeight: 1,
              }}
            >✕</button>
          )}
        </div>

        {/* Tab filters */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <LoadingRows count={6} height={140} />}
        {error && <ErrorState message="Failed to load market data." onRetry={reload} />}
        {!loading && !error && list.length === 0 && (
          <EmptyState
            title={query ? `No results for "${query}"` : 'No assets found'}
            message={query ? 'Try a different symbol or name.' : ''}
          />
        )}
        {!loading && !error && list.length > 0 && (
          <div className="grid-responsive">
            {list.map((asset) => <AssetCard key={asset.symbol} asset={asset} />)}
          </div>
        )}
      </div>
    </div>
  );
}
