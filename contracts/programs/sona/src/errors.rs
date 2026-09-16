use anchor_lang::prelude::*;

#[error_code]
pub enum SonaError {
    #[msg("Symbol exceeds 10-byte maximum")]
    SymbolTooLong,

    #[msg("Insufficient balance for this operation")]
    InsufficientBalance,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Price must be greater than zero")]
    InvalidPrice,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Program is paused — try again later")]
    Paused,

    #[msg("Symbol on position account does not match instruction symbol")]
    SymbolMismatch,

    #[msg("Cannot swap an asset for itself")]
    SameAsset,

    #[msg("Unauthorized: caller is not the program authority")]
    Unauthorized,

    #[msg("USDC mint does not match the configured mint")]
    WrongMint,
}
