import React, { useState } from 'react';

/**
 * Real asset logos sourced from free public CDNs.
 *   Stocks : Financial Modeling Prep image CDN (no API key needed).
 *   Crypto : CoinGecko CDN (public, no key needed).
 *
 * Falls back to a brand-colored monogram badge if the image fails to load.
 */

const CRYPTO_LOGOS = {
  BTC:  'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH:  'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL:  'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BNB:  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
};

function logoUrl(symbol) {
  if (!symbol) return null;
  if (CRYPTO_LOGOS[symbol]) return CRYPTO_LOGOS[symbol];
  // Financial Modeling Prep CDN — covers all major US-listed stocks
  return `https://financialmodelingprep.com/image-stock/${symbol}.png`;
}

export default function AssetLogo({ symbol, color = '#5B6472', monogram, size = 36 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src   = logoUrl(symbol);
  const label = monogram || symbol?.slice(0, 1) || '?';

  const containerStyle = {
    width:      size,
    height:     size,
    borderRadius: size / 3,
    flexShrink: 0,
    overflow:   'hidden',
    display:    'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `${color}1A`,
    border:     `1px solid ${color}33`,
  };

  if (src && !imgFailed) {
    return (
      <div aria-hidden="true" style={containerStyle}>
        <img
          src={src}
          alt={symbol}
          width={size}
          height={size}
          style={{ width: size, height: size, objectFit: 'contain' }}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  // Monogram fallback
  return (
    <div
      aria-hidden="true"
      style={{
        ...containerStyle,
        color,
        fontWeight:  700,
        fontSize:    size * 0.42,
        fontFamily:  'var(--font-display)',
      }}
    >
      {label}
    </div>
  );
}
