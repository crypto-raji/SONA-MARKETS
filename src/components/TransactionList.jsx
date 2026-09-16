import React, { useState } from 'react';
import AssetLogo from './AssetLogo.jsx';
import EmptyState from './EmptyState.jsx';
import { getAssetBySymbol } from '../constants/assets.js';
import { formatCurrency, formatDate, formatQuantity, truncateAddress } from '../utils/format.js';
import { getSolscanUrl, getSolanaExplorerUrl, getActiveNetwork } from '../constants/network.js';

const STATUS_PILL = {
  Completed: 'pill-positive',
  completed: 'pill-positive',
  Pending: 'pill-warning',
  pending: 'pill-warning',
  Failed: 'pill-negative',
  failed: 'pill-negative',
};

function primarySymbol(tx) {
  return tx.symbol || tx.fromSymbol || tx.toSymbol || 'SOL';
}

function formatFullTimestamp(ts) {
  if (!ts) return 'Unknown';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'UTC',
    }) + ' UTC';
  } catch {
    return String(ts);
  }
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  try {
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

function AmountCell({ tx }) {
  if (tx.type === 'BUY') {
    return (
      <span>
        <strong style={{ color: 'var(--color-positive)' }}>+{formatQuantity(tx.quantity)} {tx.symbol}</strong>
        {tx.payAmount !== undefined && (
          <span className="text-tertiary"> · paid {formatQuantity(tx.payAmount)} {tx.payWithSymbol}</span>
        )}
      </span>
    );
  }
  if (tx.type === 'SELL') {
    return (
      <span>
        <strong style={{ color: 'var(--color-negative)' }}>-{formatQuantity(tx.quantity)} {tx.symbol}</strong>
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
        <strong>{formatQuantity(tx.toAmount)} {tx.toSymbol}</strong>
      </span>
    );
  }
  if (tx.type === 'SEND') {
    return (
      <span>
        <strong style={{ color: 'var(--color-negative)' }}>-{formatQuantity(tx.quantity || tx.amount)} {tx.symbol}</strong>
        {tx.recipient && (
          <span className="text-tertiary"> &rarr; {truncateAddress(tx.recipient)}</span>
        )}
      </span>
    );
  }
  if (tx.type === 'RECEIVE') {
    return (
      <span>
        <strong style={{ color: 'var(--color-positive)' }}>+{formatQuantity(tx.quantity || tx.amount)} {tx.symbol}</strong>
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
  const [expandedId, setExpandedId] = useState(null);
  const [copiedHash, setCopiedHash] = useState(null);
  const activeNetwork = getActiveNetwork();
  const isDevnet = activeNetwork !== 'mainnet-beta';

  if (!transactions.length) {
    return <EmptyState title="No transactions yet" message="Your buys, sells, swaps, sends and receives will show up here." />;
  }

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  return (
    <div className="card table-responsive" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="table-to-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--color-text-tertiary)', background: 'var(--color-bg)' }}>
            <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Type</th>
            <th style={{ padding: 'var(--space-3)' }}>Asset</th>
            <th style={{ padding: 'var(--space-3)' }}>Amount / Breakdown</th>
            <th style={{ padding: 'var(--space-3)' }}>Date & Time</th>
            <th style={{ padding: 'var(--space-3)' }}>Status</th>
            <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const id = tx.id || tx.txHash || `${tx.timestamp}_${tx.type}`;
            const isExpanded = expandedId === id;
            const symbol = primarySymbol(tx);
            const meta = getAssetBySymbol(symbol) || { symbol, name: symbol, color: '#3457D5' };
            const txHash = tx.txHash || (tx.id?.startsWith('tx_') ? null : tx.id);
            const statusKey = tx.status || 'Completed';

            return (
              <React.Fragment key={id}>
                {/* Main Row */}
                <tr
                  onClick={() => toggleExpand(id)}
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    background: isExpanded ? 'var(--color-surface-raised)' : 'transparent',
                    transition: 'background 150ms ease',
                  }}
                  className="tx-row"
                >
                  <td data-label="Type" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{tx.type}</span>
                      {(tx.onChain || txHash) && (
                        <span
                          title="Confirmed on Solana"
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
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{symbol}</div>
                        <div className="text-tertiary" style={{ fontSize: 11 }}>{meta.name}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Amount" style={{ padding: 'var(--space-3)', fontSize: 13 }}>
                    <AmountCell tx={tx} />
                  </td>
                  <td data-label="Date" style={{ padding: 'var(--space-3)', fontSize: 13 }} className="text-secondary">
                    <div>{formatDate(tx.timestamp)}</div>
                    <div className="text-tertiary" style={{ fontSize: 11 }}>{formatRelativeTime(tx.timestamp)}</div>
                  </td>
                  <td data-label="Status" style={{ padding: 'var(--space-3)' }}>
                    <span className={`pill ${STATUS_PILL[statusKey] || 'pill-neutral'}`}>
                      {statusKey}
                    </span>
                  </td>
                  <td data-label="" style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 8px', fontSize: 11, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}
                      onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
                    >
                      {isExpanded ? 'Hide ▲' : 'Inspect ▼'}
                    </button>
                  </td>
                </tr>

                {/* ── EXPANDED TRANSACTION DETAILS DRAWER ──────────────── */}
                {isExpanded && (
                  <tr style={{ background: 'var(--color-bg)' }}>
                    <td colSpan={6} style={{ padding: 'var(--space-4)' }}>
                      <div className="card" style={{
                        padding: 'var(--space-4)', background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                      }}>
                        {/* Title Bar */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)',
                          marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: 6,
                              background: 'var(--color-accent-soft)', color: 'var(--color-accent)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12,
                            }}>
                              SOL
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700 }}>Transaction Breakdown</div>
                              <div className="text-tertiary" style={{ fontSize: 11 }}>
                                Settled on {isDevnet ? 'Solana Devnet' : 'Solana Mainnet'} · Status: {statusKey}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            {onExplain && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => onExplain(tx)}
                                style={{ fontSize: 12 }}
                              >
                                🤖 Ask Sona AI
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Two-Column Detail Grid */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                          gap: 'var(--space-4)', marginBottom: 'var(--space-3)',
                        }}>
                          {/* Column 1: Financial & Operation Info */}
                          <div>
                            <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: '0.04em' }}>
                              OPERATION DETAILS
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                              <span className="text-secondary">Type</span>
                              <strong style={{ color: 'var(--color-text-primary)' }}>{tx.type}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                              <span className="text-secondary">Asset</span>
                              <span>{meta.name} ({symbol})</span>
                            </div>
                            {tx.price !== undefined && tx.price > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                                <span className="text-secondary">Execution Price</span>
                                <span>{formatCurrency(tx.price)}</span>
                              </div>
                            )}
                            {tx.amountUsd !== undefined && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                                <span className="text-secondary">Total USD Value</span>
                                <strong style={{ color: 'var(--color-text-primary)' }}>{formatCurrency(tx.amountUsd)}</strong>
                              </div>
                            )}
                            {tx.fee !== undefined && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                                <span className="text-secondary">Network Gas Fee</span>
                                <span>{tx.fee} SOL</span>
                              </div>
                            )}
                          </div>

                          {/* Column 2: Timestamp & Addresses */}
                          <div>
                            <div className="text-secondary" style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: '0.04em' }}>
                              BLOCKCHAIN & TIME
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                              <span className="text-secondary">Exact Timestamp</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                {formatFullTimestamp(tx.timestamp)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                              <span className="text-secondary">Cluster</span>
                              <span style={{ fontWeight: 600, color: '#6366f1' }}>
                                {isDevnet ? 'Solana Devnet' : 'Solana Mainnet-Beta'}
                              </span>
                            </div>
                            {tx.recipient && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, alignItems: 'center' }}>
                                <span className="text-secondary">Recipient</span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                                  {truncateAddress(tx.recipient)}
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(tx.recipient, `rec_${id}`)}
                                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', marginLeft: 4 }}
                                  >
                                    {copiedHash === `rec_${id}` ? '✓' : '📋'}
                                  </button>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transaction Hash & Block Explorer Action Box */}
                        {txHash ? (
                          <div style={{
                            padding: 'var(--space-3)', background: 'var(--color-bg)',
                            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span className="text-tertiary" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                                SOLANA TRANSACTION SIGNATURE
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-positive)' }}>
                                ✓ Finalized Block Commitment
                              </span>
                            </div>
                            <div style={{
                              fontFamily: 'var(--font-mono)', fontSize: 12, wordBreak: 'break-all',
                              marginBottom: 10, color: 'var(--color-text-primary)',
                            }}>
                              {txHash}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleCopy(txHash, id)}
                                style={{ fontSize: 12 }}
                              >
                                {copiedHash === id ? '✓ Copied!' : '📋 Copy Signature'}
                              </button>
                              <a
                                href={getSolscanUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 12, textDecoration: 'none' }}
                              >
                                View on Solscan ↗
                              </a>
                              <a
                                href={getSolanaExplorerUrl(txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: 12, textDecoration: 'none' }}
                              >
                                View on Solana Explorer ↗
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            padding: 'var(--space-3)', background: 'var(--color-bg)',
                            borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--color-text-tertiary)',
                          }}>
                            Transaction settled in portfolio store.
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
