/**
 * Centralized asset metadata.
 *
 * This is DEMO metadata only (name / symbol / type / network / brand color).
 * It contains NO prices — prices, changes and history must always come from
 * marketService, which is the seam where a real market-data provider gets
 * connected. Logos are rendered as typographic monogram badges using each
 * brand's real color, not as copied/traced brand marks, to avoid shipping
 * unlicensed logo artwork.
 *
 * To add a new listed asset, add one entry here — no component needs to change.
 */

export const ASSET_TYPES = {
  STOCK: 'stock',
  TOKEN: 'token',
};

export const STOCKS = [
  { symbol: 'AAPL', name: 'Apple', type: ASSET_TYPES.STOCK, sector: 'Technology', color: '#0A0A0A', monogram: '' },
  { symbol: 'MSFT', name: 'Microsoft', type: ASSET_TYPES.STOCK, sector: 'Technology', color: '#00A4EF', monogram: 'MS' },
  { symbol: 'NVDA', name: 'NVIDIA', type: ASSET_TYPES.STOCK, sector: 'Semiconductors', color: '#76B900', monogram: 'N' },
  { symbol: 'AMZN', name: 'Amazon', type: ASSET_TYPES.STOCK, sector: 'Consumer / Cloud', color: '#FF9900', monogram: 'a' },
  { symbol: 'TSLA', name: 'Tesla', type: ASSET_TYPES.STOCK, sector: 'Automotive', color: '#CC0000', monogram: 'T' },
  { symbol: 'GOOGL', name: 'Alphabet', type: ASSET_TYPES.STOCK, sector: 'Technology', color: '#4285F4', monogram: 'G' },
  { symbol: 'META', name: 'Meta Platforms', type: ASSET_TYPES.STOCK, sector: 'Technology', color: '#0866FF', monogram: '∞' },
  { symbol: 'NFLX', name: 'Netflix', type: ASSET_TYPES.STOCK, sector: 'Media', color: '#E50914', monogram: 'N' },
  { symbol: 'COIN', name: 'Coinbase Global', type: ASSET_TYPES.STOCK, sector: 'Financial Services', color: '#0052FF', monogram: 'C' },
];

export const TOKENS = [
  { symbol: 'SOL', name: 'Solana', type: ASSET_TYPES.TOKEN, network: 'Solana', color: '#14F195', monogram: 'S' },
  { symbol: 'USDC', name: 'USD Coin', type: ASSET_TYPES.TOKEN, network: 'Solana', color: '#2775CA', monogram: '$' },
  { symbol: 'BTC', name: 'Bitcoin', type: ASSET_TYPES.TOKEN, network: 'Bitcoin', color: '#F7931A', monogram: '₿' },
  { symbol: 'ETH', name: 'Ethereum', type: ASSET_TYPES.TOKEN, network: 'Ethereum', color: '#627EEA', monogram: 'Ξ' },
  { symbol: 'BNB', name: 'BNB', type: ASSET_TYPES.TOKEN, network: 'BNB Chain', color: '#F0B90B', monogram: 'B' },
];

export const ALL_ASSETS = [...STOCKS, ...TOKENS];

export function getAssetBySymbol(symbol) {
  return ALL_ASSETS.find((a) => a.symbol === symbol.toUpperCase());
}

export const SUPPORTED_NETWORKS = ['Solana', 'Ethereum', 'Bitcoin', 'BNB Chain'];

/**
 * Assets used to fund a Buy and to be paid out on a Sell. Sona settles
 * trades in crypto rather than raw fiat — every buy is funded with USDC or
 * SOL, and every sell pays out in USDC or SOL. (Send/Receive and the
 * general-purpose Swap page are unaffected — those work with any listed
 * asset.)
 */
export const FUNDING_ASSETS = ['USDC', 'SOL'];

export const CHART_TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y', '5Y'];
