import { AccountMeta } from "@solana/web3.js"
import { MercurialPoolInfo } from "../common/types"
import { PublicKey } from "@solana/web3.js"
import { str2pubkey } from "../common/utils"

export const loadMercurialPools = async() => {
  const pools: MercurialPoolInfo[] = [
    {
      name: 'wUSD-4Pool',
      programId: str2pubkey('MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky'),
      ammId: str2pubkey('USD42Jvem43aBSLqT83GZmvRbzAjpKBonQYBQhni7Cv'),
      ammAuthority: str2pubkey('3m15qNJDM5zydsYNJzkFYXE7iGCVnkKz1mrmbawrDUAH'),
      accounts: [
        str2pubkey('54q2ct7kTknGvADuHSXjtnKqMbmNQ4xpDVK2xgcnh1xv'),
        str2pubkey('5cvqiPREvEYmhvBt3cZ7fmrCE6tbYvwkAiuvf1pHUPBq'),
        str2pubkey('9gVstb8HkuYX8PqjLSc9b9zLMhFZwWX7k3ofLcWy7wyS'),
        str2pubkey('HLdcfovcXkHKm4iQWNQZhJypySmuGa1PGoTuB6L68hhZ')
      ]
    },
    {
      name: 'wbBUSD-4Pool',
      programId: str2pubkey('MERLuDFBMmsHnsBPZw2sDQZHvXFMwp8EdjudcU2HKky'),
      ammId: str2pubkey('BUSDXyZeFXrcEkETHfgGh5wfqavmfC8ZJ8BbRP33ctaG'),
      ammAuthority: str2pubkey('D9QnVSaKxcoYHhXpyhpHWjVhY1xtNxaQbuHocjHKVzf1'),
      accounts:[
        str2pubkey('2FRWh8BZfpeuh8Pmg7ezHvBezW8yiEGG6Fy8pCnHVyq1'),
        str2pubkey('8m5D8rtDdP67qZyZTXwLozVCsXJMcSiXnroWoRn9GZga'),
        str2pubkey('3CF2cmVJxnWKt4J4u5tzsNSYVcSvmWqbbb4iJMEmzSRr'),
        str2pubkey('5Nn1Fm15FqjD5DbMFBQ93Rrwppzei5GghENMmJt5qRpR')
      ]
    },
  ]
  return pools;
}

export const getMercurialAccountInfos = (mercurPoolInfo: MercurialPoolInfo): AccountMeta[]=> {
  return [
    { pubkey: mercurPoolInfo.ammId, isSigner: false, isWritable: true },
    { pubkey: mercurPoolInfo.ammAuthority, isSigner: false, isWritable: false },
    ...mercurPoolInfo.accounts.map((tokenAccount: PublicKey) => ({ pubkey: tokenAccount, isSigner: false, isWritable: true })),
    { pubkey: mercurPoolInfo.programId, isSigner: false, isWritable: false },
  ]
}