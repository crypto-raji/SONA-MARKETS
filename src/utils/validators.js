import { PublicKey } from '@solana/web3.js';

export function isValidAmount(amount, { max } = {}) {
  const n = Number(amount);
  if (Number.isNaN(n) || n <= 0) return 'Enter a valid amount.';
  if (max !== undefined && n > max) return 'Amount exceeds available balance.';
  return null;
}

export function isValidAddress(address, network) {
  if (!address) return 'Enter a recipient address.';

  if (network === 'Solana') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      return 'That doesn’t look like a valid Solana address.';
    }
    try {
      const pk = new PublicKey(address);
      if (!PublicKey.isOnCurve(pk.toBytes())) {
        return 'That Solana address is not a valid public key.';
      }
    } catch {
      return 'That doesn’t look like a valid Solana address.';
    }
    return null;
  }

  if (network === 'Ethereum' || network === 'BNB Chain') {
    return /^0x[a-fA-F0-9]{40}$/.test(address) ? null : `That doesn’t look like a valid ${network} address.`;
  }
  if (network === 'Bitcoin') {
    return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}$/.test(address) ? null : 'That doesn’t look like a valid Bitcoin address.';
  }
  return address.length >= 8 ? null : 'Address looks too short.';
}

export function isValidPin(pin) {
  return /^\d{4,6}$/.test(pin) ? null : 'PIN must be 4 to 6 digits.';
}
