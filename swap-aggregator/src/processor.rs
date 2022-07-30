//! Program state processor
//! In here, All instructions are processed by Processor
use std::convert::TryInto;

use {
  std::{
    str::FromStr,
    convert::{identity},
  },

  crate::{
    instruction::{AggregatorInstruction, AggregatorPath},
    error::{AggregatorError},
    constant::*,
    dex::*,
  },

  bytemuck::{cast_slice},

  borsh::{BorshDeserialize, BorshSchema, BorshSerialize},

  solana_program::{
    account_info::{
      next_account_info,
      AccountInfo,
    },
    // borsh::try_from_slice_unchecked,
    // decode_error::DecodeError,
    entrypoint::ProgramResult,
    msg,
    program::{
      invoke,
      invoke_signed,
    },
    program_error::ProgramError,
    pubkey::Pubkey,
    program_pack::Pack,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
  },

  anchor_spl::token::{self, Transfer},
  anchor_lang::CpiContext,
};

use stable_swap_client::{self};

/// Program State
#[repr(C)]
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize, BorshSchema)]
pub struct ProgramState {
  // Initialized state
  pub is_initialized:bool,

  // Owner address to update the program state
  pub state_owner: Pubkey,

  // Fee owner address to redistribute
  pub fee_owner: Pubkey,

  // Fee ratio to redistribute
  pub fee_numerator: u64,

  // Fee ratio to redistribute
  pub fee_denominator: u64
}

/// Program state handler.
/// Main logic of this program
pub struct Processor {}

