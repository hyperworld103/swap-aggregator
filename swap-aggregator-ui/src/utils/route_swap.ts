// @ts-ignore
import { nu64, struct, u8 } from 'buffer-layout';
import {
  Account, Connection, 
  PublicKey, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction
} from '@solana/web3.js';

import { swapInstruction as raydiumSwapInstruction } from './raydium-pool/swap';
import { mercurialSwapInstruction, saberSwapInstruction} from './stable-pool/stable_swap';
import { getBigNumber } from './common/layouts';
// eslint-disable-next-line
import { 
  SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID, 
  // FEE_OWNER, 
  ROUTER_PROGRAM_ID, CLOCK_PROGRAM_ID } from './common/ids';
import { 
  getTokenByMintAddress, 
  NATIVE_SOL, TOKENS 
} from './common/tokens';
import { TokenAmount } from './common/safe-math';
import {
  createAssociatedTokenAccountIfNotExist, 
  sendTransaction,
  getOneFilteredTokenAccountsByOwner,
  createAtaSolIfNotExistAndWrap,
  createAssociatedTokenAccountIfNotExist2,
  findProgramAddress,
  findAssociatedTokenAddress
} from './common/web3';
import { publicKey, u64 } from '@project-serum/borsh';

export const SPL_ENDPOINT_RAY = 'Raydium Pool'
export const SPL_ENDPOINT_SRM = 'Serum Dex'
export const SPL_ENDPOINT_SABER = 'Saber Pool'
export const SPL_ENDPOINT_MERCURIAL = 'Mercurial Pool'
export const SPL_ENDPOINT_ATLAS = 'Atlas Pool'
export const SPL_ENDPOINT_ORCA = 'Orca Pool'

const POOL_INDEX:any = {
  'Raydium Pool': 0,
  'Serum Dex': 1,
  'Saber Pool': 2,
  'Mercurial Pool': 3,
  'Orca Pool': 4,
}

export async function preSwapRoute(
  connection: Connection,
  wallet: any,
  
  fromMint: string,
  fromTokenAccount: string,

  feeAccount:string,
  feeOwner: PublicKey,

  middleMint: string,
  middleTokenAccount: string,

  toMint: string,
  toTokenAccount: string,

  needWrapAmount: number
) {
  console.time("preSwapRoute")
  const transaction = new Transaction()
  const signers: Account[] = []
  const owner = wallet.publicKey
  if (fromMint === TOKENS.WSOL.mintAddress) {
    await createAtaSolIfNotExistAndWrap(connection, fromTokenAccount, owner, transaction, signers, needWrapAmount)
  }
  const feeTokenMint = fromMint

  await createAssociatedTokenAccountIfNotExist2(feeAccount, feeOwner, owner,  feeTokenMint, transaction)

  await createAssociatedTokenAccountIfNotExist(middleTokenAccount, owner, middleMint, transaction)

  await createAssociatedTokenAccountIfNotExist(toTokenAccount, owner, toMint, transaction)

  console.timeEnd("preSwapRoute")

  return await sendTransaction(connection, wallet, transaction, signers)
}

