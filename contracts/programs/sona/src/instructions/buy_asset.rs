/// buy_asset — buy a synthetic stock or register a crypto token position.
///
/// The user pays in USDC (SPL token) or SOL (native lamports). Their collateral
/// is transferred into the program's USDC vault (or a SOL lamport vault PDA),
/// and a Position PDA for the asset is created or updated.
///
/// Price oracle: v1 accepts prices as instruction params for simplicity. For
/// production, replace `asset_price` and `pay_asset_price` with verified Pyth
/// feed accounts (pyth-sdk-solana) so prices cannot be manipulated by the caller.
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use crate::state::{Config, Portfolio, Position, QUANTITY_SCALE};
use crate::errors::SonaError;

#[derive(Accounts)]
#[instruction(symbol: String)]
pub struct BuyAsset<'info> {
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

    /// The Position PDA for this (user, symbol) pair. Created if it doesn't
    /// exist yet (init_if_needed). Space is allocated for a new position.
    #[account(
        init_if_needed,
        payer = authority,
        space = Position::SPACE,
        seeds = [b"position", authority.key().as_ref(), symbol.as_bytes()],
        bump,
    )]
    pub position: Account<'info, Position>,

    // ── USDC payment path ────────────────────────────────────────────────────
    /// User's USDC token account (source). Leave as system program if paying SOL.
    #[account(
        mut,
        token::mint = config.usdc_mint,
        token::authority = authority,
    )]
    pub user_usdc_account: Option<Account<'info, TokenAccount>>,

    /// Program's USDC vault (destination for collateral).
    #[account(
        mut,
        seeds = [b"usdc_vault"],
        bump,
        token::mint = config.usdc_mint,
        token::authority = config,
    )]
    pub usdc_vault: Option<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// * `symbol`          — uppercase asset symbol, max 10 chars (e.g. "AAPL")
/// * `pay_with_usdc`   — true = pay in USDC; false = pay in native SOL
/// * `pay_amount`      — USDC amount in native units (6 dec) or SOL in lamports
/// * `asset_price`     — current asset price scaled by PRICE_SCALE ($182.50 → 182_500_000)
/// * `pay_asset_price` — price of the payment asset in USD (USDC = PRICE_SCALE exactly;
///                       SOL = current SOL/USD price * PRICE_SCALE)
pub fn buy_asset(
    ctx: Context<BuyAsset>,
    symbol: String,
    pay_with_usdc: bool,
    pay_amount: u64,
    asset_price: u64,
    pay_asset_price: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, SonaError::Paused);
    require!(pay_amount > 0, SonaError::InvalidAmount);
    require!(asset_price > 0, SonaError::InvalidPrice);
    require!(pay_asset_price > 0, SonaError::InvalidPrice);

    // ── 1. Calculate USD value of payment ────────────────────────────────────
    // pay_amount is in native token units (USDC: 6 dec, SOL: 9 dec).
    // Convert to a "price-scaled USD value" using pay_asset_price.
    // For USDC: pay_asset_price = PRICE_SCALE (1 USDC = $1.00).
    // For SOL:  pay_asset_price = current SOL/USD * PRICE_SCALE.
    //
    // usd_value (in PRICE_SCALE units) =
    //   pay_amount_in_price_scale * pay_asset_price / PRICE_SCALE
    //
    // We work in u128 to avoid overflow.
    let pay_decimals: u64 = if pay_with_usdc { 1_000_000 } else { 1_000_000_000 };
    let usd_value_scaled: u128 = (pay_amount as u128)
        .checked_mul(pay_asset_price as u128)
        .ok_or(SonaError::Overflow)?
        / (pay_decimals as u128);

    // ── 2. Deduct fee ─────────────────────────────────────────────────────────
    let fee_scaled: u128 = usd_value_scaled
        .checked_mul(config.fee_bps as u128)
        .ok_or(SonaError::Overflow)?
        / 10_000;
    let net_usd_scaled: u128 = usd_value_scaled
        .checked_sub(fee_scaled)
        .ok_or(SonaError::Overflow)?;

    // ── 3. Calculate quantity bought ─────────────────────────────────────────
    // quantity (QUANTITY_SCALE units) = net_usd_scaled * QUANTITY_SCALE / asset_price
    let quantity: u64 = (net_usd_scaled
        .checked_mul(QUANTITY_SCALE as u128)
        .ok_or(SonaError::Overflow)?
        / asset_price as u128) as u64;
    require!(quantity > 0, SonaError::InvalidAmount);

    // ── 4. Transfer payment from user → vault ─────────────────────────────────
    if pay_with_usdc {
        let user_account = ctx
            .accounts
            .user_usdc_account
            .as_ref()
            .ok_or(SonaError::InvalidAmount)?;
        let vault = ctx
            .accounts
            .usdc_vault
            .as_ref()
            .ok_or(SonaError::InvalidAmount)?;

        // Transfer collateral (full pay_amount — fee collected separately via
        // fee_recipient in a future iteration; for now kept in vault).
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: user_account.to_account_info(),
                to: vault.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, pay_amount)?;

        ctx.accounts.portfolio.total_deposited_usdc = ctx
            .accounts
            .portfolio
            .total_deposited_usdc
            .checked_add(pay_amount)
            .ok_or(SonaError::Overflow)?;
    } else {
        // SOL payment: transfer lamports to the vault PDA
        // The vault PDA here is the portfolio account itself (holds lamports).
        // For a dedicated SOL vault, replace with a separate lamport-holding PDA.
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.authority.key(),
            &ctx.accounts.portfolio.key(),
            pay_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.authority.to_account_info(),
                ctx.accounts.portfolio.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
    }

    // ── 5. Update / create Position PDA ─────────────────────────────────────
    let position = &mut ctx.accounts.position;
    let is_new = position.quantity == 0 && position.authority == Pubkey::default();

    if is_new {
        position.authority = ctx.accounts.authority.key();
        position.set_symbol(&symbol)?;
        position.quantity = quantity;
        position.avg_price = asset_price;
        position.bump = ctx.bumps.position;
        ctx.accounts.portfolio.position_count = ctx
            .accounts
            .portfolio
            .position_count
            .checked_add(1)
            .ok_or(SonaError::Overflow)?;
    } else {
        require!(
            position.symbol_as_str() == symbol.as_str(),
            SonaError::SymbolMismatch
        );
        position.add_to_position(quantity, asset_price)?;
    }

    Ok(())
}
