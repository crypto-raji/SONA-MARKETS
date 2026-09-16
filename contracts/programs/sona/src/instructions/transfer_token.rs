/// transfer_token — send SPL tokens (USDC, SOL, etc.) directly between wallets.
///
/// This instruction wraps a standard SPL token transfer so it goes through the
/// Sona program for event logging and optional fee deduction. For native SOL
/// transfers, a separate `transfer_sol` instruction (system program CPI) would
/// be added; for simplicity v1 handles SPL tokens only.
///
/// The frontend's contractService.transferAsset({ symbol, amount, recipient })
/// should call this instruction for USDC and other SPL tokens on Solana. For
/// stocks (synthetic positions), transfer ownership by calling `transfer_position`
/// (a future instruction that re-keys a Position PDA to a new authority).
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::Config;
use crate::errors::SonaError;

#[derive(Accounts)]
pub struct TransferToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    pub token_mint: Account<'info, Mint>,

    /// Sender's token account (authority must match the signer).
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = authority,
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    /// Recipient's token account for the same mint.
    /// The recipient must have an Associated Token Account open beforehand
    /// (standard Solana requirement). The frontend can use
    /// @solana/spl-token's getOrCreateAssociatedTokenAccount before calling this.
    #[account(
        mut,
        token::mint = token_mint,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

/// * `amount` — amount in the token's native units (6 dec for USDC, 9 for SOL/wSOL).
pub fn transfer_token(ctx: Context<TransferToken>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, SonaError::Paused);
    require!(amount > 0, SonaError::InvalidAmount);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        },
    );
    token::transfer(cpi_ctx, amount)?;

    Ok(())
}

// ─── Native SOL transfer ──────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct TransferSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: destination wallet; validated only as an on-chain account.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

/// Transfer native SOL lamports from the caller to any recipient.
pub fn transfer_sol(ctx: Context<TransferSol>, lamports: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, SonaError::Paused);
    require!(lamports > 0, SonaError::InvalidAmount);
    require!(
        ctx.accounts.authority.lamports() >= lamports,
        SonaError::InsufficientBalance
    );

    let ix = anchor_lang::solana_program::system_instruction::transfer(
        &ctx.accounts.authority.key(),
        &ctx.accounts.recipient.key(),
        lamports,
    );
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[
            ctx.accounts.authority.to_account_info(),
            ctx.accounts.recipient.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    Ok(())
}
