/// Sona on-chain trading program.
///
/// Architecture overview
/// ─────────────────────
/// This program powers all blockchain operations for the Sona frontend. It
/// implements synthetic stock positions backed by USDC/SOL collateral held in
/// a program-owned vault, along with real SPL token transfers for crypto assets.
///
/// Accounts (PDAs)
/// ───────────────
///  Config        [b"config"]                              — singleton program config
///  UsdcVault     [b"usdc_vault"]                          — SPL token account for collateral
///  Portfolio     [b"portfolio", user]                     — per-user position registry
///  Position      [b"position", user, symbol]              — per-user per-asset holding
///
/// Instructions
/// ────────────
///  initialize_config(fee_bps?)     — admin: deploy config + vault (one-time)
///  update_config(fee_bps?, paused?)— admin: change fee or pause/unpause
///  initialize_portfolio()          — user: create their Portfolio PDA
///  buy_asset(...)                  — user: buy synthetic stock or register token holding
///  sell_asset(...)                 — user: sell synthetic stock, receive USDC/SOL
///  swap_asset(...)                 — user: exchange one position for another
///  transfer_token(amount)          — user: send SPL tokens to another wallet
///  transfer_sol(lamports)          — user: send native SOL to another wallet
///
/// Frontend seam
/// ─────────────
/// The TypeScript SDK in contracts/sdk/sona-sdk.ts wraps these instructions and
/// is imported by src/services/contractService.js to replace the stub implementations.
///
/// Oracle note
/// ───────────
/// v1 accepts asset prices as instruction parameters for simplicity. Before
/// mainnet: replace the `asset_price` / `pay_asset_price` params with verified
/// Pyth oracle feed accounts (pyth-sdk-solana crate) so callers cannot lie about
/// prices to extract collateral.
use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// ─── IMPORTANT ───────────────────────────────────────────────────────────────
// Replace this placeholder with the real program ID printed by `anchor deploy`.
// After deploying to mainnet run:
//   anchor keys list
// then paste the printed address into:
//   1. This declare_id! call
//   2. Anchor.toml [programs.mainnet] sona = "..."
//   3. .env VITE_TRADING_PROGRAM_ID_MAINNET
// ─────────────────────────────────────────────────────────────────────────────
// Temporary valid placeholder — replace with the real address after deploying.
// Run: anchor keys list   (after anchor build)
declare_id!("9M6nZdegpRZWAsBKyJ8u5Dkh4XCrqv7TVHkjmKo6CXr1");

#[program]
pub mod sona {
    use super::*;

    // ── Admin instructions ────────────────────────────────────────────────────

    /// One-time setup: creates the Config singleton and the USDC vault token
    /// account. Must be called by the deployer before any user can trade.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: Option<u64>,
    ) -> Result<()> {
        instructions::initialize::initialize_config(ctx, fee_bps)
    }

    /// Update fee rate or toggle the program pause. Authority only.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: Option<u64>,
        paused: Option<bool>,
    ) -> Result<()> {
        instructions::initialize::update_config(ctx, fee_bps, paused)
    }

    // ── User setup ────────────────────────────────────────────────────────────

    /// Create a Portfolio PDA for the calling wallet. Required before any
    /// buy/sell/swap call. Safe to call multiple times (init_if_needed not used
    /// here so the caller only pays rent once).
    pub fn initialize_portfolio(ctx: Context<InitializePortfolio>) -> Result<()> {
        instructions::initialize::initialize_portfolio(ctx)
    }

    // ── Trading instructions ──────────────────────────────────────────────────

    /// Buy a synthetic stock or record a crypto token position.
    /// Transfers USDC (or SOL) from the user's wallet into the program vault
    /// and creates / updates the Position PDA for `symbol`.
    ///
    /// Params
    ///   symbol            — e.g. "AAPL", "SOL", "USDC" (max 10 chars)
    ///   pay_with_usdc     — true = USDC payment; false = native SOL
    ///   pay_amount        — in native token units (USDC: 6 dec, SOL: lamports)
    ///   asset_price       — current price of `symbol` in USD * PRICE_SCALE
    ///   pay_asset_price   — USD price of the payment asset * PRICE_SCALE
    pub fn buy_asset(
        ctx: Context<BuyAsset>,
        symbol: String,
        pay_with_usdc: bool,
        pay_amount: u64,
        asset_price: u64,
        pay_asset_price: u64,
    ) -> Result<()> {
        instructions::buy_asset::buy_asset(
            ctx,
            symbol,
            pay_with_usdc,
            pay_amount,
            asset_price,
            pay_asset_price,
        )
    }

    /// Sell a synthetic stock position. Releases proportional USDC/SOL
    /// collateral from the vault back to the user (minus fee).
    ///
    /// Params
    ///   symbol               — asset symbol matching an open Position
    ///   quantity             — units to sell (QUANTITY_SCALE-denominated)
    ///   asset_price          — current asset price * PRICE_SCALE
    ///   receive_asset_price  — price of the payout asset * PRICE_SCALE
    pub fn sell_asset(
        ctx: Context<SellAsset>,
        symbol: String,
        quantity: u64,
        asset_price: u64,
        receive_asset_price: u64,
    ) -> Result<()> {
        instructions::sell_asset::sell_asset(
            ctx,
            symbol,
            quantity,
            asset_price,
            receive_asset_price,
        )
    }

    /// Swap one asset position for another without moving vault collateral.
    /// The USD value of `from_amount` (at `from_price`) minus fee determines
    /// how many units of `to_symbol` the user receives (at `to_price`).
    pub fn swap_asset(
        ctx: Context<SwapAsset>,
        from_symbol: String,
        from_amount: u64,
        from_price: u64,
        to_symbol: String,
        to_price: u64,
    ) -> Result<()> {
        instructions::swap_asset::swap_asset(
            ctx,
            from_symbol,
            from_amount,
            from_price,
            to_symbol,
            to_price,
        )
    }

    // ── Transfer instructions ─────────────────────────────────────────────────

    /// Send SPL tokens (USDC, wSOL, any SPL mint) from the caller to a recipient.
    pub fn transfer_token(ctx: Context<TransferToken>, amount: u64) -> Result<()> {
        instructions::transfer_token::transfer_token(ctx, amount)
    }

    /// Send native SOL (lamports) from the caller to any recipient.
    pub fn transfer_sol(ctx: Context<TransferSol>, lamports: u64) -> Result<()> {
        instructions::transfer_token::transfer_sol(ctx, lamports)
    }
}
