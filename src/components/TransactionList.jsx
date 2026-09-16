import React from 'react';
import AssetLogo from './AssetLogo.jsx';
import EmptyState from './EmptyState.jsx';
import { getAssetBySymbol } from '../constants/assets.js';
import { formatCurrency, formatDate, formatQuantity, truncateAddress } from '../utils/format.js';

const EXPLORER_TX = (sig) => `https://solscan.io/tx/${sig}`;

const STATUS_PILL = {
  Completed: 'pill-positive',
  Pending: 'pill-warning',
  Failed: 'pill-negative',
};

/** The asset a transaction is primarily "about", for the logo/label column. */
function primarySymbol(tx) {
  return tx.symbol || tx.fromSymbol || tx.toSymbol;
}

/** Human-readable amount/direction line, tailored per transaction type. */
function AmountCell({ tx }) {
  if (tx.type === 'BUY') {
    return (
      <span>
        {formatQuantity(tx.quantity)} {tx.symbol}
        {tx.payAmount !== undefined && (
          <span className="text-tertiary"> · paid {formatQuantity(tx.payAmount)} {tx.payWithSymbol}</span>
        )}
      </span>
    );
  }
  if (tx.type === 'SELL') {
    return (
      <span>
        {formatQuantity(tx.quantity)} {tx.symbol}
        {tx.receiveAmount !== undefined && (
          <span className="text-tertiary"> · received {formatQuantity(tx.receiveAmount)} {tx.receiveWithSymbol}</span>
        )}
      </span>
    );
  }
  if (tx.type === 'SWAP') {
    return (
      <span>
        {formatQuantity(tx.fromAmount)} {tx.fromSymbol} <span aria-hidden="true">&rarr;</span>{' '}
        {formatQuantity(tx.toAmount)} {tx.toSymbol}
      </span>
    );
  }
  return (
    <span>
      {tx.quantity !== undefined ? formatQuantity(tx.quantity) : ''}
      {tx.amountUsd !== undefined ? ` (${formatCurrency(tx.amountUsd)})` : ''}
      {tx.recipient ? ` \u2192 ${truncateAddress(tx.recipient)}` : ''}
    </span>
  );
}

export default function TransactionList({ transactions = [], onExplain }) {
  if (!transactions.length) {
    return <EmptyState title="No transactions yet" message="Your buys, sells, swaps, sends and receives will show up here." />;
  }

  return (
    <div className="card table-responsive">
      <table className="table-to-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
            <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Type</th>
            <th style={{ padding: 'var(--space-3)' }}>Asset</th>
            <th style={{ padding: 'var(--space-3)' }}>Amount</th>
            <th style={{ padding: 'var(--space-3)' }}>Date</th>
            <th style={{ padding: 'var(--space-3)' }}>Status</th>
            <th style={{ padding: 'var(--space-3) var(--space-4)' }}></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const symbol = primarySymbol(tx);
            const meta = getAssetBySymbol(symbol) || {};
            return (
              <tr key={tx.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                <td data-label="Type" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>{tx.type}</span>
                    {tx.onChain && (
                      <span
                        title="Settled on Solana"
                        style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                          padding: '2px 5px', borderRadius: 4,
                          background: 'rgba(99,102,241,0.15)', color: '#6366f1',
                        }}
                      >
                        ON-CHAIN
                      </span>
                    )}
                  </div>
                </td>
                <td data-label="Asset" style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <AssetLogo symbol={symbol} color={meta.color} monogram={meta.monogram} size={26} />
                    <span style={{ fontSize: 13 }}>{symbol}</span>
                  </div>
                </td>
                <td data-label="Amount" style={{ padding: 'var(--space-3)', fontSize: 13 }}>
                  <AmountCell tx={tx} />
                </td>
                <td data-label="Date" style={{ padding: 'var(--space-3)', fontSize: 13 }} className="text-secondary">
                  {formatDate(tx.timestamp)}
                </td>
                <td data-label="Status" style={{ padding: 'var(--space-3)' }}>
                  <span className={`pill ${STATUS_PILL[tx.status] || 'pill-neutral'}`}>{tx.status}</span>
                </td>
                <td data-label="" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {tx.txHash && (
                      <a
                        href={EXPLORER_TX(tx.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 11, color: 'var(--color-accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        Explorer ↗
                      </a>
                    )}
                    {onExplain && (
                      <button className="btn-ghost btn-sm" onClick={() => onExplain(tx)}>Ask Sona AI</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
