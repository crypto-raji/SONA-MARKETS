import React from 'react';
import AssetLogo from '../AssetLogo.jsx';
import { getAssetBySymbol } from '../../constants/assets.js';
import { formatCurrency, truncateAddress } from '../../utils/format.js';

/**
 * Displays a proposed AI action for explicit user review. Approving here
 * never executes anything directly — it hands off to the platform's normal
 * Buy/Sell/Send review-and-confirm flow (with PIN/wallet approval), exactly
 * like initiating that flow manually.
 */
export default function AIActionConfirmation({ proposal, onAction }) {
  const asset = getAssetBySymbol(proposal.asset);
  if (!asset) return null;

  const label = { BUY_ASSET: 'BUY', SELL_ASSET: 'SELL', SEND_ASSET: 'SEND' }[proposal.type] || proposal.type;

  return (
    <div className="card" style={{ padding: 'var(--space-4)', maxWidth: 320 }}>
      <div className="text-tertiary" style={{ fontSize: 11, marginBottom: 'var(--space-2)' }}>
        Sona AI wants to prepare
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <AssetLogo symbol={asset.symbol} color={asset.color} monogram={asset.monogram} />
        <div>
          <div style={{ fontWeight: 700 }}>{label} · {asset.name} ({asset.symbol})</div>
          {proposal.amountUsd !== undefined && (
            <div className="text-secondary" style={{ fontSize: 13 }}>Amount: {formatCurrency(proposal.amountUsd)}</div>
          )}
          {proposal.amount !== undefined && (
            <div className="text-secondary" style={{ fontSize: 13 }}>
              Amount: {proposal.amount} {asset.symbol}
              {proposal.recipient ? ` to ${truncateAddress(proposal.recipient)}` : ''}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => onAction?.(null)}>Cancel</button>
        <button className="btn btn-primary btn-sm btn-block" onClick={() => onAction?.(proposal)}>
          Review transaction
        </button>
      </div>
    </div>
  );
}
