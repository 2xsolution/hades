use anchor_lang::prelude::*;
use anchor_spl::token::{self, TokenAccount, Token, Mint};
use anchor_spl::associated_token::AssociatedToken;
use crate::constants::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

mod constants {
    use anchor_lang::prelude::Pubkey;

    pub const ADMIN_KEY: Pubkey = anchor_lang::solana_program::pubkey!("5uKM4Kv4QbFopPRVfumHMpFUzQ9B2AuoLbsborDpK1gV"); 
    pub const HADES_KEY: Pubkey = anchor_lang::solana_program::pubkey!("BWXrrYFhT7bMHmNBFoQFWdsSgA3yXoAnMhDK6Fn1eSEn");
    pub const DECIMAL: u32 = 9;
    pub const STATISTIC_SEEDS: &str = "statistic";
    pub const POOL_SEEDS: &str = "pool";
}

#[program]
pub mod xhardes {
    use super::*;

    pub fn initialize(ctx: Context<InitializeContext>) -> Result<()> {
        let a_statistic = &mut ctx.accounts.statistic;

        a_statistic.total_xhades = 0.0;
        Ok(())
    }

    pub fn swap(ctx: Context<SwapContext>, amount: f64) -> Result<()> {
        let a_statistic = &mut ctx.accounts.statistic;
        let a_pool = &mut ctx.accounts.pool;
        let a_user = &ctx.accounts.user;
        let a_ata_from = &ctx.accounts.ata_from;
        let a_ata_to = &ctx.accounts.ata_to;
        let a_token_program = &ctx.accounts.token_program;

        let cpi_ctx = CpiContext::new(
            a_token_program.to_account_info(),
            token::Transfer {
                from: a_ata_from.to_account_info(),
                to: a_ata_to.to_account_info(),
                authority: a_user.to_account_info()
            }
        );

        token::transfer(cpi_ctx, (amount * (10 as u32).pow(DECIMAL) as f64) as u64)?;

        a_pool.balance += amount;
        a_statistic.total_xhades += amount;
        Ok(())
    }

}

#[derive(Accounts)]
pub struct InitializeContext<'info> {
    #[account(init, seeds = [STATISTIC_SEEDS.as_ref()], bump, payer = admin, space = 8 + 8)]
    pub statistic: Account<'info, Statistic>,
    #[account(mut, constraint = admin.key() == ADMIN_KEY)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct SwapContext<'info> {
    #[account(mut)]
    pub statistic: Account<'info, Statistic>,
    #[account(init_if_needed, seeds = [POOL_SEEDS.as_ref(), user.key().as_ref()], bump, payer = user, space = 8 + 32 + 8)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: it's not dangerous
    #[account(constraint = admin.key() == ADMIN_KEY)]
    pub admin: AccountInfo<'info>,
    #[account(constraint = mint.key() == HADES_KEY)]
    pub mint: Account<'info, Mint>,
    #[account(mut, constraint = ata_from.mint == mint.key() && ata_from.owner == user.key())]
    pub ata_from: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = admin
    )]
    pub ata_to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

#[account]
pub struct Statistic {
    pub total_xhades: f64
}

#[account]
pub struct Pool {
    pub user: Pubkey,
    pub balance: f64
}