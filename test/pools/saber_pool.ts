import { AccountMeta, PublicKey } from "@solana/web3.js";
import { SaberPoolInfo } from "../common/types";
import { CLOCK_PROGRAM_ID } from "../common/ids";
import { str2pubkey } from "../common/utils";
import axios from "axios";

export const loadSaberPools = async() => {
  const data = (await axios.get("https://registry.saber.so/data/pools-info.mainnet.json")).data;
  const pools: SaberPoolInfo[] = data.pools.map((info: any):SaberPoolInfo => {
    const { config, state } = info.swap;
    const poolInfo: SaberPoolInfo = {
      ammId: str2pubkey(config.swapAccount),
      ammAuthority: str2pubkey(config.authority),
      tokenAMint: str2pubkey(state.tokenA.mint),
      tokenBMint: str2pubkey(state.tokenB.mint),
      tokenAReserve: str2pubkey(state.tokenA.reserve),
      tokenBReserve: str2pubkey(state.tokenB.reserve),
      tokenAFeeAccount: str2pubkey(state.tokenA.adminFeeAccount),
      tokenBFeeAccount: str2pubkey(state.tokenB.adminFeeAccount),
      programId: str2pubkey(config.swapProgramID),
    }
    return poolInfo;
  })
  return pools;
}

export const getSaberAccountInfos = (sourceMint: PublicKey, destMint: PublicKey, saberPoolInfo: SaberPoolInfo): AccountMeta[]=> {
  let poolCoinTokenAccount, poolPcTokenAccount, feeAccount;
  if (sourceMint == saberPoolInfo.tokenAMint) {
    poolCoinTokenAccount = saberPoolInfo.tokenAReserve;
    poolPcTokenAccount = saberPoolInfo.tokenBReserve;
    feeAccount = saberPoolInfo.tokenBFeeAccount;
  } else {
    poolCoinTokenAccount = saberPoolInfo.tokenBReserve;
    poolPcTokenAccount = saberPoolInfo.tokenAReserve;
    feeAccount = saberPoolInfo.tokenAFeeAccount;
  }
  
  return [
    { pubkey: saberPoolInfo.ammId, isSigner: false, isWritable: true },
    { pubkey: saberPoolInfo.ammAuthority, isSigner: false, isWritable: false },
    { pubkey: poolCoinTokenAccount, isSigner: false, isWritable: true },
    { pubkey: poolPcTokenAccount, isSigner: false, isWritable: true },
    { pubkey: feeAccount, isSigner: false, isWritable: true },

    { pubkey: CLOCK_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: saberPoolInfo.programId, isSigner: false, isWritable: false },
  ]
}