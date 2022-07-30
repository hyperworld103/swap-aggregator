import { PublicKey, TransactionInstruction } from "@solana/web3.js";
// @ts-ignore
import { nu64} from 'buffer-layout'
import { struct,  u8} from '@project-serum/borsh'

import { TOKENS, Tokens } from "../common/tokens";
import { CLOCK_PROGRAM_ID } from "utils/common/ids";


export const saberSwapInstruction = (
  tokenSwap: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  userSource: PublicKey,
  poolSource: PublicKey,
  poolDestination: PublicKey,
  userDestination: PublicKey,
  adminFeeAccount: PublicKey,
  swapProgramId: PublicKey,
  amountIn: number,
  minimumAmountOut: number,
): TransactionInstruction => {

  const dataLayout = struct([
    u8("instruction"),
    nu64("amountIn"),
    nu64("minimumAmountOut"),
  ]);

  const keys = [
    { pubkey: tokenSwap, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: userSource, isSigner: false, isWritable: true },
    { pubkey: poolSource, isSigner: false, isWritable: true },
    { pubkey: poolDestination, isSigner: false, isWritable: true },
    { pubkey: userDestination, isSigner: false, isWritable: true },
    { pubkey: adminFeeAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: CLOCK_PROGRAM_ID, isSigner: false, isWritable: false },

  ];

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 1, // Swap instruction
      amountIn,
      minimumAmountOut,
    },
    data
  );

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};


export const mercurialSwapInstruction = (
  swapInfo: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  tokenAccounts: string[],
  userSourceTokenAccount: PublicKey,
  userDestinationTokenAccount: PublicKey,
  inAmount: number,
  minimumAmountOut: number,
  swapProgramId:PublicKey
): TransactionInstruction => {

  const dataLayout = struct([
    u8("instruction"),
    nu64("inAmount"),
    nu64("minimumAmountOut"),
  ]);

  const keys = [
    { pubkey: swapInfo, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },

    ...tokenAccounts.map((tokenAccount:string) => ({ pubkey: new PublicKey(tokenAccount), isSigner: false, isWritable: true })),

    { pubkey: userSourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userDestinationTokenAccount, isSigner: false, isWritable: true }
  ]

  const data = Buffer.alloc(dataLayout.span);
  dataLayout.encode(
    {
      instruction: 4, // exchange instruction
      inAmount,
      minimumAmountOut,
    },
    data
  );

  return new TransactionInstruction({
    keys,
    programId: swapProgramId,
    data,
  });
};

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const STABLE_LP_TOKENS:Tokens= {
  'USDT-wUSDTv2': {
    symbol: 'USDT-wWUSDT',
    name: 'USDT-wWUSDT Atlas LP',
    coin: { ...TOKENS.USDT },
    pc: { ...TOKENS.wUSDTv2 },
    mintAddress: '9oedAN1eyfvojmVfNKdZVNVCQUUSp85C3Sg14zv35uA8',
    decimals: 8,
  },
}


export const MERCURIAL_POOLS = {
  wUSD4Pool:{
    name: 'wUSD-4Pool',
    programId: 'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky',
    ammId: 'USD42Jvem43aBSLqT83GZmvRbzAjpKBonQYBQhni7Cv',
    ammAuthority: '3m15qNJDM5zydsYNJzkFYXE7iGCVnkKz1mrmbawrDUAH',
    accounts:[
      '54q2ct7kTknGvADuHSXjtnKqMbmNQ4xpDVK2xgcnh1xv',
      '5cvqiPREvEYmhvBt3cZ7fmrCE6tbYvwkAiuvf1pHUPBq',
      '9gVstb8HkuYX8PqjLSc9b9zLMhFZwWX7k3ofLcWy7wyS',
      'HLdcfovcXkHKm4iQWNQZhJypySmuGa1PGoTuB6L68hhZ'
    ]
  },
  wbBUSD4Pool:{
    name: 'wbBUSD-4Pool',
    programId: 'MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky',
    ammId: 'BUSDXyZeFXrcEkETHfgGh5wfqavmfC8ZJ8BbRP33ctaG',
    ammAuthority: 'D9QnVSaKxcoYHhXpyhpHWjVhY1xtNxaQbuHocjHKVzf1',
    accounts:[
      '2FRWh8BZfpeuh8Pmg7ezHvBezW8yiEGG6Fy8pCnHVyq1',
      '8m5D8rtDdP67qZyZTXwLozVCsXJMcSiXnroWoRn9GZga',
      '3CF2cmVJxnWKt4J4u5tzsNSYVcSvmWqbbb4iJMEmzSRr',
      '5Nn1Fm15FqjD5DbMFBQ93Rrwppzei5GghENMmJt5qRpR'
    ]
  }
  
}

