/// swap_asset — exchange one asset position for another without moving USDC/SOL
/// out of the vault. The USD value of `from_amount` (at `from_price`) is used
/// to determine how many units of `to_symbol` the user receives (at `to_price`).
/// Fee is deducted from the USD value before the `to` quantity is calculated,
/// mirroring the frontend's SLIPPAGE + FEE handling in transactionService.swapAsset.
use anchor_lang::prelude::*;
use crate::state::{Config, Portfolio, Position, QUANTITY_SCALE};
use crate::errors::SonaError;

#[derive(Accounts)]
#[instruction(from_symbol: String, to_symbol: String)]
pub struct SwapAsset<'info> {
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

    /// The Position being reduced (from).
    #[account(
        mut,
        seeds = [b"position", authority.key().as_ref(), from_symbol.as_bytes()],
        bump = from_position.bump,
        has_one = authority,
    )]
    pub from_position: Account<'info, Position>,

    /// The Position being increased (to). Created if it doesn't exist yet.
    #[account(
        init_if_needed,
        payer = authority,
        space = Position::SPACE,
        seeds = [b"position", authority.key().as_ref(), to_symbol.as_bytes()],
        bump,
    )]
    pub to_position: Account<'info, Position>,

    pub system_program: Program<'info, System>,
}

/// * `from_symbol`  — symbol of the asset to swap away from
/// * `from_amount`  — units to swap (QUANTITY_SCALE-denominated)
/// * `from_price`   — current price of from-asset * PRICE_SCALE
/// * `to_symbol`    — symbol of the asset to swap into
/// * `to_price`     — current price of to-asset * PRICE_SCALE
pub fn swap_asset(
    ctx: Context<SwapAsset>,
    from_symbol: String,
    from_amount: u64,
    from_price: u64,
    to_symbol: String,
    to_price: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, SonaError::Paused);
    require!(from_symbol != to_symbol, SonaError::SameAsset);
    require!(from_amount > 0, SonaError::InvalidAmount);
    require!(from_price > 0, SonaError::InvalidPrice);
    require!(to_price > 0, SonaError::InvalidPrice);
    require!(
        ctx.accounts.from_position.symbol_as_str() == from_symbol.as_str(),
        SonaError::SymbolMismatch
    );
    require!(
        ctx.accounts.from_position.quantity >= from_amount,
        SonaError::InsufficientBalance
    );

    // ── 1. USD value of the from-side ─────────────────────────────────────────
    // usd_scaled = from_amount * from_price / QUANTITY_SCALE  (in PRICE_SCALE units)
    let usd_scaled: u128 = (from_amount as u128)
        .checked_mul(from_price as u128)
        .ok_or(SonaError::Overflow)?
        / QUANTITY_SCALE as u128;

    // ── 2. Deduct fee ─────────────────────────────────────────────────────────
    let fee_scaled: u128 = usd_scaled
        .checked_mul(config.fee_bps as u128)
        .ok_or(SonaError::Overflow)?
        / 10_000;
    let net_usd_scaled: u128 = usd_scaled
        .checked_sub(fee_scaled)
        .ok_or(SonaError::Overflow)?;

    // ── 3. Calculate to-quantity ──────────────────────────────────────────────
    // to_quantity = net_usd_scaled * QUANTITY_SCALE / to_price
    let to_quantity: u64 = (net_usd_scaled
        .checked_mul(QUANTITY_SCALE as u128)
        .ok_or(SonaError::Overflow)?
        / to_price as u128) as u64;
    require!(to_quantity > 0, SonaError::InvalidAmount);

    // ── 4. Reduce from-position ───────────────────────────────────────────────
    let from_pos = &mut ctx.accounts.from_position;
    from_pos.reduce_position(from_amount)?;
    if from_pos.quantity == 0 {
        ctx.accounts.portfolio.position_count =
            ctx.accounts.portfolio.position_count.saturating_sub(1);
    }

    // ── 5. Increase to-position ───────────────────────────────────────────────
    let to_pos = &mut ctx.accounts.to_position;
    let is_new = to_pos.quantity == 0 && to_pos.authority == Pubkey::default();
    if is_new {
        to_pos.authority = ctx.accounts.authority.key();
        to_pos.set_symbol(&to_symbol)?;
        to_pos.quantity = to_quantity;
        to_pos.avg_price = to_price;
        to_pos.bump = ctx.bumps.to_position;
        ctx.accounts.portfolio.position_count = ctx
            .accounts
            .portfolio
            .position_count
            .checked_add(1)
            .ok_or(SonaError::Overflow)?;
    } else {
        require!(
            to_pos.symbol_as_str() == to_symbol.as_str(),
            SonaError::SymbolMismatch
        );
        to_pos.add_to_position(to_quantity, to_price)?;
    }

    Ok(())
}
