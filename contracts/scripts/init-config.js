/**
 * init-config.js
 * Run ONCE as the program authority to initialize the on-chain Config PDA.
 * After this runs, buyAsset / sellAsset / swapAsset will settle on-chain.
 *
 * Usage (from project root):
 *   node contracts/scripts/init-config.js
 *
 * Prerequisites:
 *   - Deployer keypair at ~/.config/solana/id.json  (the same key that deployed the program)
 *   - At least 0.01 SOL on devnet in that wallet for rent + fees
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { AnchorProvider, Program, Wallet, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const idlPrimary = path.join(__dirname, '../idl/sona.json');
const idlFallback = path.join(__dirname, '../target/idl/sona.json');
const IDL_PATH = fs.existsSync(idlPrimary) ? idlPrimary : idlFallback;

// ── Config ────────────────────────────────────────────────────────────────────

const PROGRAM_ID  = new PublicKey('9M6nZdegpRZWAsBKyJ8u5Dkh4XCrqv7TVHkjmKo6CXr1');
const RPC_URL     = 'https://api.devnet.solana.com';
const USDC_MINT   = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); // devnet USDC
const FEE_BPS     = new BN(10); // 0.10% fee

// ── Load deployer keypair ─────────────────────────────────────────────────────

const keypairPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
if (!fs.existsSync(keypairPath)) {
  console.error(`Keypair not found at ${keypairPath}`);
  console.error('Run: solana-keygen new --outfile ~/.config/solana/id.json');
  process.exit(1);
}
const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8')));
const deployer  = Keypair.fromSecretKey(secretKey);
console.log('Deployer:', deployer.publicKey.toBase58());

// ── Set up Anchor provider ────────────────────────────────────────────────────

const connection = new Connection(RPC_URL, 'confirmed');
const wallet     = new Wallet(deployer);
const provider   = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
const IDL        = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
const program    = new Program(IDL, provider);

// ── Derive PDAs ───────────────────────────────────────────────────────────────

const [configPda]   = PublicKey.findProgramAddressSync([Buffer.from('config')],    PROGRAM_ID);
const [usdcVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('usdc_vault')], PROGRAM_ID);

console.log('Config PDA:    ', configPda.toBase58());
console.log('USDC Vault PDA:', usdcVaultPda.toBase58());
console.log('Fee recipient: ', deployer.publicKey.toBase58());

// ── Check if already initialized ─────────────────────────────────────────────

try {
  const existing = await program.account.config.fetch(configPda);
  console.log('\n✅ Config already initialized!');
  console.log('   Authority:    ', existing.authority.toBase58());
  console.log('   Fee recipient:', existing.feeRecipient.toBase58());
  console.log('   Fee BPS:      ', existing.feeBps.toString());
  console.log('   USDC mint:    ', existing.usdcMint.toBase58());
  console.log('   Paused:       ', existing.paused);
  console.log('\nNothing to do — on-chain trades are ready.');
  process.exit(0);
} catch {
  console.log('\nConfig not yet initialized — creating now...');
}

// ── Call initializeConfig ─────────────────────────────────────────────────────

const tx = await program.methods
  .initializeConfig(FEE_BPS)
  .accounts({
    authority:    deployer.publicKey,
    config:       configPda,
    usdcMint:     USDC_MINT,
    usdcVault:    usdcVaultPda,
    feeRecipient: deployer.publicKey,   // fees go to the deployer wallet; change to a dedicated fee wallet if needed
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent:         SYSVAR_RENT_PUBKEY,
  })
  .rpc();

console.log('\n✅ Config initialized!');
console.log('   Transaction:', tx);
console.log('   Explorer:   https://explorer.solana.com/tx/' + tx + '?cluster=devnet');
console.log('\n🎉 On-chain trades are now active. buyAsset / sellAsset / swapAsset will settle on Solana.');
console.log('\nNext: set VITE_PLATFORM_FEE_RECIPIENT=' + deployer.publicKey.toBase58() + ' in your .env');
