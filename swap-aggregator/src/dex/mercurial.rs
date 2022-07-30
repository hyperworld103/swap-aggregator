//! Instruction (De)serialization
//!
//! This module is responsible for
//! - converting incoming instruction data into a [SwapInstruction]
//! - converting a [SwapInstruction] into byte slices
//! - providing functions for downstream users to easily build [SwapInstruction]s

use solana_program::instruction::AccountMeta;
use solana_program::instruction::Instruction;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use std::convert::TryInto;
use std::mem::size_of;

pub struct PoolParameter {}

impl PoolParameter {
  /// Maximum number of coins in a pool
  pub const MAX_N_COINS: usize = 4;
}

// Instructions for the stable swap
#[repr(C)]
#[derive(Debug, PartialEq, Clone)]
pub enum SwapInstruction {
  /// Exchanges token[i] for token[y] from the stable swap
  /// 
  /// Accounts expected:
  /// 
  /// 0. `[]` The stable swap
  /// 1. `[]` Token program id
  /// 2. `[]` The $authority.
  /// 3. `[]` The user transfer authority
  /// 4. `[writable]` The token accounts of the swap state, owned by $authority depending on N_COINS
  /// 5. `[writable]` The source token account, owned by the LP, can be transferred by $authority
  /// 6. `[writable]` The destination token account, owned by the LP.
  /// 
  Exchange {
    in_amount: u64,
    minimum_out_amount: u64,
  },
}

impl SwapInstruction {
  /// Unpacks a byte buffer into a [SwapInstruction](enum.SwapInstruction.html).
  pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
    let (tag, rest) = Self::unpack_u8(input)?;

    Ok(match tag {
      4 => {
        let (in_amount, rest) = Self::unpack_u64(rest)?;
        let (minimum_out_amount, _) = Self::unpack_u64(rest)?;

        Self::Exchange {
          in_amount,
          minimum_out_amount
        }
      }
      _ => return Err(ProgramError::InvalidAccountData.into()),
    })
  }

  /// Packs a [SwapInstruction](enum.SwapInstruction.html) into a byte buffer.
  pub fn pack(&self) -> Vec<u8> {
    let mut buf = Vec::with_capacity(size_of::<Self>());

    match self {
      Self::Exchange {
        in_amount,
        minimum_out_amount,
      } => {
        buf.push(4);

        // in_amount
        buf.extend_from_slice(&in_amount.to_le_bytes());

        // minimum_out_amount
        buf.extend_from_slice(&minimum_out_amount.to_le_bytes())
      }
    }
    buf
  }

  fn unpack_u8(input: &[u8]) -> Result<(u8, &[u8]), ProgramError> {
    let (&amount, rest) = input.split_first().ok_or(ProgramError::InvalidAccountData)?;
    Ok((amount, rest))
  }

  fn unpack_u32(input: &[u8]) -> Result<(u32, &[u8]), ProgramError> {
    if input.len() >= 4 {
      let (amount, rest) = input.split_at(4);
      let amount = amount
          .get(..4)
          .and_then(|slice| slice.try_into().ok())
          .map(u32::from_le_bytes)
          .ok_or(ProgramError::InvalidAccountData)?;

      Ok((amount, rest))
    } else {
      return Err(ProgramError::InvalidAccountData);
    }
  }

  fn unpack_u64(input: &[u8]) -> Result<(u64, &[u8]), ProgramError> {
    if input.len() >= 8 {
      let (amount, rest) = input.split_at(8);
      let amount = amount
          .get(..8)
          .and_then(|slice| slice.try_into().ok())
          .map(u64::from_le_bytes)
          .ok_or(ProgramError::InvalidAccountData)?;
      
      Ok((amount, rest))
    } else {
      Err(ProgramError::InvalidAccountData)
    }
  }
}

/// Creates a [SwapInstruction::Exchange] instruction
pub fn exchange(
  program_id: &Pubkey,
  swap_account_address: &Pubkey,
  token_program_address: &Pubkey,
  pool_authority_address: &Pubkey,
  user_transfer_authority_address: &Pubkey,
  swap_token_accounts_addresses: Vec<&Pubkey>,
  source_token_account_address: &Pubkey,
  destination_token_account_address: &Pubkey,
  in_amount: u64,
  minimum_out_amount: u64,
) -> Result<Instruction, ProgramError> {
  let mut accounts = Vec::with_capacity(PoolParameter::MAX_N_COINS + 5);
  accounts.push(AccountMeta::new_readonly(*swap_account_address, false));
  accounts.push(AccountMeta::new_readonly(*token_program_address, false));
  accounts.push(AccountMeta::new_readonly(*pool_authority_address, false));
  accounts.push(AccountMeta::new_readonly(*user_transfer_authority_address, true));

  for token_account_address in swap_token_accounts_addresses {
    accounts.push(AccountMeta::new(*token_account_address, false));
  }
  accounts.push(AccountMeta::new_readonly(*source_token_account_address, false));
  accounts.push(AccountMeta::new_readonly(*destination_token_account_address, false));

  Ok(Instruction {
    program_id: *program_id,
    accounts,
    data: SwapInstruction::Exchange {
      in_amount,
      minimum_out_amount,
    }
    .pack(),
  })
}