/// Main Entrypoint and declaration file

use solana_program::{
  account_info::{ AccountInfo },
  entrypoint,
  entrypoint::ProgramResult,
  program_error::PrintProgramError,
  pubkey::Pubkey,
};

use error::AggregatorError;

/// module declaration
pub mod dex;
/// instruction module
pub mod instruction;
/// processor module
pub mod processor;

pub mod error;

pub mod constant;

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
  program_id: &Pubkey,
  accounts: &[AccountInfo],
  _instruction_data: &[u8],
) -> ProgramResult {
  if let Err(error) = processor::Processor::process(program_id, accounts, _instruction_data) {
    error.print::<AggregatorError>();
    Err(error)
  } else {
    Ok(())
  }
}