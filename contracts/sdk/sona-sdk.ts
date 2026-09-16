/**
 * sona-sdk.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * TypeScript SDK for the Sona on-chain program. Import this from
 * src/services/contractService.js (after running `anchor build` to generate
 * the IDL and replacing the TODO_IDL_PATH import below).
 *
 * Installation (run from the project root):
 *   npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
 *
 * Usage in contractService.js:
 *   import { SonaSDK } from '../../contracts/sdk/sona-sdk';
 *   const sdk = new SonaSDK(programId, connection, wallet);
 *   await sdk.buyAsset({ symbol, payWithSymbol, payAmount });
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from '@solana/web3.js';
import {
  Program,
  AnchorProvider,
  BN,
  Idl,
  web3,
} from '@coral-xyz/anchor';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

import IDL from '../target/idl/sona.json';

// ─── Scaling constants (must match state.rs) ──────────────────────────────────
export const QUANTITY_SCALE = 1_000_000;
export const PRICE_SCALE = 1_000_000;

// ─── PDA helpers ──────────────────────────────────────────────────────────────
export function configPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
}

export function usdcVaultPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([Buffer.from('usdc_vault')], programId);
}

export function portfolioPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('portfolio'), authority.toBuffer()],
    programId
  );
}

export function positionPda(
  authority: PublicKey,
  symbol: string,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), authority.toBuffer(), Buffer.from(symbol)],
    programId
  );
}

// ─── Types mirroring contractService.js call shapes ───────────────────────────
export interface BuyAssetParams {
  symbol: string;
  payWithSymbol: 'USDC' | 'SOL';
  payAmount: number;   // human-readable (e.g. 50 for $50 USDC)
  assetPrice: number;  // USD (e.g. 182.50)
  solPriceUsd?: number; // needed when payWithSymbol = 'SOL'
}

export interface SellAssetParams {
  symbol: string;
  quantity: number;          // human-readable (e.g. 1.5 for 1.5 shares)
  assetPrice: number;        // USD
  receiveWithSymbol: 'USDC' | 'SOL';
  receivePriceUsd?: number;
}

export interface SwapAssetParams {
  fromSymbol: string;
  fromAmount: number;  // human-readable
  fromPrice: number;   // USD
  toSymbol: string;
  toPrice: number;     // USD
}

export interface TransferTokenParams {
  symbol: string;       // 'USDC' | 'SOL' | other SPL
  amount: number;       // human-readable
  recipient: string;    // base58 public key
  usdcMint?: string;    // override if not standard USDC
}

// ─── SDK class ────────────────────────────────────────────────────────────────
export class SonaSDK {
  program: Program;
  connection: Connection;
  provider: AnchorProvider;
  programId: PublicKey;

  /** USDC mint pubkey. Mainnet default. */
  usdcMint: PublicKey;

  constructor(
    programIdString: string,
    connection: Connection,
    wallet: any, // AnchorWallet from @solana/wallet-adapter-react
    usdcMintString?: string
  ) {
    this.programId = new PublicKey(programIdString);
    this.connection = connection;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    this.program = new Program(IDL as any, this.programId, this.provider);

    // USDC mint is network-specific; pass it in or fall back to devnet default
    const defaultUsdc = (import.meta as any).env?.VITE_SOLANA_NETWORK === 'mainnet-beta'
      ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
      : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
    this.usdcMint = new PublicKey(usdcMintString || defaultUsdc);
  }

  // ── Portfolio setup ────────────────────────────────────────────────────────

  /** Initialize the user's Portfolio PDA. Only needed once per wallet. */
  async initializePortfolio(): Promise<string> {
    const authority = this.provider.wallet.publicKey;
    const [portfolio] = portfolioPda(authority, this.programId);

    const existing = await this.connection.getAccountInfo(portfolio);
    if (existing) return 'already-initialized';

    const tx = await this.program.methods
      .initializePortfolio()
      .accounts({
        authority,
        portfolio,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tx;
  }

  // ── Buy ────────────────────────────────────────────────────────────────────

  async buyAsset(params: BuyAssetParams): Promise<string> {
    const { symbol, payWithSymbol, payAmount, assetPrice, solPriceUsd = 1 } = params;
    const authority = this.provider.wallet.publicKey;
    const [config] = configPda(this.programId);
    const [portfolio] = portfolioPda(authority, this.programId);
    const [position] = positionPda(authority, symbol, this.programId);
    const [usdcVault] = usdcVaultPda(this.programId);

    const payWithUsdc = payWithSymbol === 'USDC';

    // Convert human-readable amounts → native units
    const payAmountNative = payWithUsdc
      ? Math.round(payAmount * 1_000_000)       // USDC: 6 dec
      : Math.round(payAmount * 1_000_000_000);  // SOL: 9 dec (lamports)

    const assetPriceScaled = Math.round(assetPrice * PRICE_SCALE);
    const payAssetPriceScaled = payWithUsdc
      ? PRICE_SCALE                              // $1.00
      : Math.round(solPriceUsd * PRICE_SCALE);

    const userUsdcAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      authority
    );

    const tx = await this.program.methods
      .buyAsset(
        symbol,
        payWithUsdc,
        new BN(payAmountNative),
        new BN(assetPriceScaled),
        new BN(payAssetPriceScaled)
      )
      .accounts({
        authority,
        config,
        portfolio,
        position,
        userUsdcAccount: payWithUsdc ? userUsdcAccount : null,
        usdcVault: payWithUsdc ? usdcVault : null,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ── Sell ───────────────────────────────────────────────────────────────────

  async sellAsset(params: SellAssetParams): Promise<string> {
    const { symbol, quantity, assetPrice, receiveWithSymbol } = params;
    const authority = this.provider.wallet.publicKey;
    const [config] = configPda(this.programId);
    const [portfolio] = portfolioPda(authority, this.programId);
    const [position] = positionPda(authority, symbol, this.programId);
    const [usdcVault] = usdcVaultPda(this.programId);

    const quantityScaled = Math.round(quantity * QUANTITY_SCALE);
    const assetPriceScaled = Math.round(assetPrice * PRICE_SCALE);
    const receiveAssetPriceScaled = receiveWithSymbol === 'USDC' ? PRICE_SCALE : PRICE_SCALE;

    const userUsdcAccount = await getAssociatedTokenAddress(
      this.usdcMint,
      authority
    );

    // Look up the configured fee recipient from the Config account
    const configAccount = await this.program.account.config.fetch(config) as any;

    const tx = await this.program.methods
      .sellAsset(
        symbol,
        new BN(quantityScaled),
        new BN(assetPriceScaled),
        new BN(receiveAssetPriceScaled)
      )
      .accounts({
        authority,
        config,
        portfolio,
        position,
        usdcVault,
        userUsdcAccount,
        feeRecipient: configAccount.feeRecipient,
        feeRecipientTokenAccount: await getAssociatedTokenAddress(
          this.usdcMint,
          configAccount.feeRecipient
        ),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ── Swap ───────────────────────────────────────────────────────────────────

  async swapAsset(params: SwapAssetParams): Promise<string> {
    const { fromSymbol, fromAmount, fromPrice, toSymbol, toPrice } = params;
    const authority = this.provider.wallet.publicKey;
    const [config] = configPda(this.programId);
    const [portfolio] = portfolioPda(authority, this.programId);
    const [fromPosition] = positionPda(authority, fromSymbol, this.programId);
    const [toPosition] = positionPda(authority, toSymbol, this.programId);

    const fromAmountScaled = Math.round(fromAmount * QUANTITY_SCALE);
    const fromPriceScaled = Math.round(fromPrice * PRICE_SCALE);
    const toPriceScaled = Math.round(toPrice * PRICE_SCALE);

    const tx = await this.program.methods
      .swapAsset(
        fromSymbol,
        new BN(fromAmountScaled),
        new BN(fromPriceScaled),
        toSymbol,
        new BN(toPriceScaled)
      )
      .accounts({
        authority,
        config,
        portfolio,
        fromPosition,
        toPosition,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  // ── Transfer ───────────────────────────────────────────────────────────────

  async transferToken(params: TransferTokenParams): Promise<string> {
    const { symbol, amount, recipient } = params;
    const authority = this.provider.wallet.publicKey;
    const [config] = configPda(this.programId);
    const recipientPubkey = new PublicKey(recipient);

    if (symbol === 'SOL') {
      // Native SOL transfer
      const lamports = Math.round(amount * 1_000_000_000);
      const tx = await this.program.methods
        .transferSol(new BN(lamports))
        .accounts({
          authority,
          recipient: recipientPubkey,
          config,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      return tx;
    }

    // SPL token transfer
    const mint = this.usdcMint; // extend for other tokens as needed
    const amountNative = Math.round(amount * 1_000_000); // assumes 6 decimals

    const senderTokenAccount = await getAssociatedTokenAddress(mint, authority);
    const recipientTokenAccount = await getAssociatedTokenAddress(
      mint,
      recipientPubkey
    );

    const tx = await this.program.methods
      .transferToken(new BN(amountNative))
      .accounts({
        authority,
        config,
        tokenMint: mint,
        senderTokenAccount,
        recipientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return tx;
  }

  // ── Read-only helpers ──────────────────────────────────────────────────────

  /** Fetch all Position accounts for a wallet. */
  async getPortfolio(
    walletAddress: string
  ): Promise<{ symbol: string; quantity: number; avgPrice: number }[]> {
    const authority = new PublicKey(walletAddress);
    const positions = await this.program.account.position.all([
      {
        memcmp: {
          offset: 8, // skip discriminator
          bytes: authority.toBase58(),
        },
      },
    ]);

    return positions.map((p: any) => ({
      symbol: p.account.symbolAsStr(),
      quantity: p.account.quantity.toNumber() / QUANTITY_SCALE,
      avgPrice: p.account.avgPrice.toNumber() / PRICE_SCALE,
    }));
  }

  /** Fetch a single position. Returns null if the account doesn't exist. */
  async getAssetBalance(
    walletAddress: string,
    symbol: string
  ): Promise<number | null> {
    try {
      const [positionPubkey] = positionPda(
        new PublicKey(walletAddress),
        symbol,
        this.programId
      );
      const pos = await this.program.account.position.fetch(positionPubkey) as any;
      return pos.quantity.toNumber() / QUANTITY_SCALE;
    } catch {
      return null;
    }
  }

  /** Get the transaction status from the RPC. */
  async getTransactionStatus(signature: string) {
    const status = await this.connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });
    return status?.value;
  }
}