export async function routeSwap(
  connection: Connection,
  wallet: any,

  poolInfo1: any,
  poolInfo2:any,
  
  fromCoinMint: string,
  midCoinMint: string,
  toCoinMint: string,
  
  fromTokenAccount: string,
  midTokenAccount: string,
  toTokenAccount: string,
  
  feeOwner: PublicKey,

  aIn: string,
  aOut:string,

  route1:string,
  route2:string,
) {

  const transaction = new Transaction()
  const signers: Account[] = []

  const owner = wallet.publicKey

  const from = getTokenByMintAddress(fromCoinMint)
  const mid = getTokenByMintAddress(midCoinMint)
  const to = getTokenByMintAddress(toCoinMint)
  if (!from || !to) {
    throw new Error('Miss token info')
  }

  const amountIn = new TokenAmount(aIn, from.decimals, false)
  const amountMid = new TokenAmount(aOut, mid?.decimals, false)

  let fromMint = fromCoinMint
  let toMint = toCoinMint
  let midMint = midCoinMint

  if (fromMint === NATIVE_SOL.mintAddress) fromMint = TOKENS.WSOL.mintAddress
  if (midMint === NATIVE_SOL.mintAddress) midMint = TOKENS.WSOL.mintAddress
  if (toMint === NATIVE_SOL.mintAddress) toMint = TOKENS.WSOL.mintAddress

  const newFromTokenAccount = new PublicKey(fromTokenAccount)
  const newMidTokenAccount = new PublicKey(midTokenAccount)
  const newToTokenAccount = new PublicKey(toTokenAccount)
  
  const inAmount = Math.floor(getBigNumber(amountIn.toWei()))

  const midAmount = Math.floor(getBigNumber(amountMid.toWei()) * (10000 - 15) / 10000)
  
  let feeTokenAccount = null
  let feeTokenAccountExpected = await findAssociatedTokenAddress(feeOwner, new PublicKey(fromMint));

  while(!feeTokenAccount){
    feeTokenAccount = await getOneFilteredTokenAccountsByOwner(connection, feeOwner, new PublicKey(fromMint), feeTokenAccountExpected)
  }
  console.log("Aggregating fee account -->", feeTokenAccount)

  const stateId = await getGlobalStateAddress();

  transaction.add(
    routeSwapInstruction(
      poolInfo1,
      poolInfo2,

      POOL_INDEX[route1],
      POOL_INDEX[route2],

      stateId,

      newFromTokenAccount,
      newMidTokenAccount,
      newToTokenAccount,

      owner,
      new PublicKey(feeTokenAccount),

      inAmount,
      midAmount
    )
  )

  transaction.add(
    (map2SwapInstructions[POOL_INDEX[route2]])(
      poolInfo2, 
      newMidTokenAccount, 
      newToTokenAccount, 
      owner, 
      midAmount, 
      0 )
  )

  return await sendTransaction(connection, wallet, transaction, signers)
}

async function createGlobalStateId(programId: PublicKey, bufferKey: string) {
  const { publicKey } = await findProgramAddress(
    [Buffer.from(bufferKey), programId.toBuffer()],
    programId
  )
  return publicKey
}

const ROUTE_STATE_SEED = "Dex router state"
export const GLOBAL_STATE_LAYOUT = struct([
  u8("isInitialized"),
  publicKey("stateOwner"),
  publicKey("feeOwner"),

  u64('feeNumerator'),
  u64('feeDenominator'),
  
]);  
export async function getGlobalStateAddress(){
  return await createGlobalStateId(new PublicKey(ROUTER_PROGRAM_ID), ROUTE_STATE_SEED)
}

export async function getGlobalStateAccount(conn:any) : Promise<any>
{
  const stateId = await getGlobalStateAddress()
  const state = await conn.getAccountInfo(stateId)
  let state_account = null
  if(state)
  {
    const stateData:any = GLOBAL_STATE_LAYOUT.decode(Buffer.from(state.data))

    if (stateData.isInitialized) {
      state_account = {
        ...stateData
      }
    }
  }
  console.log(state_account)
  return state_account
}


export async function initGlobalState(
  connection: Connection,
  wallet: any,
) {
  const transaction = new Transaction()
  const signers: Account[] = []

  transaction.add(
    updateGlobalStateInstruction(
      (await getGlobalStateAddress()),
      wallet.publicKey,
      wallet.publicKey,
      // new PublicKey("32HUGVFfcXTu3kjRV933Bmf4ekGhc6hqrsakz8x9oHfu"),
      new PublicKey("7PYjMJqt1bRsFr6CBg5n484wXV6rEvjw2PfHuTPiv7WX"),
      20,
      10000
    )
  )

  return await sendTransaction(connection, wallet, transaction, signers)
}

