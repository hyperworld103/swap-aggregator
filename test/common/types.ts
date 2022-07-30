import { PublicKey } from "@solana/web3.js";

export enum AggregatorPath {
  Skip,
  Raydium,
  Serum,
  Saber,
  Mercurial,
  Orca,
}

export interface RaydiumPoolInfo {
  coinMint: PublicKey;
  pcMint: PublicKey;
  ammId: PublicKey;
  ammAuthority: PublicKey;
  ammOpenOrders: PublicKey;
  ammTargetOrders: PublicKey;
  poolCoinTokenAccount: PublicKey;
  poolPcTokenAccount: PublicKey;
  serumProgramId: PublicKey;
  serumMarket: PublicKey;
  serumBids: PublicKey;
  serumAsks: PublicKey;
  serumEventQueue: PublicKey;
  serumCoinVaultAccount: PublicKey;
  serumPcVaultAccount: PublicKey;
  serumVaultSigner: PublicKey;
  programId: PublicKey;
}


export interface SaberPoolInfo {
  ammId: PublicKey;
  ammAuthority: PublicKey;
  tokenAMint: PublicKey;
  tokenAFeeAccount: PublicKey;
  tokenAReserve: PublicKey; 
  tokenBMint: PublicKey;
  tokenBFeeAccount: PublicKey;
  tokenBReserve: PublicKey; 
  programId: PublicKey;
}

export interface MercurialPoolInfo {
  name: string;
  ammId: PublicKey;
  ammAuthority: PublicKey;
  accounts: PublicKey[];
  programId: PublicKey;
}