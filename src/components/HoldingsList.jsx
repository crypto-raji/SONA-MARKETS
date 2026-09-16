import React from 'react';
import { useNavigate } from 'react-router-dom';
import AssetLogo from './AssetLogo.jsx';
import { getAssetBySymbol } from '../constants/assets.js';
import { formatCurrency, formatPercent, formatQuantity } from '../utils/format.js';
import EmptyState from './EmptyState.jsx';
import { useBalanceVisibility, Masked } from '../context/BalanceVisibilityContext.jsx';

export default function HoldingsList({ holdings = [] }) {
  const navigate = useNavigate();
  const { hidden } = useBalanceVisibility();

  if (!holdings.length) {
    return <EmptyState title="No holdings yet" message="Buy your first stock or token to see it here." />;
  }

  return (
    <div className="card table-responsive">
      <table className="table-to-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Asset</th>
            <th style={{ padding: 'var(--space-3)' }}>Quantity</th>
            <th style={{ padding: 'var(--space-3)' }}>Avg. price</th>
            <th style={{ padding: 'var(--space-3)' }}>Value</th>
            <th style={{ padding: 'var(--space-3) var(--space-4)' }}>P/L</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const meta = getAssetBySymbol(h.symbol) || {};
            const positive = h.profitLoss >= 0;
            return (
              <tr
                key={h.symbol}
                onClick={() => navigate(`/asset/${h.symbol}`)}
                style={{ borderTop: '1px solid var(--color-border)', cursor: 'pointer' }}
              >
                <td data-label="Asset" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <AssetLogo symbol={h.symbol} color={meta.color} monogram={meta.monogram} size={30} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{meta.name || h.symbol}</div>
                      <div className="text-tertiary" style={{ fontSize: 12 }}>{h.symbol}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Quantity" style={{ padding: 'var(--space-3)' }}><Masked hidden={hidden}>{formatQuantity(h.quantity)}</Masked></td>
                <td data-label="Avg. price" style={{ padding: 'var(--space-3)' }}><Masked hidden={hidden}>{formatCurrency(h.avgPrice)}</Masked></td>
                <td data-label="Value" style={{ padding: 'var(--space-3)' }}><Masked hidden={hidden}>{formatCurrency(h.currentValue)}</Masked></td>
                <td data-label="P/L" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <span className={positive ? 'text-positive' : 'text-negative'}>
                    <Masked hidden={hidden}>{formatCurrency(h.profitLoss)} ({formatPercent(h.profitLossPercent)})</Masked>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