impl Processor {
  /// All instructions start from here and ar processed by their type.
  pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    input: &[u8])
  -> ProgramResult {
    let instruction = AggregatorInstruction::try_from_slice(input)?;

    // determine instruction type
    match instruction {
      AggregatorInstruction::RouteSwap{
        route1,
        route2,
        amount_in,
        amount_out
      } => {
        Self::process_route_swap(program_id, accounts, route1, route2, amount_in, amount_out)
      }
      AggregatorInstruction::UpdateState {
        fee_numerator,
        fee_denominator
      } => {
        Self::process_update_state(program_id, accounts, fee_numerator, fee_denominator)
      }
    }
  }

  /// create ab account for global state
  pub fn create_or_allocate_account_raw<'a>(
    program_id: Pubkey,
    new_account_info: &AccountInfo<'a>,
    rent_sysvar_info: &AccountInfo<'a>,
    system_program_info: &AccountInfo<'a>,
    payer_info: &AccountInfo<'a>,
    size: usize,
    signer_seeds: &[&[u8]],
  ) -> Result<(), ProgramError> {
    let rent = &Rent::from_account_info(rent_sysvar_info)?;
    let required_lamports = rent
      .minimum_balance(size)
      .max(1)
      .saturating_sub(new_account_info.lamports());

    if required_lamports > 0 {
      msg!("Transfer {} lamports to the new account", required_lamports);
      invoke(
        &system_instruction::transfer(&payer_info.key, new_account_info.key, required_lamports),
        &[
          payer_info.clone(),
          new_account_info.clone(),
          system_program_info.clone(),
        ],
      )?;
    }

    msg!("Allocate space for the account");
    invoke_signed(
      &system_instruction::allocate(new_account_info.key, size.try_into().map_err(|_| AggregatorError::InvalidAllocateSpaceForAccount)?),
      &[new_account_info.clone(), system_program_info.clone()],
      &[&signer_seeds],
    )?;

    msg!("Assign the account to the owning program");
    invoke_signed(
      &system_instruction::assign(new_account_info.key, &program_id),
      &[new_account_info.clone(), system_program_info.clone()],
      &[&signer_seeds],
    )?;
    msg!("Completed assignation!");

    Ok(())
  }

  /// check if the program account address is valid
  pub fn check_state_account(program_id: &Pubkey, key: &Pubkey) -> Result<(), ProgramError> {
    let seeds = [
      SWAP_AGGREGATOR_SEED.as_bytes(),
      program_id.as_ref(),
    ];

    let (program_data_key, _bump) = Pubkey::find_program_address(&seeds, program_id);
    if program_data_key != *key {
      return Err(AggregatorError::InvalidStateAddress.into());
    } else {
      Ok(())
    }
  }

  fn u64_to_pubkey(arr:[u64;4]) -> Pubkey {
    return Pubkey::new(cast_slice(&identity(arr) as &[_]));
  }

  fn next_account_infos<'a, 'b: 'a>(
    iter: &mut std::slice::Iter<'a, AccountInfo<'b>>,
    count: usize,
  ) -> Result<&'a [AccountInfo<'b>], ProgramError> {
    let accounts = iter.as_slice();
    if accounts.len() < count {
      return Err(ProgramError::NotEnoughAccountKeys);
    }

    let (accounts, remaining) = accounts.split_at(count);
    *iter = remaining.into_iter();

    Ok(accounts)
  }

  pub fn unpack_token_account(
    account_info: &AccountInfo,
    token_program_id: &Pubkey,
  ) -> Result<spl_token::state::Account, AggregatorError> {
    if account_info.owner != token_program_id {
      Err(AggregatorError::InvalidTokenProgramId)
    } else {
      spl_token::state::Account::unpack(&account_info.data.borrow())
        .map_err(|_| AggregatorError::NotExpectedAccount)
    }
  }

  fn swap_mercurial_4<'a, 'b>(
    accounts: &'a[AccountInfo<'b>],
    amount: u64,
    amount_out: u64,
    source_info: &'a AccountInfo<'b>,
    destination_info: &'a AccountInfo<'b>,
    user_transfer_authority_info: &'a AccountInfo<'b>,
    token_program_info: &'a AccountInfo<'b>,
  ) -> Result<u64, ProgramError> {
    let account_info_iter = &mut accounts.iter();

    let swap_account_info = next_account_info(account_info_iter)?;
    let pool_authority_info = next_account_info(account_info_iter)?;
    let swap_token_info_1 = next_account_info(account_info_iter)?;
    let swap_token_info_2 = next_account_info(account_info_iter)?;
    let swap_token_info_3 = next_account_info(account_info_iter)?;
    let swap_token_info_4 = next_account_info(account_info_iter)?;
    let swap_program_info = next_account_info(account_info_iter)?;

    let program_id = Pubkey::from_str(MERCURIAL_SWAP_PROGRAM_ID).map_err(|_| AggregatorError::InvalidMercurialProgramId)?;

    let ix = mercurial::exchange(
      &program_id,
      swap_account_info.key,
      token_program_info.key,
      pool_authority_info.key,
      user_transfer_authority_info.key,
      [
        swap_token_info_1.key,
        swap_token_info_2.key,
        swap_token_info_3.key,
        swap_token_info_4.key,
      ].to_vec(),
      source_info.key,
      destination_info.key,
      amount,
      amount_out,
    )?;

    let mut dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let ori_balance = dest_token.amount;

    invoke(
      &ix,
      &[
        swap_account_info.clone(),
        token_program_info.clone(),
        pool_authority_info.clone(),
        user_transfer_authority_info.clone(),
        swap_token_info_1.clone(),
        swap_token_info_2.clone(),
        swap_token_info_3.clone(),
        swap_token_info_4.clone(),
        source_info.clone(),
        destination_info.clone(),
        swap_program_info.clone(),
      ]
    )?;

    dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let delta_balance = dest_token.amount - ori_balance;
    Ok(delta_balance)
  }

  fn swap_saber<'a, 'b>(
    accounts: &'a [AccountInfo<'b>],
    amount: u64,
    amount_out: u64,
    source_info: &'a AccountInfo<'b>,
    destination_info: &'a AccountInfo<'b>,
    user_transfer_authority_info: &'a AccountInfo<'b>,
    token_program_info: &'a AccountInfo<'b>,
  ) -> Result<u64, ProgramError> {
    let account_info_iter = &mut accounts.iter();

    let stable_pool_info = next_account_info(account_info_iter)?;
    let stable_authority_info = next_account_info(account_info_iter)?;
    let stable_coin_token_info = next_account_info(account_info_iter)?;
    let stable_pc_token_info = next_account_info(account_info_iter)?;
    let stable_fee_account_info = next_account_info(account_info_iter)?;
    let clock_program_info = next_account_info(account_info_iter)?;
    let stable_program_info = next_account_info(account_info_iter)?;

    let ix = stable_swap_client::instruction::swap(
      token_program_info.key,
      stable_pool_info.key,
      stable_authority_info.key,
      user_transfer_authority_info.key,
      source_info.key,
      stable_coin_token_info.key,
      stable_pc_token_info.key,
      destination_info.key,
      stable_fee_account_info.key,
      amount,
      amount_out,
    )?;

    let mut dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let ori_balance = dest_token.amount;

    invoke(
      &ix,
      &[
        stable_pool_info.clone(),
        stable_authority_info.clone(),
        user_transfer_authority_info.clone(),
        source_info.clone(),
        stable_coin_token_info.clone(),
        stable_pc_token_info.clone(),
        destination_info.clone(),
        stable_fee_account_info.clone(),
        token_program_info.clone(),
        clock_program_info.clone(),
        stable_program_info.clone(),
      ]
    )?;

    dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let delta_balance = dest_token.amount - ori_balance;
    Ok(delta_balance)
  }

  fn swap_raydium<'a, 'b>(
    accounts: &'a [AccountInfo<'b>],
    amount_in: u64,
    amount_out: u64,
    source_info: &'a AccountInfo<'b>,
    destination_info: &'a AccountInfo<'b>,
    user_transfer_authority_info: &'a AccountInfo<'b>,
    token_program_info: &'a AccountInfo<'b>,
  ) -> Result<u64, ProgramError> {
    let account_info_iter = &mut accounts.iter();

    let ray_pool_info = next_account_info(account_info_iter)?;
    let ray_authority_info = next_account_info(account_info_iter)?;
    let ray_open_orders_info = next_account_info(account_info_iter)?;
    let ray_target_orders_info = next_account_info(account_info_iter)?;
    let ray_coin_token_info = next_account_info(account_info_iter)?;
    let ray_pc_token_info = next_account_info(account_info_iter)?;

    let serum_program_id_info = next_account_info(account_info_iter)?;
    let serum_market_info = next_account_info(account_info_iter)?;
    let serum_bids_info = next_account_info(account_info_iter)?;
    let serum_asks_info = next_account_info(account_info_iter)?;
    let serum_event_q_info = next_account_info(account_info_iter)?;
    let serum_coin_vault_info = next_account_info(account_info_iter)?;
    let serum_pc_vault_info = next_account_info(account_info_iter)?;
    let serum_vault_signer_info = next_account_info(account_info_iter)?;

    let ray_program_info = next_account_info(account_info_iter)?;

    let ray_program_id = Pubkey::from_str(RAYDIUM_SWAP_PROGRAM_ID).map_err(|_| AggregatorError::InvalidRaydiumProgramId)?;

    // call raydium swap
    let ix = raydium::swap(
      &ray_program_id,
      ray_pool_info.key,
      ray_authority_info.key,
      ray_open_orders_info.key,
      ray_target_orders_info.key,
      ray_coin_token_info.key,
      ray_pc_token_info.key,
      serum_program_id_info.key,
      serum_market_info.key,
      serum_bids_info.key,
      serum_asks_info.key,
      serum_event_q_info.key,
      serum_coin_vault_info.key,
      serum_pc_vault_info.key,
      serum_vault_signer_info.key,
      source_info.key,
      destination_info.key,
      user_transfer_authority_info.key,
      amount_in,
      amount_out,
    )?;

    let mut dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let ori_balance = dest_token.amount;

    invoke(
      &ix,
      &[
        // spl token
        token_program_info.clone(),
        // amm
        ray_pool_info.clone(),
        ray_authority_info.clone(),
        ray_open_orders_info.clone(),
        ray_target_orders_info.clone(),
        ray_coin_token_info.clone(),
        ray_pc_token_info.clone(),
        // serum
        serum_program_id_info.clone(),
        serum_market_info.clone(),
        serum_bids_info.clone(),
        serum_asks_info.clone(),
        serum_event_q_info.clone(),
        serum_coin_vault_info.clone(),
        serum_pc_vault_info.clone(),
        serum_vault_signer_info.clone(),
        // user
        source_info.clone(),
        destination_info.clone(),
        user_transfer_authority_info.clone(),
        ray_program_info.clone(),
      ]
    )?;

    dest_token = Self::unpack_token_account(destination_info, token_program_info.key)?;
    let delta_balance = dest_token.amount - ori_balance;
    Ok(delta_balance)
  }

  /// Processes an [Update](enum.Instruction.html).
  pub fn process_update_state(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    fee_numerator: u64,
    fee_denominator: u64,
  ) -> ProgramResult {
    // load account info
    let account_info_iter = &mut accounts.iter();
    let state_info = next_account_info(account_info_iter)?;

    let cur_state_owner_info = next_account_info(account_info_iter)?;
    let new_state_owner_info = next_account_info(account_info_iter)?;

    let fee_owner_info = next_account_info(account_info_iter)?;

    let system_info = next_account_info(account_info_iter)?;
    let rent_info = next_account_info(account_info_iter)?;

    Self::check_state_account(program_id, state_info.key)?;

    if !cur_state_owner_info.is_signer {
      return Err(AggregatorError::InvalidStateSigner.into());
    }

    if *system_info.key != Pubkey::from_str(SYSTEM_PROGRAM_ID).map_err(|_| AggregatorError::InvalidSystemProgramId)? {
      return Err(AggregatorError::InvalidSystemProgramId.into());
    }

    if *rent_info.key != Pubkey::from_str(RENT_SYSVAR_ID).map_err(|_| AggregatorError::InvalidRentSysvarId)? {
      return Err(AggregatorError::InvalidRentSysvarId.into());
    }

    let seeds = [
      SWAP_AGGREGATOR_SEED.as_bytes(),
      program_id.as_ref(),
    ];

    let (_pda_key, bump) = Pubkey::find_program_address(&seeds, program_id);

    if state_info.data_is_empty() {
      let size = 81; // ProgramState::get_packed_len();

      Self::create_or_allocate_account_raw(
        *program_id,
        state_info,
        rent_info,
        system_info,
        cur_state_owner_info,
        size,
        &[
          SWAP_AGGREGATOR_SEED.as_bytes(),
          program_id.as_ref(),
          &[bump],
        ],
      )?;
    }

    let mut program_state = ProgramState::try_from_slice(&state_info.data.borrow())?;

    if program_state.is_initialized == false {
      program_state.state_owner = Pubkey::from_str(INITIAL_STATE_OWNER).map_err(|_| AggregatorError::InvalidStateOwner)?;
      program_state.is_initialized = true;
    }

    if program_state.state_owner != *cur_state_owner_info.key {
      return Err(AggregatorError::InvalidStateOwner.into());
    }

    if fee_numerator > fee_denominator ||
      fee_denominator <= 0 ||
      fee_numerator < 0 {
      return Err(AggregatorError::InvalidFeeParameters.into());
    }

    // Save the program state
    program_state.state_owner = *new_state_owner_info.key;
    program_state.fee_owner = *fee_owner_info.key;
    program_state.fee_numerator = fee_numerator;
    program_state.fee_denominator = fee_denominator;

    program_state.serialize(&mut &mut state_info.data.borrow_mut()[..])?;
    Ok(())
  }

  pub fn process_route_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    route1: AggregatorPath,
    route2: AggregatorPath,
    amount_in: u64,
    amount_out: u64
  ) -> ProgramResult {
    // load account info
    let account_info_iter = &mut accounts.iter();

    let state_info = next_account_info(account_info_iter)?;

    let user_transfer_authority_info = next_account_info(account_info_iter)?;
    let source_info = next_account_info(account_info_iter)?;
    let mid_token_info = next_account_info(account_info_iter)?;
    let fixed_fee_account_info = next_account_info(account_info_iter)?;

    let token_program_info = next_account_info(account_info_iter)?;

    if *token_program_info.key != Pubkey::from_str(TOKEN_PROGRAM_ID).map_err(|_| AggregatorError::InvalidTokenProgramId)?{
        return Err(AggregatorError::InvalidTokenProgramId.into());
    }

    Self::check_state_account(program_id, state_info.key)?;
    let program_state = ProgramState::try_from_slice(&state_info.data.borrow())?;

    if program_state.is_initialized == false
    {
        return Err(AggregatorError::NotInitializedState.into());
    }

    // let source_token = Self::unpack_token_account(source_info, token_program_info.key)?;
    let fee_token = Self::unpack_token_account(fixed_fee_account_info, token_program_info.key)?;
    if fee_token.owner != program_state.fee_owner{
        return Err(AggregatorError::InvalidFeeOwner.into());
    }

    let mut amount_fee = amount_in * program_state.fee_numerator / program_state.fee_denominator;
    
    if amount_fee <= 0 {
        amount_fee = 1;
    }
    let amount_1 = amount_in - amount_fee;

    if amount_1 <= 0 {
        return Err(AggregatorError::InsufficientSourceToken.into());
    }

    let cpi_accounts = Transfer{
        from: source_info.clone(),
        to: fixed_fee_account_info.clone(),
        authority: user_transfer_authority_info.clone()
    };
    let cpi_ctx = CpiContext::new(token_program_info.clone(), cpi_accounts);

    token::transfer(cpi_ctx, amount_fee)?;
    // }
    let mut amount_2 = 0;
    match route1 {
      AggregatorPath::Raydium => {
        amount_2 = Self::swap_raydium(
            Self::next_account_infos(account_info_iter, RAYDIUM_SWAP_ACCOUNTS)?,
            amount_1,
            amount_out,
            source_info,
            mid_token_info,
            user_transfer_authority_info,
            token_program_info,
        )?;
      }
      AggregatorPath::Saber => {
        amount_2 = Self::swap_saber(
          Self::next_account_infos(account_info_iter, SABER_SWAP_ACCOUNTS)?,
          amount_1,
          amount_out,
          source_info,
          mid_token_info,
          user_transfer_authority_info,
          token_program_info,
        )?;
      }
      AggregatorPath::Mercurial => {
        amount_2 = Self::swap_mercurial_4(
          Self::next_account_infos(account_info_iter, MERCURIAL_SWAP_ACCOUNTS)?,
          amount_1,
          amount_out,
          source_info,
          mid_token_info,
          user_transfer_authority_info,
          token_program_info,
        )?;
      }
      _ => {}
    };

    Ok(())
  }

  /// process `Route to Raydium` instruction.
  pub fn process_chain_swap(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    step: u8,
    route: AggregatorPath,
    amount_in: u64,
    amount_out: u64,
  ) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let user_transfer_authority_info = next_account_info(account_info_iter)?;
    let source_info = next_account_info(account_info_iter)?;
    let destination_info = next_account_info(account_info_iter)?;

    let token_program_info = next_account_info(account_info_iter)?;

    if *token_program_info.key != Pubkey::from_str(TOKEN_PROGRAM_ID).map_err(|_| AggregatorError::InvalidTokenProgramId)? {
      return Err(AggregatorError::InvalidTokenProgramId.into());
    }

    let mut amount_new_in = amount_in;
    msg!("Swap step {}", step);

    if step == 0 {
      let state_info = next_account_info(account_info_iter)?;
      let fixed_fee_account_info = next_account_info(account_info_iter)?;

      Self::check_state_account(program_id, state_info.key)?;
      let program_state = ProgramState::try_from_slice(&state_info.data.borrow())?;

      if program_state.is_initialized == false {
        return Err(AggregatorError::NotInitializedState.into());
      }

      let fee_token = Self::unpack_token_account(fixed_fee_account_info, token_program_info.key)?;
      if fee_token.owner != program_state.fee_owner {
        return Err(AggregatorError::InvalidFeeOwner.into());
      }

      let mut amount_fee = amount_in * program_state.fee_numerator / program_state.fee_denominator;

      if amount_fee <= 0 {
        amount_fee = 1;
      }
      amount_new_in = amount_in - amount_fee;

      if amount_new_in <= 0 {
        return Err(AggregatorError::InsufficientSourceToken.into());
      }

      let cpi_accounts = Transfer {
        from: source_info.clone(),
        to: fixed_fee_account_info.clone(),
        authority: user_transfer_authority_info.clone(),
      };

      let cpi_ctx = CpiContext::new(token_program_info.clone(), cpi_accounts);

      token::transfer(cpi_ctx, amount_fee)?;
    } else {
      let source_token = Self::unpack_token_account(source_info, token_program_info.key)?;
      amount_new_in = source_token.amount - amount_in;
    }

    msg!("Swap amount {}", amount_new_in);

    match route {
      AggregatorPath::Raydium => {
        Self::swap_raydium(
          Self::next_account_infos(account_info_iter, RAYDIUM_SWAP_ACCOUNTS)?,
          amount_new_in,
          amount_out,
          source_info,
          destination_info,
          user_transfer_authority_info,
          token_program_info,
        )?;
      }
      AggregatorPath::Saber => {
        Self::swap_saber(
          Self::next_account_infos(account_info_iter, SABER_SWAP_ACCOUNTS)?,
          amount_new_in,
          amount_out,
          source_info,
          destination_info,
          user_transfer_authority_info,
          token_program_info,
        )?;
      }
      AggregatorPath::Mercurial => {
        Self::swap_mercurial_4(
          Self::next_account_infos(account_info_iter, MERCURIAL_SWAP_ACCOUNTS)?,
          amount_new_in,
          amount_out,
          source_info,
          destination_info,
          user_transfer_authority_info,
          token_program_info,
        )?;
      }
      _ => {}
    }

    Ok(())
  }

}