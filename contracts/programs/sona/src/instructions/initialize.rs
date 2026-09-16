use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::{Config, Portfolio, DEFAULT_FEE_BPS};
use crate::errors::SonaError;

// ─── Initialize Config (admin, one-time) ─────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Config::SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    /// USDC mint (Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v).
    pub usdc_mint: Account<'info, Mint>,

    /// The program-owned USDC vault that holds collateral for synthetic positions.
    /// PDA seeds: [b"usdc_vault"]. Owned by the program via `authority = config`.
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = config,
        seeds = [b"usdc_vault"],
        bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    /// Where trading fees are sent. Can be a regular wallet or a fee-collector PDA.
    /// CHECK: this is just stored as a pubkey; no on-chain validation needed.
    pub fee_recipient: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_config(
    ctx: Context<InitializeConfig>,
    fee_bps: Option<u64>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.fee_recipient = ctx.accounts.fee_recipient.key();
    config.fee_bps = fee_bps.unwrap_or(DEFAULT_FEE_BPS);
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.bump = ctx.bumps.config;
    config.paused = false;
    Ok(())
}

// ─── Update Config (admin only) ───────────────────────────────────────────────

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ SonaError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

pub fn update_config(
    ctx: Context<UpdateConfig>,
    fee_bps: Option<u64>,
    paused: Option<bool>,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    if let Some(bps) = fee_bps {
        config.fee_bps = bps;
    }
    if let Some(p) = paused {
        config.paused = p;
    }
    Ok(())
}

// ─── Initialize Portfolio (per user) ─────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePortfolio<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Portfolio::SPACE,
        seeds = [b"portfolio", authority.key().as_ref()],
        bump,
    )]
    pub portfolio: Account<'info, Portfolio>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_portfolio(ctx: Context<InitializePortfolio>) -> Result<()> {
    let portfolio = &mut ctx.accounts.portfolio;
    portfolio.authority = ctx.accounts.authority.key();
    portfolio.bump = ctx.bumps.portfolio;
    portfolio.position_count = 0;
    portfolio.total_deposited_usdc = 0;
    Ok(())
}