function getRaydiumAccountInfos(rayPoolInfo:any)
{
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

function getRaydiumInstructions(
  poolInfo:any, 
  sourceToken:any, 
  destToken:any, 
  userOwner:any,
  amountIn:number,
  amountOut:number
){
  return raydiumSwapInstruction(
          new PublicKey(poolInfo.programId),
          new PublicKey(poolInfo.ammId),
          new PublicKey(poolInfo.ammAuthority),
          new PublicKey(poolInfo.ammOpenOrders),
          new PublicKey(poolInfo.ammTargetOrders),
          new PublicKey(poolInfo.poolCoinTokenAccount),
          new PublicKey(poolInfo.poolPcTokenAccount),
          new PublicKey(poolInfo.serumProgramId),
          new PublicKey(poolInfo.serumMarket),
          new PublicKey(poolInfo.serumBids),
          new PublicKey(poolInfo.serumAsks),
          new PublicKey(poolInfo.serumEventQueue),
          new PublicKey(poolInfo.serumCoinVaultAccount),
          new PublicKey(poolInfo.serumPcVaultAccount),
          new PublicKey(poolInfo.serumVaultSigner),
          sourceToken,
          destToken,
          userOwner,
          amountIn,
          amountOut
        )
}

function getSerumAccountInfos(_poolInfo:any)
{
  return [
  ]
}

function getSerumInstructions(
  poolInfo:any, 
  sourceToken:any, 
  destToken:any, 
  userOwner:any,
  amountIn:number,
  amountOut:number
){
  return raydiumSwapInstruction(
          new PublicKey(poolInfo.programId),
          new PublicKey(poolInfo.ammId),
          new PublicKey(poolInfo.ammAuthority),
          new PublicKey(poolInfo.ammOpenOrders),
          new PublicKey(poolInfo.ammTargetOrders),
          new PublicKey(poolInfo.poolCoinTokenAccount),
          new PublicKey(poolInfo.poolPcTokenAccount),
          new PublicKey(poolInfo.serumProgramId),
          new PublicKey(poolInfo.serumMarket),
          new PublicKey(poolInfo.serumBids),
          new PublicKey(poolInfo.serumAsks),
          new PublicKey(poolInfo.serumEventQueue),
          new PublicKey(poolInfo.serumCoinVaultAccount),
          new PublicKey(poolInfo.serumPcVaultAccount),
          new PublicKey(poolInfo.serumVaultSigner),
          sourceToken,
          destToken,
          userOwner,
          amountIn,
          amountOut,
        )
}


function getSaberAccountInfos(poolInfo:any)
{
  return [
    { pubkey: poolInfo.ammId, isSigner: false, isWritable: true },
    { pubkey: poolInfo.ammAuthority, isSigner: false, isWritable: false },
    { pubkey: poolInfo.poolCoinTokenAccount, isSigner: false, isWritable: true },
    { pubkey: poolInfo.poolPcTokenAccount, isSigner: false, isWritable: true },
    { pubkey: poolInfo.feeAccount, isSigner: false, isWritable: true },

    { pubkey: CLOCK_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: poolInfo.programId, isSigner: false, isWritable: false },
  ]
}

function getSaberInstructions(
  poolInfo:any, 
  sourceToken:any, 
  destToken:any, 
  userOwner:any,
  amountIn:number,
  amountOut:number
){
  return saberSwapInstruction(
    new PublicKey(poolInfo.ammId),
    new PublicKey(poolInfo.ammAuthority),
    userOwner,
    sourceToken,
    new PublicKey(poolInfo.poolCoinTokenAccount),
    new PublicKey(poolInfo.poolPcTokenAccount),
    destToken,
    new PublicKey(poolInfo.feeAccount),
    new PublicKey(poolInfo.programId),
    amountIn,
    amountOut,
  )
}

function getMercurialAccountInfos(poolInfo:any)
{
  return [
    { pubkey: poolInfo.ammId, isSigner: false, isWritable: true },
    { pubkey: poolInfo.ammAuthority, isSigner: false, isWritable: false },

    ...poolInfo.accounts.map((tokenAccount:string) => ({ pubkey: tokenAccount, isSigner: false, isWritable: true })),
    
    { pubkey: poolInfo.programId, isSigner: false, isWritable: false },
  ]
}

function getMercurialInstructions(
  poolInfo:any, 
  sourceToken:any, 
  destToken:any, 
  userOwner:any,
  amountIn:number,
  amountOut:number
){
  return mercurialSwapInstruction(
          new PublicKey(poolInfo.ammId),
          new PublicKey(poolInfo.ammAuthority),
          userOwner,
          poolInfo.accounts,
          sourceToken,
          destToken,
          amountIn,
          amountOut,
          new PublicKey(poolInfo.programId),
        )
}



function getOrcaAccountInfos(_poolInfo:any)
{
  return [
  ]
}
function getOrcaInstructions(
  poolInfo:any, 
  sourceToken:any, 
  destToken:any, 
  userOwner:any,
  amountIn:number,
  amountOut:number
){
  return raydiumSwapInstruction(
          new PublicKey(poolInfo.programId),
          new PublicKey(poolInfo.ammId),
          new PublicKey(poolInfo.ammAuthority),
          new PublicKey(poolInfo.ammOpenOrders),
          new PublicKey(poolInfo.ammTargetOrders),
          new PublicKey(poolInfo.poolCoinTokenAccount),
          new PublicKey(poolInfo.poolPcTokenAccount),
          new PublicKey(poolInfo.serumProgramId),
          new PublicKey(poolInfo.serumMarket),
          new PublicKey(poolInfo.serumBids),
          new PublicKey(poolInfo.serumAsks),
          new PublicKey(poolInfo.serumEventQueue),
          new PublicKey(poolInfo.serumCoinVaultAccount),
          new PublicKey(poolInfo.serumPcVaultAccount),
          new PublicKey(poolInfo.serumVaultSigner),
          sourceToken,
          destToken,
          userOwner,
          amountIn,
          amountOut,
        )
}

const map2DexAccountKeys = [
  getRaydiumAccountInfos,
  getSerumAccountInfos,
  getSaberAccountInfos,
  getMercurialAccountInfos,
  getOrcaAccountInfos,
]

const map2SwapInstructions = [
  getRaydiumInstructions,
  getSerumInstructions,
  getSaberInstructions,
  getMercurialInstructions,
  getOrcaInstructions,
]

export function updateGlobalStateInstruction(
  stateId: PublicKey,
  curStateOwner: PublicKey,
  newStateOwner: PublicKey,
  feeOwner: PublicKey,
  feeNumerator: number,
  feeDenominator: number

): TransactionInstruction {
  const dataLayout = struct([u8('instruction'), nu64('feeNumerator'), nu64('feeDenominator')])
    
  const keys = [

    { pubkey: stateId, isSigner: false, isWritable: true },
    { pubkey: curStateOwner, isSigner: true, isWritable: false },
    { pubkey: newStateOwner, isSigner: false, isWritable: false },
    { pubkey: feeOwner, isSigner: false, isWritable: false },

    { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ]

  const data = Buffer.alloc(dataLayout.span)
  dataLayout.encode(
    {
      instruction: 1,
      feeNumerator,
      feeDenominator,
    },
    data
  )

  return new TransactionInstruction({
    keys,
    programId: new PublicKey(ROUTER_PROGRAM_ID),
    data
  })
}


export function routeSwapInstruction(
  pool1:any,
  _pool2:any,
  route1:number,
  route2:number,
  
  stateId: PublicKey,
  // user
  userSourceTokenAccount: PublicKey,
  userStableTokenAccount: PublicKey,
  userDestTokenAccount: PublicKey,
  userOwner: PublicKey,

  feeTokenAccount:PublicKey,
  
  amountIn: number,
  amountOut: number

): TransactionInstruction {
  const dataLayout = struct([u8('instruction'), u8('route1'), u8('route2'), nu64('amountIn'), nu64('amountOut'), ])
    
  const keys = [
    { pubkey: stateId, isSigner: false, isWritable: false },
    { pubkey: userOwner, isSigner: true, isWritable: false },
    { pubkey: userSourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userStableTokenAccount, isSigner: false, isWritable: true },
    // { pubkey: userDestTokenAccount, isSigner: false, isWritable: true },
    { pubkey: feeTokenAccount, isSigner: false, isWritable: true },

    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },

    ...(map2DexAccountKeys[route1])(pool1),
    // ...(map2DexAccountKeys[route2])(pool2),

  ]

  const data = Buffer.alloc(dataLayout.span)
  dataLayout.encode(
    {
      instruction: 0,
      route1,
      route2,
      amountIn,
      amountOut
    },
    data
  )

  return new TransactionInstruction({
    keys,
    programId: new PublicKey(ROUTER_PROGRAM_ID),
    data
  })
}
