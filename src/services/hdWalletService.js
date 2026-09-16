/**
 * hdWalletService.js — BIP-39 / BIP-44 HD wallet.
 *
 * One 12-word mnemonic → deterministic addresses for every chain:
 *   Solana  m/44'/501'/0'/0'
 *   Ethereum m/44'/60'/0'/0/0  (also used for BNB Chain — same key format)
 *   Bitcoin  m/84'/0'/0'/0/0   (native segwit, bc1q… address)
 *
 * The mnemonic is the single secret. It is AES-GCM encrypted with a key
 * derived from the user's Firebase UID and stored in localStorage.
 * Public addresses are written to Firestore so they survive device changes.
 *
 * SECURITY NOTE: localStorage encryption with a UID-derived key is a
 * custodial convenience store — sufficient for a dev/demo app. For
 * production, use a proper key-management service or hardware wallet.
 */
import * as bip39       from 'bip39';
import { HDKey }        from '@scure/bip32';
import { bech32 }       from '@scure/base';
import { sha256 }       from '@noble/hashes/sha256';
import { ripemd160 }    from '@noble/hashes/ripemd160';
import { keccak_256 }   from '@noble/hashes/sha3';
import { secp256k1 }    from '@noble/curves/secp256k1';
import { Keypair }      from '@solana/web3.js';

// ── Derivation paths (BIP-44) ─────────────────────────────────────────────────

const PATHS = {
  solana:   "m/44'/501'/0'/0'",
  ethereum: "m/44'/60'/0'/0/0",
  bnb:      "m/44'/60'/0'/0/0",  // BNB Chain is EVM — same derivation as ETH
  bitcoin:  "m/84'/0'/0'/0/0",   // BIP-84 native segwit
};

// ── Address derivation ────────────────────────────────────────────────────────

function solanaAddressFromSeed(seed) {
  const root    = HDKey.fromMasterSeed(seed);
  const child   = root.derive(PATHS.solana);
  const keypair = Keypair.fromSeed(child.privateKey);
  return { address: keypair.publicKey.toBase58(), secretKey: keypair.secretKey };
}

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function evmAddressFromSeed(seed, path = PATHS.ethereum) {
  const root    = HDKey.fromMasterSeed(seed);
  const child   = root.derive(path);
  const pubKey  = secp256k1.getPublicKey(child.privateKey, false); // uncompressed, 65 bytes
  const pubHash = keccak_256(pubKey.slice(1));                     // keccak of 64 bytes (strip 0x04 prefix)
  const address = '0x' + toHex(pubHash.slice(-20));
  return { address: toChecksumAddress(address), privateKey: child.privateKey };
}

function bitcoinAddressFromSeed(seed) {
  const root    = HDKey.fromMasterSeed(seed);
  const child   = root.derive(PATHS.bitcoin);
  const pubKey  = secp256k1.getPublicKey(child.privateKey, true); // compressed, 33 bytes

  // hash160 = RIPEMD160(SHA256(pubKey))
  const hash160 = ripemd160(sha256(pubKey));

  // P2WPKH witness program: version 0 + 20-byte hash
  // bech32 encode: witness version 0 is encoded as 0, then 5-bit groups of hash160
  const words = bech32.toWords(hash160);
  const address = bech32.encode('bc', [0, ...words]);
  return { address, privateKey: child.privateKey };
}

// EIP-55 checksum address
function toChecksumAddress(address) {
  const addr  = address.toLowerCase().replace('0x', '');
  const hash  = keccak_256(new TextEncoder().encode(addr));
  const hex   = toHex(hash);
  return '0x' + addr.split('').map((c, i) => parseInt(hex[i], 16) >= 8 ? c.toUpperCase() : c).join('');
}

// ── Encryption (AES-GCM, key derived from uid) ────────────────────────────────

const LS_MNEMONIC_KEY = (uid) => `sona_hd_mnemonic_${uid}`;

async function deriveKey(uid) {
  const raw = new TextEncoder().encode(uid.padEnd(32, '0').slice(0, 32));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encrypt(uid, text) {
  const key = await deriveKey(uid);
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  const combined = new Uint8Array(iv.byteLength + enc.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(enc), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(uid, b64) {
  const key      = await deriveKey(uid);
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const iv       = combined.slice(0, 12);
  const data     = combined.slice(12);
  const dec      = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(dec);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new HD wallet for uid.
 * Returns all addresses; encrypted mnemonic is saved to localStorage.
 * Call this once on first sign-up.
 */
export async function createHDWallet(uid) {
  const mnemonic = bip39.generateMnemonic(128); // 12 words
  const seed     = await bip39.mnemonicToSeed(mnemonic);

  const solana   = solanaAddressFromSeed(seed);
  const ethereum = evmAddressFromSeed(seed, PATHS.ethereum);
  const bnb      = evmAddressFromSeed(seed, PATHS.bnb);
  const bitcoin  = bitcoinAddressFromSeed(seed);

  // Encrypt and persist the mnemonic
  const cipherText = await encrypt(uid, mnemonic);
  localStorage.setItem(LS_MNEMONIC_KEY(uid), cipherText);

  return {
    mnemonic,  // shown to user once so they can back it up
    encryptedMnemonic: cipherText,
    addresses: {
      solana:   solana.address,
      ethereum: ethereum.address,
      bnb:      bnb.address,    // same key as ETH but displayed separately
      bitcoin:  bitcoin.address,
    },
  };
}

/**
 * Restore all chain addresses from a given encrypted mnemonic cipher text.
 */
export async function restoreHDWalletFromCipher(uid, cipherText) {
  if (!cipherText) return null;
  try {
    const mnemonic = await decrypt(uid, cipherText);
    const seed     = await bip39.mnemonicToSeed(mnemonic);

    // Also persist in local storage for fast access
    localStorage.setItem(LS_MNEMONIC_KEY(uid), cipherText);

    return {
      addresses: {
        solana:   solanaAddressFromSeed(seed).address,
        ethereum: evmAddressFromSeed(seed, PATHS.ethereum).address,
        bnb:      evmAddressFromSeed(seed, PATHS.bnb).address,
        bitcoin:  bitcoinAddressFromSeed(seed).address,
      },
    };
  } catch (err) {
    console.error('[Sona HD Wallet] Decryption failed:', err);
    return null;
  }
}

/**
 * Restore all chain addresses from the stored encrypted mnemonic in localStorage.
 * Returns null if no wallet found for uid.
 */
export async function restoreHDWallet(uid) {
  const stored = localStorage.getItem(LS_MNEMONIC_KEY(uid));
  if (!stored) return null;
  return restoreHDWalletFromCipher(uid, stored);
}

/**
 * Get the encrypted mnemonic string for syncing to Firestore.
 */
export function getEncryptedMnemonic(uid) {
  return localStorage.getItem(LS_MNEMONIC_KEY(uid)) || null;
}

/**
 * Get just the Solana Keypair for signing transactions.
 */
export async function getSolanaKeypair(uid) {
  const stored = localStorage.getItem(LS_MNEMONIC_KEY(uid));
  if (!stored) return null;
  try {
    const mnemonic = await decrypt(uid, stored);
    const seed     = await bip39.mnemonicToSeed(mnemonic);
    return solanaAddressFromSeed(seed).secretKey;
  } catch {
    return null;
  }
}

/**
 * Returns true if a HD wallet exists in localStorage for this uid.
 */
export function hasHDWallet(uid) {
  return !!localStorage.getItem(LS_MNEMONIC_KEY(uid));
}
