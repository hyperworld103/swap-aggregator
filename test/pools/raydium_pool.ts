import { AccountMeta } from "@solana/web3.js";
import { RaydiumPoolInfo } from "../common/types";
import { str2pubkey } from "../common/utils";
import axios from "axios";

export const loadRaydiumPools = async(): Promise<RaydiumPoolInfo[]>  => {
  const data = (await axios.get("https://api.raydium.io/v2/sdk/liquidity/mainnet.json")).data;
  const pools: RaydiumPoolInfo[] = data.official.map((info: any):RaydiumPoolInfo => {
    const poolInfo: RaydiumPoolInfo = {
      coinMint: str2pubkey(info.baseMint),
      pcMint: str2pubkey(info.quoteMint),
      ammId: str2pubkey(info.id),
      ammAuthority: str2pubkey(info.authority),
      ammOpenOrders: str2pubkey(info.openOrders),
      ammTargetOrders: str2pubkey(info.targetOrders),
      poolCoinTokenAccount: str2pubkey(info.baseVault),
      poolPcTokenAccount: str2pubkey(info.quoteVault),
      serumProgramId: str2pubkey(info.marketProgramId),
      serumMarket: str2pubkey(info.marketId),
      serumBids: str2pubkey(info.marketBids),
      serumAsks: str2pubkey(info.marketAsks),
      serumEventQueue: str2pubkey(info.marketEventQueue),
      serumCoinVaultAccount: str2pubkey(info.marketBaseVault),
      serumPcVaultAccount: str2pubkey(info.marketQuoteVault),
      serumVaultSigner: str2pubkey(info.marketAuthority),
      programId: str2pubkey(info.programId),
    }
    return poolInfo;
  })
  return pools;
}

export const getRaydiumAccountInfos = (rayPoolInfo: RaydiumPoolInfo): AccountMeta[]=> {
  return [
    { pubkey: rayPoolInfo.ammId, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.ammAuthority, isSigner: false, isWritable: false },
    { pubkey: rayPoolInfo.ammOpenOrders, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.ammTargetOrders, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.poolCoinTokenAccount, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.poolPcTokenAccount, isSigner: false, isWritable: true },
    // serum
    { pubkey: rayPoolInfo.serumProgramId, isSigner: false, isWritable: false },
    { pubkey: rayPoolInfo.serumMarket, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumBids, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumAsks, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumEventQueue, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumCoinVaultAccount, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumPcVaultAccount, isSigner: false, isWritable: true },
    { pubkey: rayPoolInfo.serumVaultSigner, isSigner: false, isWritable: false },

    { pubkey: rayPoolInfo.programId, isSigner: false, isWritable: false },
  ]
}