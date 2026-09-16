/**
 * network.js
 * -----------------------------------------------------------------------
 * Single source of truth for the Solana cluster the app targets.
 * Active network is controlled by:
 *   1. localStorage key 'sona_network_override' (user switched in Settings)
 *   2. VITE_SOLANA_NETWORK env var (build-time default)
 *   3. 'devnet' hardcoded fallback
 * -----------------------------------------------------------------------
 */

const OVERRIDE_KEY = 'sona_network_override';

export const SOLANA_NETWORKS = {
  devnet: {
    id: 'devnet',
    label: 'Devnet',
    sublabel: 'Solana test network.',
    isProduction: false,
    defaultRpcUrl: 'https://api.devnet.solana.com',
    usdcMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    explorerBase: 'https://solscan.io',
    explorerCluster: '?cluster=devnet',
  },
  'mainnet-beta': {
    id: 'mainnet-beta',
    label: 'Mainnet Beta',
    sublabel: 'Solana main network.',
    isProduction: true,
    defaultRpcUrl: 'https://mainnet.helius-rpc.com/?api-key=15319bf4-5b40-4958-ac71-6d44cf7b391e',
    usdcMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    explorerBase: 'https://solscan.io',
    explorerCluster: '',
  },
};

function readOverride() {
  try { return localStorage.getItem(OVERRIDE_KEY) || null; } catch { return null; }
}

const _active =
  readOverride() ||
  import.meta.env.VITE_SOLANA_NETWORK ||
  'devnet';

export function getActiveNetwork() {
  return _active;
}

export function getNetworkInfo(id) {
  return SOLANA_NETWORKS[id] || SOLANA_NETWORKS[_active];
}

export function getActiveNetworkInfo() {
  return SOLANA_NETWORKS[_active];
}

export function isMainnet() {
  return _active === 'mainnet-beta';
}

/**
 * Switch network at runtime. Saves to localStorage and reloads the page
 * so all modules pick up the new cluster.
 */
export function setActiveNetwork(id) {
  if (!SOLANA_NETWORKS[id]) return;
  try { localStorage.setItem(OVERRIDE_KEY, id); } catch {}
  window.location.reload();
}

/**
 * RPC endpoint. VITE_SOLANA_RPC_URL overrides the cluster default.
 */
export function getRpcUrl() {
  // When user has overridden the network, don't use the env-var RPC
  // (it points to the build-time cluster, not the chosen one).
  const override = readOverride();
  if (override && override !== import.meta.env.VITE_SOLANA_NETWORK) {
    return SOLANA_NETWORKS[override]?.defaultRpcUrl;
  }
  return (
    import.meta.env.VITE_SOLANA_RPC_URL ||
    SOLANA_NETWORKS[_active]?.defaultRpcUrl ||
    'https://api.devnet.solana.com'
  );
}

/** USDC mint for the active cluster. */
export function getUsdcMint() {
  return SOLANA_NETWORKS[_active]?.usdcMint;
}

/** Solscan link with the correct cluster param. */
export function getExplorerUrl(txHash) {
  return getSolscanUrl(txHash);
}

export function getSolscanUrl(txHash) {
  if (!txHash) return '#';
  const isDev = _active !== 'mainnet-beta';
  return `https://solscan.io/tx/${txHash}${isDev ? '?cluster=devnet' : ''}`;
}

export function getSolanaExplorerUrl(txHash) {
  if (!txHash) return '#';
  const isDev = _active !== 'mainnet-beta';
  return `https://explorer.solana.com/tx/${txHash}${isDev ? '?cluster=devnet' : ''}`;
}

export function getAddressExplorerUrl(address) {
  if (!address) return '#';
  const isDev = _active !== 'mainnet-beta';
  return `https://solscan.io/account/${address}${isDev ? '?cluster=devnet' : ''}`;
}
