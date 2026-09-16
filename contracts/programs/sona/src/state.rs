use anchor_lang::prelude::*;

// ─── Scaling constants ────────────────────────────────────────────────────────
/// Quantity scaling factor: 1 unit of any asset = 1_000_000 (supports 6 decimal
/// fractional shares, e.g. 0.000001 AAPL = 1 raw quantity unit).
pub const QUANTITY_SCALE: u64 = 1_000_000;

/// Price scaling factor: $1.00 = 1_000_000 raw price units.
/// $182.50 → 182_500_000. Matches the convention used by Pyth oracle feeds.
pub const PRICE_SCALE: u64 = 1_000_000;

/// Fee in basis points (1 bp = 0.01%). 25 bps = 0.25% — matches FEE_RATE in
/// the frontend's transactionService.js.
pub const DEFAULT_FEE_BPS: u64 = 25;

pub const MAX_SYMBOL_LEN: usize = 10;

// ─── Config ───────────────────────────────────────────────────────────────────
/// Singleton program configuration. PDA seeds: [b"config"].
/// Initialized once by the deployer; only the authority can update it.
#[account]
pub struct Config {
    /// The deployer / admin address. Required to call admin instructions.
    pub authority: Pubkey,
    /// Where platform fees are transferred on each trade.
    pub fee_recipient: Pubkey,
    /// Trading fee in basis points (e.g. 25 = 0.25%).
    pub fee_bps: u64,
    /// The USDC SPL mint. Mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    pub usdc_mint: Pubkey,
    pub bump: u8,
    /// Hard-pauses all buy/sell/swap instructions when true (emergency brake).
    pub paused: bool,
}

impl Config {
    pub const SPACE: usize = 8  // discriminator
        + 32  // authority
        + 32  // fee_recipient
        + 8   // fee_bps
        + 32  // usdc_mint
        + 1   // bump
        + 1;  // paused
}

// ─── Portfolio ────────────────────────────────────────────────────────────────
/// One Portfolio per user wallet. PDA seeds: [b"portfolio", authority].
/// Tracks the number of open positions so the frontend can enumerate them.
#[account]
pub struct Portfolio {
    pub authority: Pubkey,
    pub bump: u8,
    /// How many Position accounts this user currently has open.
    pub position_count: u8,
    /// Cumulative USDC deposited (native units, 6 decimals) — informational.
    pub total_deposited_usdc: u64,
}

impl Portfolio {
    pub const SPACE: usize = 8 + 32 + 1 + 1 + 8;
}

// ─── Position ─────────────────────────────────────────────────────────────────
/// One Position per user per asset symbol.
/// PDA seeds: [b"position", authority, symbol_bytes].
///
/// For stocks (AAPL, MSFT, …): a synthetic position — the user's USDC/SOL
/// collateral is held in the program's USDC vault and the Position account
/// records the quantity and average purchase price.
///
/// For crypto tokens (SOL, USDC, …): also recorded here for portfolio display,
/// though the actual tokens live in standard SPL token accounts (see
/// transfer_token instruction for real movements).
#[account]
pub struct Position {
    pub authority: Pubkey,
    /// ASCII symbol, null-padded to MAX_SYMBOL_LEN bytes (e.g. "AAPL\0\0\0\0\0\0").
    pub symbol: [u8; MAX_SYMBOL_LEN],
    /// Fractional units held, scaled by QUANTITY_SCALE (1_000_000).
    /// 1.5 shares of AAPL → quantity = 1_500_000.
    pub quantity: u64,
    /// Volume-weighted average purchase price, scaled by PRICE_SCALE.
    /// avg $182.50 → avg_price = 182_500_000.
    pub avg_price: u64,
    pub bump: u8,
}

impl Position {
    pub const SPACE: usize = 8       // discriminator
        + 32                          // authority
        + MAX_SYMBOL_LEN              // symbol
        + 8                           // quantity
        + 8                           // avg_price
        + 1;                          // bump

    pub fn symbol_as_str(&self) -> &str {
        let end = self
            .symbol
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(MAX_SYMBOL_LEN);
        std::str::from_utf8(&self.symbol[..end]).unwrap_or("")
    }

    /// Write a symbol string into the fixed-size array.
    pub fn set_symbol(&mut self, symbol: &str) -> Result<()> {
        let bytes = symbol.as_bytes();
        require!(
            bytes.len() <= MAX_SYMBOL_LEN,
            crate::errors::SonaError::SymbolTooLong
        );
        self.symbol = [0u8; MAX_SYMBOL_LEN];
        self.symbol[..bytes.len()].copy_from_slice(bytes);
        Ok(())
    }

    /// Update quantity and recompute volume-weighted average price after a buy.
    pub fn add_to_position(&mut self, new_qty: u64, new_price: u64) -> Result<()> {
        // avg = (old_qty * old_avg + new_qty * new_price) / (old_qty + new_qty)
        let old_cost = (self.quantity as u128)
            .checked_mul(self.avg_price as u128)
            .ok_or(crate::errors::SonaError::Overflow)?;
        let new_cost = (new_qty as u128)
            .checked_mul(new_price as u128)
            .ok_or(crate::errors::SonaError::Overflow)?;
        let total_qty = (self.quantity as u128)
            .checked_add(new_qty as u128)
            .ok_or(crate::errors::SonaError::Overflow)?;
        let total_cost = old_cost
            .checked_add(new_cost)
            .ok_or(crate::errors::SonaError::Overflow)?;

        self.quantity = total_qty as u64;
        self.avg_price = if total_qty > 0 {
            (total_cost / total_qty) as u64
        } else {
            0
        };
        Ok(())
    }

    /// Reduce quantity after a sell. Returns the cost basis released (for P&L).
    pub fn reduce_position(&mut self, sell_qty: u64) -> Result<u64> {
        require!(
            self.quantity >= sell_qty,
            crate::errors::SonaError::InsufficientBalance
        );
        let cost_basis = (sell_qty as u128)
            .checked_mul(self.avg_price as u128)
            .ok_or(crate::errors::SonaError::Overflow)? as u64;
        self.quantity = self
            .quantity
            .checked_sub(sell_qty)
            .ok_or(crate::errors::SonaError::Overflow)?;
        Ok(cost_basis)
    }
}
