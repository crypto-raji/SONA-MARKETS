/**
 * contractService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridges the frontend to the Sona Anchor program on Solana Mainnet.
 *
 * SonaSDK (and with it @coral-xyz/anchor) is dynamically imported the first
 * time a transaction is attempted, so it never blocks the initial page load.
 *
 * Setup checklist (remaining steps)
 * ───────────────────────────────────
 * 1. `cd contracts && anchor build`    → compile Rust, regenerate IDL
 * 2. `anchor deploy --provider.cluster mainnet-beta` → prints program address
 * 3. Update Anchor.toml + declare_id! in lib.rs if the address changes
 * 4. Ensure VITE_TRADING_PROGRAM_ID_MAINNET in .env matches the deployed address
 *
 * ✅ IDL at contracts/target/idl/sona.json (Phase 2 complete)
 * ✅ SDK lazy-loaded on first transaction attempt (Phase 3)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { Connection } from '@solana/web3.js';
import { getRpcUrl, getActiveNetwork } from '../constants/network.js';

function getProgramId() {
  const network = getActiveNetwork();
  const id = network === 'mainnet-beta'
    ? import.meta.env.VITE_TRADING_PROGRAM_ID_MAINNET
    : import.meta.env.VITE_TRADING_PROGRAM_ID_DEVNET;
  if (!id) {
    throw new Error(
      `contractService: VITE_TRADING_PROGRAM_ID_${network === 'mainnet-beta' ? 'MAINNET' : 'DEVNET'} not set in .env.`
    );
  }
  return id;
}

let _sdk = null;
let _sdkWallet = null;

/** Lazily import SonaSDK (and @coral-xyz/anchor) only when needed. */
async function getActiveSdk(walletAdapter) {
  if (_sdk && (!walletAdapter || _sdkWallet === walletAdapter)) return _sdk;

  // Dynamic import keeps Anchor out of the initial JS bundle / parse cost
  const { SonaSDK } = await import('../../contracts/sdk/sona-sdk.ts');
  const connection = new Connection(getRpcUrl(), 'confirmed');
  _sdk = new SonaSDK(getProgramId(), connection, walletAdapter);
  _sdkWallet = walletAdapter;
  return _sdk;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function buyAsset({ symbol, payWithSymbol, payAmount, assetPrice, solPriceUsd, wallet }) {
  const sdk = await getActiveSdk(wallet);
  await sdk.initializePortfolio();
  return sdk.buyAsset({ symbol, payWithSymbol, payAmount, assetPrice, solPriceUsd });
}

export async function sellAsset({ symbol, quantity, assetPrice, receiveWithSymbol, wallet }) {
  const sdk = await getActiveSdk(wallet);
  return sdk.sellAsset({ symbol, quantity, assetPrice, receiveWithSymbol });
}

export async function swapAsset({ fromSymbol, fromAmount, fromPrice, toSymbol, toPrice, wallet }) {
  const sdk = await getActiveSdk(wallet);
  return sdk.swapAsset({ fromSymbol, fromAmount, fromPrice, toSymbol, toPrice });
}

export async function transferAsset({ symbol, amount, recipient, wallet }) {
  const sdk = await getActiveSdk(wallet);
  return sdk.transferToken({ symbol, amount, recipient });
}

export async function getAssetBalance(address, symbol) {
  const sdk = await getActiveSdk(null);
  return sdk.getAssetBalance(address, symbol);
}

export async function getPortfolio(address) {
  const sdk = await getActiveSdk(null);
  return sdk.getPortfolio(address);
}

export async function getTransactionStatus(signature) {
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const status = await connection.getSignatureStatus(signature, {
    searchTransactionHistory: true,
  });
  return status?.value;
}
