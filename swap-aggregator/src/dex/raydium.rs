//! Instruction types

#![allow(clippy::too_many_arguments)]

use solana_program::{
  instruction::{AccountMeta, Instruction},
  program_error::ProgramError,
  pubkey::Pubkey,
};
use std::mem::size_of;

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct InitializeInstruction {
  pub nonce: u8,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct MonitorStepInstruction {
  pub plan_order_limit: u16,
  pub place_order_limit: u16,
  pub cancel_order_limit: u16,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct DepositInstruction {
  pub max_coin_amount: u64,
  pub max_pc_amount: u64,
  pub base_side: u64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct WithdrawInstruction {
  pub amount: u64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct WithdrawTransferInstruction {
  pub limit: u16,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct WithdrawSrmInstruction {
  pub amount: u64,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct SwapInstruction {
  pub amount_in: u64,
  pub minimum_amount_out: u64,
}

#[repr(C)]
#[derive(Clone, Debug, PartialEq)]
pub enum AmmInstruction {
    ///   Initializes a new AmmInfo.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable, signer]` New amm Account to create.
    ///   2. `[]` $authority derived from `create_program_address(&[amm Account])`
    ///   3. `[]` amm open_orders Account
    ///   4. `[writable]` pool lp mint address. Must be empty, owned by $authority.
    ///   5. `[]` coin mint address
    ///   6. `[]` pc mint address
    ///   7. `[]` pool_token_coin Account. Must be non zero, owned by $authority.
    ///   8. `[]` pool_token_pc Account. Must be non zero, owned by $authority.
    ///   9. '[writable]` withdraw queue Account. To save withdraw dest_coin & dest_pc account with must cancle orders.
    ///   10. `[writable]` token_dest_lp Account. To deposit the initial pool token supply, user is the owner.
    ///   11. `[writable]` token_temp_lp Account. To save withdraw lp with must cancle orders as temp to transfer later.
    ///   12. `[]` serum dex program id
    ///   13. `[]` serum market Account. serum_dex program is the owner.
    Initialize(InitializeInstruction),

    ///   Continue Initializes the new AmmInfo.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[]` Rent program id
    ///   2. `[writable, signer]` Continue to init amm Account.
    ///   3. `[]` $authority derived from `create_program_address(&[amm Account])`
    ///   4. `[writable]` amm open_orders Account
    ///   5. `[writable]` pool_token_coin Account. Must be non zero, owned by $authority.
    ///   6. `[writable]` pool_token_pc Account. Must be non zero, owned by $authority.
    ///   7. `[writable]` amm target_orders Account. To store plan orders infomations.
    ///   8. `[]` serum dex program id
    ///   9. `[writable]` serum market Account. serum_dex program is the owner.
    ///   10. `[writable]` coin_vault Account
    ///   11. `[writable]` pc_vault Account
    ///   12. '[writable]` req_q Account
    ///   13. `[writable]` event_q Account
    ///   14. `[writable]` bids Account
    ///   15. `[writable]` asks Account
    Initialize2,

    ///   MonitorStep. To monitor state turn around step by step.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[]` Spl Rent id
    ///   2. `[]` Spl Clock id
    ///   3. `[writable]`amm Account
    ///   4. `[]` $authority derived from `create_program_address(&[amm Account])`
    ///   5. `[writable]` amm open_orders Account
    ///   6. `[writable]` amm target_orders Account. To store plan orders infomations.
    ///   7. `[writable]` pool_token_coin Account. Must be non zero, owned by $authority.
    ///   8. `[writable]` pool_token_pc Account. Must be non zero, owned by $authority.
    ///   9. '[writable]` withdraw queue Account. To save withdraw dest_coin & dest_pc account with must cancle orders.
    ///   10. `[]` serum dex program id
    ///   11. `[writable]` serum market Account. serum_dex program is the owner.
    ///   12. `[writable]` coin_vault Account
    ///   13. `[writable]` pc_vault Account
    ///   14. '[]` vault_signer Account
    ///   15. '[writable]` req_q Account
    ///   16. `[writable]` event_q Account
    ///   17. `[writable]` bids Account
    ///   18. `[writable]` asks Account
    ///   19. `[writable]` (optional) the (M)SRM account used for fee discounts
    MonitorStep(MonitorStepInstruction),

    ///   Deposit some tokens into the pool.  The output is a "pool" token representing ownership
    ///   into the pool. Inputs are converted to the current ratio.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable]` amm Account
    ///   2. `[]` $authority
    ///   3. `[]` amm open_orders Account
    ///   4. `[writable]` amm target_orders Account. To store plan orders infomations.
    ///   5. `[writable]` pool lp mint address. Must be empty, owned by $authority.
    ///   6. `[writable]` pool_token_coin $authority can transfer amount,
    ///   7. `[writable]` pool_token_pc $authority can transfer amount,
    ///   8. `[]` serum market Account. serum_dex program is the owner.
    ///   9. `[writable]` user coin token Base Account to deposit into.
    ///   10. `[writable]` user pc token Base Account to deposit into.
    ///   11. `[writable]` user lp token. To deposit the generated tokens, user is the owner.
    ///   12. '[signer]` user owner Account
    Deposit(DepositInstruction),

    ///   Withdraw the token from the pool at the current ratio.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable]` amm Account
    ///   2. `[]` $authority
    ///   3. `[writable]` amm open_orders Account
    ///   4. `[writable]` amm target_orders Account
    ///   5. `[writable]` pool lp mint address. Must be empty, owned by $authority.
    ///   6. `[writable]` pool_token_coin Amm Account to withdraw FROM,
    ///   7. `[writable]` pool_token_pc Amm Account to withdraw FROM,
    ///   8. `[writable]` withdraw queue Account
    ///   9. `[writable]` token_temp_lp Account
    ///   10. `[]` serum dex program id
    ///   11. `[writable]` serum market Account. serum_dex program is the owner.
    ///   12. `[writable]` coin_vault Account
    ///   13. `[writable]` pc_vault Account
    ///   14. '[]` vault_signer Account
    ///   15. `[writable]` user lp token Account. Source lp, amount is transferable by $authority.
    ///   16. `[writable]` user token coin Account. user Account to credit.
    ///   17. `[writable]` user token pc Account. user Account to credit.
    ///   18. `[singer]` user owner Account
    Withdraw(WithdrawInstruction),

    ///   Withdraw the token from the temp_pool at the current ratio.
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable]` amm Account
    ///   2. `[]` $authority
    ///   3. `[writable]` amm open_orders Account
    ///   4. `[writable]` pool lp mint address. Must be empty, owned by $authority.
    ///   5. `[writable]` pool_token_coin Amm Account to withdraw FROM,
    ///   6. `[writable]` pool_token_pc Amm Account to withdraw FROM,
    ///   7. `[writable]` withdraw queue Account
    ///   8. `[writable]` token_temp_lp Account
    ///   9. `[]` serum dex program id
    ///   10. `[writable]` serum market Account. serum_dex program is the owner.
    ///   11. `[writable]` coin_vault Account
    ///   12. `[writable]` pc_vault Account
    ///   13. '[]` vault_signer Account
    WithdrawTransfer(WithdrawTransferInstruction),

    ///   Set amm params
    ///
    ///   0. `[writable]` amm Account.
    ///   1. `[]` $authority derived from `create_program_address(&[amm Account])`
    ///   2. `[singer]` amm Account owner
    ///   3. `[]` (optional) the account to replace owner
    // SetParams(SetParamsInstruction),

    ///   Withdraw Pnl from pool
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable]` amm Account
    ///   2. `[]` $authority
    ///   3. `[writable]` amm open_orders Account
    ///   4. `[writable]` pool_token_coin Amm Account to withdraw FROM,
    ///   5. `[writable]` pool_token_pc Amm Account to withdraw FROM,
    ///   6. `[writable]` coin pnl token Account to withdraw to
    ///   7. `[writable]` pc pnl token Account to withdraw to
    ///   8. `[singer]` pnl account owner
    ///   9. `[writable]` amm target_orders Account
    ///   10. `[]` serum dex program id
    ///   11. `[writable]` serum market Account. serum_dex program is the owner.
    ///   12. `[writable]` coin_vault Account
    ///   13. `[writable]` pc_vault Account
    ///   14. '[]` vault_signer Account
    WithdrawPnl,

    ///   Withdraw (M)SRM from the (M)SRM Account used for fee discounts
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[]` amm Account.
    ///   2. `[singer]` amm Account owner
    ///   3. `[]` $authority derived from `create_program_address(&[amm Account])`
    ///   4. `[writable]` the (M)SRM Account withdraw from
    ///   5. `[writable]` the (M)SRM Account withdraw to
    WithdrawSrm(WithdrawSrmInstruction),

    /// Swap coin or pc from pool
    ///
    ///   0. `[]` Spl Token program id
    ///   1. `[writable]` amm Account
    ///   2. `[]` $authority
    ///   3. `[writable]` amm open_orders Account
    ///   4. `[writable]` amm target_orders Account
    ///   5. `[writable]` pool_token_coin Amm Account to swap FROM or To,
    ///   6. `[writable]` pool_token_pc Amm Account to swap FROM or To,
    ///   7. `[]` serum dex program id
    ///   8. `[writable]` serum market Account. serum_dex program is the owner.
    ///   9. `[writable]` bids Account
    ///   10. `[writable]` asks Account
    ///   11. `[writable]` event_q Account
    ///   12. `[writable]` coin_vault Account
    ///   13. `[writable]` pc_vault Account
    ///   14. '[]` vault_signer Account
    ///   15. `[writable]` user source token Account. user Account to swap from.
    ///   16. `[writable]` user destination token Account. user Account to swap to.
    ///   17. `[singer]` user owner Account
    Swap(SwapInstruction),

    PreInitialize(InitializeInstruction),
}

impl AmmInstruction {
  /// Packs a [AmmInstruction](enum.AmmInstruction.html) into a byte buffer.
  pub fn pack(&self) -> Result<Vec<u8>, ProgramError> {
    let mut buf = Vec::with_capacity(size_of::<Self>());

    match &*self {
      Self::Initialize(
        InitializeInstruction {nonce}
      ) => {
        buf.push(0);
        buf.push(*nonce);
      }
      Self::Initialize2 => {
        buf.push(1);
      }
      Self::MonitorStep(MonitorStepInstruction { plan_order_limit, place_order_limit, cancel_order_limit }) => {
        buf.push(2);
        buf.extend_from_slice(&plan_order_limit.to_le_bytes());
        buf.extend_from_slice(&place_order_limit.to_le_bytes());
        buf.extend_from_slice(&cancel_order_limit.to_le_bytes());
      }
      Self::Deposit(DepositInstruction {max_coin_amount, max_pc_amount, base_side}) => {
        buf.push(3);
        buf.extend_from_slice(&max_coin_amount.to_le_bytes());
        buf.extend_from_slice(&max_pc_amount.to_le_bytes());
        buf.extend_from_slice(&base_side.to_le_bytes());
      }
      Self::Withdraw(WithdrawInstruction{amount}) => {
        buf.push(4);
        buf.extend_from_slice(&amount.to_le_bytes());
      }
      Self::WithdrawTransfer(WithdrawTransferInstruction{limit}) => {
        buf.push(5);
        buf.extend_from_slice(&limit.to_le_bytes());
      }
      Self::WithdrawPnl => {
        buf.push(7);
      }
      Self::WithdrawSrm(WithdrawSrmInstruction{ amount }) => {
        buf.push(8);
        buf.extend_from_slice(&amount.to_le_bytes());
      }
      Self::Swap(SwapInstruction{amount_in, minimum_amount_out}) => {
        buf.push(9);
        buf.extend_from_slice(&amount_in.to_le_bytes());
        buf.extend_from_slice(&minimum_amount_out.to_le_bytes());
      }
      Self::PreInitialize(
        InitializeInstruction { nonce }
      ) => {
        buf.push(10);
        buf.push(*nonce);
      }
    }
    Ok(buf)
  }
}

/// Creates a 'swap' instruction.
pub fn swap(
  program_id: &Pubkey,
  amm_id: &Pubkey,
  amm_authority: &Pubkey,
  amm_open_orders: &Pubkey,
  amm_target_orders: &Pubkey,
  pool_coin_token_account: &Pubkey,
  pool_pc_token_account: &Pubkey,
  serum_program_id: &Pubkey,
  serum_market: &Pubkey,
  serum_bids: &Pubkey,
  serum_asks: &Pubkey,
  serum_event_queue: &Pubkey,
  serum_coin_vault_account: &Pubkey,
  serum_pc_vault_account: &Pubkey,
  serum_vault_signer: &Pubkey,
  uer_source_token_account: &Pubkey,
  uer_destination_token_account: &Pubkey,
  user_source_owner: &Pubkey,
  
  amount_in: u64,
  minimum_amount_out: u64,
) -> Result<Instruction, ProgramError> {
  let data = AmmInstruction::Swap(SwapInstruction { amount_in, minimum_amount_out }).pack()?;

  let accounts = vec![
    // spl token
    AccountMeta::new_readonly(spl_token::id(), false),
    // amm
    AccountMeta::new(*amm_id, false),
    AccountMeta::new_readonly(*amm_authority, false),
    AccountMeta::new(*amm_open_orders, false),
    AccountMeta::new(*amm_target_orders, false),
    AccountMeta::new(*pool_coin_token_account, false),
    AccountMeta::new(*pool_pc_token_account, false),
    // serum
    AccountMeta::new_readonly(*serum_program_id, false),
    AccountMeta::new(*serum_market, false),
    AccountMeta::new(*serum_bids, false),
    AccountMeta::new(*serum_asks, false),
    AccountMeta::new(*serum_event_queue, false),
    AccountMeta::new(*serum_coin_vault_account, false),
    AccountMeta::new(*serum_pc_vault_account, false),
    AccountMeta::new_readonly(*serum_vault_signer, false),
    // user
    AccountMeta::new(*uer_source_token_account, false),
    AccountMeta::new(*uer_destination_token_account, false),
    AccountMeta::new_readonly(*user_source_owner, true),
  ];

  Ok(Instruction {
    program_id: *program_id,
    accounts,
    data,
  })
}

pub fn unpack<T>(input: &[u8]) -> Result<&T, ProgramError> {
  if input.len() < size_of::<u8>() + size_of::<T>() {
    return Err(ProgramError::InvalidAccountData);
  }

  #[allow(clippy::cast_ptr_alignment)]
  let val: &T = unsafe { &*(&input[1] as *const u8 as *const T)};
  Ok(val)
}
