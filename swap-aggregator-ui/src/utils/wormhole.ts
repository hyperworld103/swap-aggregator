import { Commitment, Connection } from "@solana/web3.js";

import { Signer } from "ethers";
import { parseUnits, zeroPad } from "ethers/lib/utils";

import { ConnectedWallet, } from "@terra-money/wallet-provider";
import {
  ChainId,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,

  getEmitterAddressEth,
  getEmitterAddressSolana,

  parseSequenceFromLogEth,
  parseSequenceFromLogSolana,

  transferFromEth,
  transferFromEthNative,
  transferFromSolana,
  transferFromTerra,

  postVaaSolana,
  redeemOnEth,
  redeemOnEthNative,
  redeemOnSolana,

} from "@certusone/wormhole-sdk";

import { hexToUint8Array, uint8ArrayToHex } from "./wormhole/array";
import { signSendAndConfirm } from "./wormhole/solana";

import {
  ETH_BRIDGE_ADDRESS,
  ETH_TOKEN_BRIDGE_ADDRESS,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "./wormhole/consts";
import { getSignedVAAWithRetry } from "./wormhole/getSignedVAAWithRetry";

async function fromEth(
  signer: Signer,
  tokenAddress: string,
  decimals: number,
  amount: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  isNative: boolean
) {
  const amountParsed = parseUnits(amount, decimals);
  const receipt = isNative
    ? await transferFromEthNative(
        ETH_TOKEN_BRIDGE_ADDRESS,
        signer,
        amountParsed,
        recipientChain,
        recipientAddress
      )
    : await transferFromEth(
        ETH_TOKEN_BRIDGE_ADDRESS,
        signer,
        tokenAddress,
        amountParsed,
        recipientChain,
        recipientAddress
      );
  const sequence = parseSequenceFromLogEth(receipt, ETH_BRIDGE_ADDRESS);
  const emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_ADDRESS);

  const { vaaBytes } = await getSignedVAAWithRetry(
    CHAIN_ID_ETH,
    emitterAddress,
    sequence.toString()
  );

  return uint8ArrayToHex(vaaBytes)

}

async function fromSolana(
  wallet: any,
  payerAddress: string, // TODO: we may not need this since we have wallet
  fromAddress: string,
  mintAddress: string,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
  originAddressStr?: string,
  originChain?: ChainId
) {
  const connection = new Connection(SOLANA_HOST, "confirmed" as Commitment);
  const amountParsed = parseUnits(amount, decimals).toBigInt();
  const originAddress = originAddressStr
    ? zeroPad(hexToUint8Array(originAddressStr), 32)
    : undefined;
  const transaction = await transferFromSolana(
    connection,
    SOL_BRIDGE_ADDRESS,
    SOL_TOKEN_BRIDGE_ADDRESS,
    payerAddress,
    fromAddress,
    mintAddress,
    amountParsed,
    targetAddress,
    targetChain,
    originAddress,
    originChain
  );
  const txid = await signSendAndConfirm(wallet, connection, transaction);

  // @ts-ignore
  const info = await connection.getTransaction(txid);
  if (!info) {
    throw new Error("An error occurred while fetching the transaction info");
  }
  const sequence = parseSequenceFromLogSolana(info);
  const emitterAddress = await getEmitterAddressSolana(
    SOL_TOKEN_BRIDGE_ADDRESS
  );

  const { vaaBytes } = await getSignedVAAWithRetry(
    CHAIN_ID_SOLANA,
    emitterAddress,
    sequence
  );
  return uint8ArrayToHex(vaaBytes)
}

async function fromTerra(
  wallet: ConnectedWallet,
  asset: string,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array
) {
  const amountParsed = parseUnits(amount, decimals).toString();
  const msgs = await transferFromTerra(
    wallet.terraAddress,
    TERRA_TOKEN_BRIDGE_ADDRESS,
    asset,
    amountParsed,
    targetChain,
    targetAddress
  );
  return null;
}

