import { AccountMeta, PublicKey } from '@solana/web3.js';
import { AggregatorPath } from '../common/types';

import { getRaydiumAccountInfos, loadRaydiumPools } from './raydium_pool';
import { getSaberAccountInfos, loadSaberPools } from './saber_pool';
import { getMercurialAccountInfos, loadMercurialPools } from './mercurial_pool';


export async function loadPools(route: AggregatorPath): Promise<any> {
  let pools: any = []
  switch(route) {
    case AggregatorPath.Raydium:
      pools = await loadRaydiumPools();
      break;
    case AggregatorPath.Saber:
      pools = await loadSaberPools();
      break;
    case AggregatorPath.Mercurial:
      pools = await loadMercurialPools();
      break;
  }
  return pools;
}

export function getPoolAccountInfos(sourceMint: PublicKey, destMint: PublicKey, route: AggregatorPath, pool: any): AccountMeta[] {
  let accounts: AccountMeta[] = [];
  switch(route) {
    case AggregatorPath.Raydium:
      accounts = getRaydiumAccountInfos(pool);
      break;
    case AggregatorPath.Saber:
      accounts = getSaberAccountInfos(sourceMint, destMint, pool);
      break;
    case AggregatorPath.Mercurial:
      accounts = getMercurialAccountInfos(pool);
      break;
  }
  return accounts;
}