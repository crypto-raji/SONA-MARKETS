# Sona Smart Contract — Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 1.18+ | https://docs.solana.com/cli/install-solana-cli-tools |
| Anchor CLI | 0.30.1 | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.30.1 && avm use 0.30.1` |
| Node + Yarn | 18+ | https://nodejs.org |

---

## Step 1 — Build the program

```bash
cd contracts
anchor build
```

This generates:
- `target/deploy/sona.so` — the compiled program bytecode
- `target/idl/sona.json` — the IDL (needed by the TypeScript SDK)

## Step 2 — Get your program ID

```bash
anchor keys list
```

Copy the printed address (e.g. `AbcDef...`). Paste it in two places:

**contracts/programs/sona/src/lib.rs** line 1:
```rust
declare_id!("AbcDef...");
```

**contracts/Anchor.toml** under `[programs.mainnet]`:
```toml
sona = "AbcDef..."
```

Then rebuild:
```bash
anchor build
```

## Step 3 — Set up a deployer wallet

```bash
solana config set --url mainnet-beta
solana-keygen new --outfile ~/.config/solana/id.json   # skip if you already have one
```

## Step 4 — Deploy to Solana Mainnet

```bash
anchor deploy --provider.cluster mainnet-beta
```

Note the deployed program address.

## Step 5 — Initialize the program (one-time admin call)

```bash
# From the contracts/ directory:
yarn install   # installs @coral-xyz/anchor etc for tests
anchor run initialize
```

Or write a short initialize script:
```ts
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Sona } from './target/types/sona';

// ... (see tests/ directory for examples)
```

## Step 6 — Wire the frontend

In the project root `.env`:
```
VITE_TRADING_PROGRAM_ID_MAINNET=AbcDef...
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

In `contracts/sdk/sona-sdk.ts`, replace the TODO_IDL comment:
```ts
import IDL from '../target/idl/sona.json';
// ...
this.program = new Program(IDL, this.programId, this.provider);
```

In `src/services/contractService.js`, uncomment the SDK blocks marked
with `// Uncomment once SDK is wired up:`.

Install Solana packages in the project root:
```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

## Step 7 — Run the frontend

```bash
cd ..   # back to project root
npm run dev
```

---

## Account architecture

```
Config PDA         [b"config"]
  └─ fee_bps, fee_recipient, usdc_mint, paused

UsdcVault PDA      [b"usdc_vault"]
  └─ SPL token account holding all user collateral

Portfolio PDA      [b"portfolio", user_wallet]
  └─ position_count, total_deposited_usdc

Position PDA       [b"position", user_wallet, symbol]
  └─ symbol, quantity (×10⁶), avg_price (×10⁶)
```

## Production checklist

- [ ] Replace price params with verified Pyth oracle feed accounts in buy/sell
- [ ] Add a whitelist of allowed symbols in Config to prevent garbage symbols
- [ ] Add emergency-pause admin key rotation
- [ ] Audit fee math for rounding exploits
- [ ] Configure `VITE_TRADING_PROGRAM_ID_MAINNET` with the deployed program ID
- [ ] Write and run Anchor integration tests (`anchor test`)
