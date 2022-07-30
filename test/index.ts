import { 
  PublicKey, 
  clusterApiUrl, 
  Connection,
  sendAndConfirmTransaction,
  Keypair,
  Transaction,
  Signer,
} from "@solana/web3.js";

import { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

import { 
  getGlobalStateAddress, 
  getGlobalStateAccount, 
  updateGlobalStateInstruction,
  routeSwapInstruction
} from "./swap-aggregator/route_swap";

import { loadPools } from "./pools";
import { AggregatorPath } from "./common/types";
import { user, feeOwner } from "./test_wallets";
import { str2pubkey } from "./common/utils";

const CLUSTER: string = "devnet"
const SOLANA_HOST: string = CLUSTER == "mainnet" ? clusterApiUrl("mainnet-beta") : clusterApiUrl("devnet");
console.log(SOLANA_HOST);

const commitment = 'confirmed'
const connection = new Connection(SOLANA_HOST, commitment);

const initGlobalState = async() => {
  const stateId = await getGlobalStateAddress();
  const transaction = new Transaction();

  transaction.add(
    updateGlobalStateInstruction(
      stateId,
      user.publicKey,
      user.publicKey,
      feeOwner.publicKey,
      200,
      10000
    )
  );
  
  await sendAndConfirmTransaction(connection, transaction, [user]);
}

const routeSwap = async(
  poolInfo: any,
  userWallet: Signer,
  sourceMint: PublicKey,
  destMint: PublicKey,
  userSourceTokenAccount: PublicKey,
  userDestTokenAccount: PublicKey,
  feeTokenAccount: PublicKey,
  amountIn: number,
  amountOut: number,
) => {
  const stateId = await getGlobalStateAddress();
  const transaction = new Transaction();
  transaction.add(
    routeSwapInstruction(
      poolInfo,
      AggregatorPath.Raydium,
      AggregatorPath.Skip,
      stateId,
      sourceMint,
      destMint,
      userSourceTokenAccount,
      userDestTokenAccount,
      userWallet.publicKey,
      feeTokenAccount,
      amountIn,
      amountOut
    )
  )
//  await sendAndConfirmTransaction(connection, transaction, [userWallet]);
}

const main = async() => {
  //const raydiumPools = await loadPools(AggregatorPath.Raydium);
  await initGlobalState()
  const poolInfo = {};
  const sourceMint = str2pubkey("7PYjMJqt1bRsFr6CBg5n484wXV6rEvjw2PfHuTPiv7WX");
  const destMint = str2pubkey("7PYjMJqt1bRsFr6CBg5n484wXV6rEvjw2PfHuTPiv7WX");
  const userSourceTokenAccount = await getAssociatedTokenAddress(sourceMint, user.publicKey);
  const userDestTokenAccount = await getAssociatedTokenAddress(destMint, user.publicKey);

  const feeTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    user,
    sourceMint,
    feeOwner.publicKey
  );

  // await routeSwap(
  //   poolInfo,
  //   user,
  //   sourceMint,
  //   destMint,
  // )
}

(async() => {
  await main();
})()


