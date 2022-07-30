import { PublicKey } from "@solana/web3.js";

export const str2pubkey = (str: string): PublicKey => {
  return new PublicKey(str);
}