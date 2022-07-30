//! Error types

use num_derive::FromPrimitive;
use num_traits::FromPrimitive;
use solana_program::{decode_error::DecodeError, program_error::ProgramError, program_error::PrintProgramError, msg};
use thiserror::Error;

/// Errors that may be returned by the TokenSwap program
#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum AggregatorError {
  #[error("Swap account already in use")]
  AlreadyInUse,
  #[error("Invalid Raydium program id")]
  InvalidRaydiumProgramId,

  #[error("Invalid Serum program id")]
  InvalidSerumProgramId,

  #[error("Invalid Mercurial program id")]
  InvalidMercurialProgramId,

  #[error("Invalid Saber program id")]
  InvalidSaberProgramId,

  #[error("Invalid Token program id")]
  InvalidTokenProgramId,

  #[error("Invalid System program id")]
  InvalidSystemProgramId,

  #[error("Invalid Rent program id")]
  InvalidRentSysvarId,

  #[error("Insufficient source token amount")]
  InsufficientSourceToken,

  #[error("Invalid state address")]
  InvalidStateAddress,

  #[error("Can't allocate space for state account")]
  InvalidAllocateSpaceForAccount,

  #[error("Invalid state signer")]
  InvalidStateSigner,

  #[error("Invalid pool fee parameter")]
  InvalidFeeParameters, 

  #[error("Program status not initialized")]
  NotInitializedState,

  #[error("Invalid fee owner")]
  InvalidFeeOwner,
  
  #[error("Invalid state owner")]
  InvalidStateOwner,

  #[error("Invalid serum signer")]
  InvalidSerumSigner,
  
  #[error("Invalid raydium authority")]
  InvalidRaydiumAuthority,

  #[error("Not expected account")]
  NotExpectedAccount,

  #[error("Not expected mint")]
  NotExpectedMint,
}

impl From<AggregatorError> for ProgramError {
  fn from(e: AggregatorError) -> Self {
    ProgramError::Custom(e as u32)
  }
}

impl<T> DecodeError<T> for AggregatorError {
  fn type_of() -> &'static str {
    "Liquidity Error"
  }
}

impl PrintProgramError for AggregatorError {
  fn print<E>(&self)
  where
    E: 'static + std::error::Error + DecodeError<E> + PrintProgramError + FromPrimitive,
    {
      msg!(&self.to_string());
    }
}
