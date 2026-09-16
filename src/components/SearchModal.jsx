import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AssetLogo from './AssetLogo.jsx';
import { formatCurrency, formatPercent } from '../utils/format.js';
import { useDebounce } from '../hooks/useDebounce.js';
import * as marketService from '../services/marketService.js';

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(query, 250);
  const navigate = useNavigate();

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    marketService.searchAssets(debounced).then((r) => {
      if (active) {
        setResults(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [debounced]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <input
            autoFocus
            className="input-field"
            placeholder="Search by name or ticker (e.g. AAPL, Solana)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: 'var(--space-2)' }}>
          {loading && <div className="text-secondary" style={{ padding: 'var(--space-4)', fontSize: 13 }}>Searching...</div>}
          {!loading && debounced && results.length === 0 && (
            <div className="text-secondary" style={{ padding: 'var(--space-4)', fontSize: 13 }}>No matches for "{debounced}".</div>
          )}
          {results.map((asset) => (
            <button
              key={asset.symbol}
              className="btn-ghost btn-block"
              style={{ justifyContent: 'space-between', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}
              onClick={() => {
                onClose();
                navigate(`/asset/${asset.symbol}`);
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} size={30} />
                <span style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>{asset.name}</div>
                  <div className="text-tertiary" style={{ fontSize: 12 }}>{asset.symbol}</div>
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14 }}>{formatCurrency(asset.quote.price)}</div>
                <div className={asset.quote.changePercent >= 0 ? 'text-positive' : 'text-negative'} style={{ fontSize: 12 }}>
                  {formatPercent(asset.quote.changePercent)}
                </div>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
