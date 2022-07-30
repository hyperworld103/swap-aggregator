//! All instruction types
//! These instructions represent a function what will be processed by this program

// this allows many arguments for the function parameter
#![allow(clippy::too_many_arguments)]

use {
  borsh::{BorshSerialize, BorshDeserialize, BorshSchema},
};

/// Instructions supported by the Stability Pool program.
#[repr(C)]
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize, BorshSchema)]
pub enum AggregatorInstruction {
  UpdateState {
    #[allow(dead_code)]
    fee_numerator: u64,

    #[allow(dead_code)]
    fee_denominator: u64
  },

  RouteSwap {
    #[allow(dead_code)]
    route1: AggregatorPath,

    #[allow(dead_code)]
    route2: AggregatorPath,

    #[allow(dead_code)]
    amount_in: u64,

    #[allow(dead_code)]
    amount_out: u64,
  }
}

#[repr(C)]
#[derive(Clone, Debug, PartialEq, BorshSerialize, BorshDeserialize, BorshSchema)]
pub enum AggregatorPath {
  Skip,
  Raydium,
  Serum,
  Saber,
  Mercurial,
  Orca,
}

