/// sell_asset — close or reduce a synthetic position and return USDC/SOL to the user.
///
/// The Position quantity is reduced, and the proportional collateral is released
/// from the program's USDC vault back to the user's token account (minus fee).
///
/// Price oracle: same caveat as buy_asset — replace `asset_price` and
/// `receive_asset_price` with Pyth feed accounts in production.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Config, Portfolio, Position, PRICE_SCALE, QUANTITY_SCALE};
use crate::errors::SonaError;

#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct SellAsset<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"portfolio", authority.key().as_ref()],
        bump = portfolio.bump,
        has_one = authority,
    )]
    pub portfolio: Account<'info, Portfolio>,

    #[account(
        mut,
        seeds = [b"position", authority.key().as_ref(), symbol.as_bytes()],
        bump = position.bump,
        has_one = authority,
    )]
    pub position: Account<'info, Position>,

    /// Program's USDC vault (source of payout). Signed by Config PDA.
    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump,
        token::mint = config.usdc_mint,
        token::authority = config,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    /// User's USDC token account to receive the payout.
    #[account(
        mut,
        token::mint = config.usdc_mint,
        token::authority = authority,
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,

    /// Fee recipient receives the platform cut.
    /// CHECK: just a transfer destination; validated against config.fee_recipient.
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    /// Fee recipient's USDC token account.
    #[account(
        mut,
        token::mint = config.usdc_mint,
    )]
    pub fee_recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// * `symbol`               — uppercase asset symbol matching an open Position
/// * `quantity`             — units to sell (QUANTITY_SCALE-denominated)
/// * `asset_price`          — current asset price * PRICE_SCALE
/// * `receive_asset_price`  — price of the payout asset (USDC → PRICE_SCALE; SOL → current price)
pub fn sell_asset(
    ctx: Context<SellAsset>,
    symbol: String,
    quantity: u64,
    asset_price: u64,
    _receive_asset_price: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, SonaError::Paused);
    require!(quantity > 0, SonaError::InvalidAmount);
    require!(asset_price > 0, SonaError::InvalidPrice);
    require!(
        ctx.accounts.position.symbol_as_str() == symbol.as_str(),
        SonaError::SymbolMismatch
    );
    require!(
        ctx.accounts.position.quantity >= quantity,
        SonaError::InsufficientBalance
    );

    // ── 1. Gross USD value of the sale ────────────────────────────────────────
    // gross_usdc (6-dec native units) = quantity * asset_price / (QUANTITY_SCALE * PRICE_SCALE / 10^6)
    // Simplified: gross_usdc = quantity * asset_price / (QUANTITY_SCALE * PRICE_SCALE / 1_000_000)
    //                        = quantity * asset_price * 1_000_000 / (QUANTITY_SCALE * PRICE_SCALE)
    let gross_usdc: u64 = ((quantity as u128)
        .checked_mul(asset_price as u128)
        .ok_or(SonaError::Overflow)?
        .checked_mul(1_000_000u128)
        .ok_or(SonaError::Overflow)?
        / ((QUANTITY_SCALE as u128) * (PRICE_SCALE as u128))) as u64;

    // ── 2. Fee ────────────────────────────────────────────────────────────────
    let fee_usdc: u64 = ((gross_usdc as u128)
        .checked_mul(config.fee_bps as u128)
        .ok_or(SonaError::Overflow)?
        / 10_000u128) as u64;
    let net_usdc: u64 = gross_usdc
        .checked_sub(fee_usdc)
        .ok_or(SonaError::Overflow)?;

    require!(net_usdc > 0, SonaError::InvalidAmount);

    // ── 3. Transfer net payout from vault → user (Config PDA signs) ──────────
    let config_seeds: &[&[u8]] = &[b"config", &[config.bump]];
    let signer_seeds: &[&[&[u8]]] = &[config_seeds];

    let payout_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.usdc_vault.to_account_info(),
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(payout_ctx, net_usdc)?;

    // ── 4. Transfer fee from vault → fee recipient ────────────────────────────
    if fee_usdc > 0 {
        let fee_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.fee_recipient_token_account.to_account_info(),
                authority: ctx.accounts.config.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(fee_ctx, fee_usdc)?;
    }

    // ── 5. Reduce / close Position ────────────────────────────────────────────
    let position = &mut ctx.accounts.position;
    position.reduce_position(quantity)?;

    if position.quantity == 0 {
        ctx.accounts.portfolio.position_count = ctx
            .accounts
            .portfolio
            .position_count
            .saturating_sub(1);
        // The Position account can be closed by the caller to reclaim rent;
        // handled client-side with `anchor.close(authority)` on the account.
    }

    Ok(())
}