export const SABER_POOLS = {
  wpUSDC:{
    name: 'wpUSDC-USDC',
    programId: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    ammId: 'MATgk4zXLXtYkwBH678J1xZbRDZ45LicNzkRBHkxTuY',
    ammAuthority: 'F6JFfyWaKTZY94rRzR5ftrtEKBS7aNLu1vYQiKuYhTZ6',
    poolCoinTokenAccount:'GN7Yuet3UyiWS5YVkEHv6oQKi4HGBJc3XDPt9zQhAqZz',
    poolPcTokenAccount:'y8dALFo1bJrSzPYjMX14HJX448pXqYmrfXHD1K8MXih',
    feeAccount:'5A9qZYyeaw8qJoTxBcSqbdDfyiJGXAc1WzsvgUeNALng'
  },
  weUSDC:{
    name: 'weUSDC-USDC',
    programId: 'SSwpkEEcbUqx4vtoEByFjSkhKdCT862DNVb52nZg1UZ',
    ammId: 'GokA1R67GqSavkd15zR62QD68Tuc5AEfvjssntVDEbM8',
    ammAuthority: '7XFMgfxhDURuaPwhUkXAy6uQJCoC3HPpjiZBqcot57Ge',
    poolCoinTokenAccount:'4DPCj6Z1DsG6HUtwSogBGqXEUxdEV5a8YVrrFtcnz7UW',
    poolPcTokenAccount:'3YB7hfpBdbQEuZqLGWVDpRPmeZWCUsrrWyqGXegnQ6Cg',
    feeAccount:'5WemKHzh1RjGjQGtp79yqP4yCEvmkNRcyN8qt9q6h46r'
  },  
}


export const STABLE_POOLS: any = {
  USDT:{
    name: 'USDT-wWUSDT',
    version: 1,
    coin: {...TOKENS.USDT},
    pc: {...TOKENS.wUSDTv2},
    lp:{...STABLE_LP_TOKENS['USDT-wUSDTv2']},
    programId: '2E5cDaVrPPMp1a6Q7PNookgd48yUidJKgrf9as5ezWwF',

    ammId: '6BEvCZxbojJ9CL4wdczGPmtYEjKPdMo3E9ZThqSGyFfr',
    ammAuthority: '9qrDnhLpG4yzNkSYrweEXV7tcvRfV3NUwqEu1iydZx11',
    poolCoinTokenAccount: '55YzKTs8vMJXaUvCfjgcWBsvAdmYZuigbMmf5jThfkKy',
    poolPcTokenAccount: 'EYm1f2beGNcjEmN5crD3TFyfSoC1b94Y6N95nHrS3e6q',
    feeAccount: '2ZFYCkSVBfWykfXWJoowZDtxxXTya636VHw78Cd1hXCs',
    official:true,
  },
    USDC:{
        name: 'USDC-wWUSDC',
        version: 1,
        coin: {...TOKENS.USDC},
        pc: {...TOKENS.wUSDTv2},
        lp:{...STABLE_LP_TOKENS['USDT-wUSDTv2']},
        programId: '2E5cDaVrPPMp1a6Q7PNookgd48yUidJKgrf9as5ezWwF',
    
        ammId: '8M9wyEdtxVCxayEkwsBsNpyjwLTQhtquA3YCLQryV4Qs',
        ammAuthority: 'dhXGxdK3EWitjasUAbJNdXGnSsQBt8sCjKpx36JU8JH',
        poolCoinTokenAccount: 'BR1poDF1aXfTNKSUSVrTxD2mKrbcYo7Sdtr7jwV6FsaC',
        poolPcTokenAccount: 'GJoEeet6HfK7t1YJNHPjkh33zV2ZeEwmui3YAsRVFE4',
        feeAccount: 'DK4VFpFuUQKCmDQ7bHMod1Ltzz7NP8koFaz9E6crfMM3',
        official:true,
      },
}
    