export async function crossTransfer(
  sourceChain:any,
  sourceAsset:any,
  originChain:any,
  originAsset:any,
  amount:any,
  targetChain:any,
  targetAddress:any,
  signer:any,
  solanaWallet:any,
  terraWallet:any,
  sourceParsedTokenAccount:any
){
  console.log("Transfer ", amount)

  const decimals = sourceParsedTokenAccount?.decimals;

  const isNative = false;
  const solPK = solanaWallet?.publicKey;
  const sourceTokenPublicKey = sourceParsedTokenAccount?.publicKey;
  let vaa = null
  if (
    sourceChain === CHAIN_ID_ETH &&
    !!signer &&
    !!sourceAsset &&
    decimals !== undefined &&
    !!targetAddress
  ) {
    vaa = await fromEth(

      signer,
      sourceAsset,
      decimals,
      amount,
      targetChain,
      targetAddress,
      isNative
    );
  } else if (
    sourceChain === CHAIN_ID_SOLANA &&
    !!solanaWallet &&
    !!solPK &&
    !!sourceAsset &&
    !!sourceTokenPublicKey &&
    !!targetAddress &&
    decimals !== undefined
  ) {
    vaa = await fromSolana(
      solanaWallet,
      solPK.toString(),
      sourceTokenPublicKey,
      sourceAsset,
      amount,
      decimals,
      targetChain,
      targetAddress,
      originAsset,
      originChain
    );
  } else if (
    sourceChain === CHAIN_ID_TERRA &&
    !!terraWallet &&
    !!sourceAsset &&
    decimals !== undefined &&
    !!targetAddress
  ) {
    vaa = await fromTerra(
      terraWallet,
      sourceAsset,
      amount,
      decimals,
      targetChain,
      targetAddress
    );
  } else {
    //   variant: "error",
    // });
  }
  return vaa
}


async function toEth(
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean
) {
  const receipt = isNative
    ? await redeemOnEthNative(ETH_TOKEN_BRIDGE_ADDRESS, signer, signedVAA)
    : await redeemOnEth(ETH_TOKEN_BRIDGE_ADDRESS, signer, signedVAA);
  return { id: receipt.transactionHash, block: receipt.blockNumber }
}

async function toSolana(
  wallet: any,
  payerAddress: string, // TODO: we may not need this since we have wallet
  signedVAA: Uint8Array
) {
  if (!wallet.signTransaction) {
    throw new Error("wallet.signTransaction is undefined");
  }
  // @ts-ignore
  const connection = new Connection(SOLANA_HOST, "confirmed");
  await postVaaSolana(
    connection,
    wallet.signTransaction,
    SOL_BRIDGE_ADDRESS,
    payerAddress,
    Buffer.from(signedVAA)
  );
  // TODO: how do we retry in between these steps
  const transaction = await redeemOnSolana(
    connection,
    SOL_BRIDGE_ADDRESS,
    SOL_TOKEN_BRIDGE_ADDRESS,
    payerAddress,
    signedVAA
  );
  const txid = await signSendAndConfirm(wallet, connection, transaction);
  // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
  return { id: txid, block: 1 }
}

async function toTerra(
  wallet: ConnectedWallet,
  signedVAA: Uint8Array
) {
    return null;
}

export async function redeemToken(
  targetChain:any,
  signedVAA:any,
  signer:any,
  solanaWallet:any,
  terraWallet:any,
){
  const solPK = solanaWallet?.publicKey;
  let res = null
  if (targetChain === CHAIN_ID_ETH && !!signer && signedVAA) {
    res = await toEth(signer, signedVAA, false);
  } else if (
    targetChain === CHAIN_ID_SOLANA &&
    !!solanaWallet &&
    !!solPK &&
    signedVAA
  ) {
    res = await toSolana(
      solanaWallet,
      solPK.toString(),
      signedVAA
    );
  } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
    res = await toTerra(terraWallet, signedVAA);
  } else {
    // enqueueSnackbar("Redeeming on this chain is not yet supported", {
    //   variant: "error",
    // });
  }
  return res
}
