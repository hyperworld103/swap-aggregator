import {
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  CHAIN_ID_POLYGON
} from "@certusone/wormhole-sdk"

import { zeroPad } from "@ethersproject/bytes"
import { uint8ArrayToHex, hexToUint8Array } from "./wormhole/array"

import { PublicKey, AccountInfo, ParsedAccountData, Connection} from '@solana/web3.js'
import { get } from 'lodash-es'

import { TokenAmount } from './common/safe-math';
import { TOKEN_PROGRAM_ID } from './common/ids'
import { findAssociatedTokenAddress, getOneFilteredTokenAccountsByOwner } from './common/web3'
import { getTokenBySymbol as getSolanaTokenBySymbol, NATIVE_SOL, TokenInfo, TOKENS } from './common/tokens'
import { MERCURIAL_POOLS, STABLE_POOLS as SOL_STABLE_POOLS, SABER_POOLS } from './stable-pool/stable_swap';
import { crossTransfer } from "./wormhole"
import { 
  routeSwap, 
  preSwapRoute,

  SPL_ENDPOINT_MERCURIAL, 
  SPL_ENDPOINT_RAY, 
  SPL_ENDPOINT_SABER, 
  getGlobalStateAccount,
} from "./route_swap"

const EUSDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const BUSD = '0xe9e7cea3dedca5984780bafc599bd69add087d56'
const PUSDC = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'

export interface PriceInfo {
  endpoint:string
  midCoinStableAmount:string,
  midCoinStableWithSlippage:TokenAmount,
  price:number,
  priceImpact:number,
  ammId?:string,
  marketAddress?:string,

  dexInfo:any
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTokenAccounts(conn:Connection, wallet:any) {
  if (wallet && wallet.connected) {
    const parsedTokenAccounts = await conn
      .getParsedTokenAccountsByOwner(
        wallet.publicKey,
        {
          programId: TOKEN_PROGRAM_ID
        },
        'confirmed'
      )


      const tokenAccounts: any = {}
      const auxiliaryTokenAccounts: Array<{ pubkey: PublicKey; account: AccountInfo<ParsedAccountData> }> = []

      for (const tokenAccountInfo of parsedTokenAccounts.value) {
        const tokenAccountPubkey = tokenAccountInfo.pubkey
        const tokenAccountAddress = tokenAccountPubkey.toBase58()
        const parsedInfo = tokenAccountInfo.account.data.parsed.info
        const mintAddress = parsedInfo.mint
        const balance = new TokenAmount(parsedInfo.tokenAmount.amount, parsedInfo.tokenAmount.decimals)

        const ata = await findAssociatedTokenAddress(wallet.publicKey, new PublicKey(mintAddress))

        if (ata.equals(tokenAccountPubkey)) {
          tokenAccounts[mintAddress] = {
            tokenAccountAddress,
            balance: balance.fixed(),
            parsedInfo
          }
        } else if (parsedInfo.tokenAmount.uiAmount > 0) {
          auxiliaryTokenAccounts.push(tokenAccountInfo)
        }
      }

      const solBalance = await conn.getBalance(wallet.publicKey, 'confirmed')
      tokenAccounts[NATIVE_SOL.mintAddress] = {
        tokenAccountAddress: wallet.publicKey.toBase58(),
        balance: (new TokenAmount(solBalance, NATIVE_SOL.decimals)).fixed()
      }
      return {
        auxiliaryTokenAccounts,
        tokenAccounts
      }
    

  } // end of if
}

const SPL_WEUSDT = getSolanaTokenBySymbol('weUSDT')
const SPL_WBBUSD = getSolanaTokenBySymbol('wbBUSD')
const SPL_WPUSDC = getSolanaTokenBySymbol('wpUSDC')

async function doSplWormholeTransfer(
  sourceTokenAccount: any,
  amount:string,
  solanaWallet:any,
  // metamaskSigner:any,
  targetAddress: any,
  targetChainStr: string,
){

  const sourceChain = CHAIN_ID_SOLANA // source chain
  // @ts-ignore
  const sourceAsset = sourceTokenAccount.mintAddress // source asset

  let originChain = CHAIN_ID_ETH  
  let originAsset = uint8ArrayToHex(zeroPad(hexToUint8Array(EUSDT.slice(2)), 32)) // origin asset  will be changed by the token mint

  let targetChain = CHAIN_ID_ETH // target chain

  if (targetChainStr === "BSC"){
    originChain = targetChain = CHAIN_ID_BSC
    originAsset = uint8ArrayToHex(zeroPad(hexToUint8Array(BUSD.slice(2)), 32))
  }
  else if(targetChainStr === "Polygon")
  {
    originChain = targetChain = CHAIN_ID_POLYGON
    originAsset = uint8ArrayToHex(zeroPad(hexToUint8Array(PUSDC.slice(2)), 32))

  }
  // @ts-ignore
  // const targetAddress = zeroPad(hexToUint8Array(metamaskAddress.slice(2)), 32) // target address
  // const targetAddressFormatted = zeroPad(hexToUint8Array("0xb576b61fed8AE93E33A09bdE8Ba84af906c24ba6".slice(2)), 32) // target address

  // @ts-ignore
  const metamaskSigner = null
  const terraWallet = null // terra wallet

  return await crossTransfer(
    sourceChain, // source chain
    // @ts-ignore
    sourceAsset, // source asset
    originChain, // origin chain
    // @ts-ignore
    originAsset, // origin asset
    amount, // amount
    targetChain, // target chain
    // @ts-ignore
    targetAddress, // target address
    metamaskSigner, // signer 
    solanaWallet, // solana wallet
    terraWallet, // terra wallet
    sourceTokenAccount // source parsed token account
  );
  
}

function needCreateTokens(tokenAccounts:any, fromMint, midMint, toMint, feeTokenAccount) {
  return !(
    feeTokenAccount && 
    get(tokenAccounts, `${fromMint}.tokenAccountAddress`) &&
    get(tokenAccounts, `${midMint}.tokenAccountAddress`) &&
    get(tokenAccounts, `${toMint}.tokenAccountAddress`)
  )
}

function needWrapSol(tokenAccounts, fromMint, fromCoinAmount) {
  if ([NATIVE_SOL.mintAddress, TOKENS.WSOL.mintAddress].includes(fromMint)) {
    let amount = get(tokenAccounts, `${TOKENS.WSOL.mintAddress}.balance`)
    amount = Math.ceil((amount ? Number(amount) : 0) * 10 ** 9)
    const fromCoinAmountData = Math.ceil(Number(fromCoinAmount) * 10 ** 9)
    if (fromCoinAmountData > amount) return fromCoinAmountData - amount
  }
  return 0
}
//Convert Solana token to USD ERC20, BEP20
export async function swapTokensCrossChain(
  fromChain: string, 
  toChain: string, 
  fromToken: TokenInfo, 
  toToken: TokenInfo, 
  fromAmount: number, 
  slippage: number, 
  priceInfo: PriceInfo, 
  conn: Connection, 
  fromWallet: any , 
  targetAddress: string,
  )
{
  let signedVAA = null
  let amountTransfer = "0";
  if(fromChain === 'Solana'){
    
    let amountNew = ''
    const strFromCoinAmount = '' + fromAmount
    let tokenAccounts = (await getTokenAccounts(conn, fromWallet)).tokenAccounts

      let SPL_STABLE_POOL = SOL_STABLE_POOLS.USDT
      let endpoint2 = SPL_ENDPOINT_RAY
      let wormholeToken = SPL_WEUSDT
      // mercurial stable swap
      if(toChain === 'Ethereum')
      {
        SPL_STABLE_POOL = MERCURIAL_POOLS.wUSD4Pool
        endpoint2 = SPL_ENDPOINT_MERCURIAL
        wormholeToken = SPL_WEUSDT
      }
      else if(toChain === 'BSC'){
        // saber stable swap
        SPL_STABLE_POOL = MERCURIAL_POOLS.wbBUSD4Pool
        endpoint2 = SPL_ENDPOINT_MERCURIAL
        wormholeToken = SPL_WBBUSD
      }
      else if(toChain === 'Polygon'){
        SPL_STABLE_POOL = SABER_POOLS.wpUSDC
        endpoint2 = SPL_ENDPOINT_SABER
        wormholeToken = SPL_WPUSDC
      }
      

    if(priceInfo.endpoint === SPL_ENDPOINT_RAY){
      const endpoint1 = priceInfo.endpoint
      console.time('Solana TXS')

      const stableCoinSymbol = 'USDC'

      let SPL_STABLE_COIN = getSolanaTokenBySymbol(stableCoinSymbol)
      
      const fromMint = fromToken.mintAddress === NATIVE_SOL.mintAddress  ? TOKENS.WSOL.mintAddress : fromToken.mintAddress
      const midMint = SPL_STABLE_COIN.mintAddress

      const amountMid = '' + (parseFloat(priceInfo.midCoinStableWithSlippage.fixed() ) * 995 / 1000)
      console.time('getGlobalStateAccount')
      const {feeOwner} = await getGlobalStateAccount(conn)
      console.timeEnd('getGlobalStateAccount')

      let feeTokenAccountExpected = await findAssociatedTokenAddress(feeOwner, new PublicKey(fromMint));
      let feeTokenAccount = await getOneFilteredTokenAccountsByOwner(conn, feeOwner, new PublicKey(fromMint), feeTokenAccountExpected)

      console.log("FeeOwner", feeOwner.toString())
      console.log("FeeTokenAccount Exp", feeTokenAccountExpected.toString())
      console.log("FeeTokenAccount", feeTokenAccount?.toString())

      if(
          needCreateTokens(tokenAccounts, fromMint, midMint, wormholeToken.mintAddress, feeTokenAccount ) ||
          needWrapSol(tokenAccounts, fromMint, strFromCoinAmount)
      )
      {
        await preSwapRoute(
          conn,
          // @ts-ignore
          fromWallet,
          // @ts-ignore
          fromMint,
          // @ts-ignore
          get(tokenAccounts, `${fromMint}.tokenAccountAddress`),
          
          feeTokenAccount,
          feeOwner,
          
          // @ts-ignore
          midMint,
          get(tokenAccounts, `${midMint}.tokenAccountAddress`),
          // @ts-ignore
          wormholeToken.mintAddress,
          // @ts-ignore
          get(tokenAccounts, `${wormholeToken.mintAddress}.tokenAccountAddress`),
          needWrapSol(tokenAccounts, fromMint, strFromCoinAmount)
        )
        do
        {
          await sleep(500)
          console.log("Confirming prepare swap");

          tokenAccounts = (await getTokenAccounts(conn, fromWallet)).tokenAccounts
          feeTokenAccount = await getOneFilteredTokenAccountsByOwner(conn, feeOwner, new PublicKey(fromMint))
        }while(
          needCreateTokens(tokenAccounts, fromMint, midMint, wormholeToken.mintAddress, feeTokenAccount ) ||
          needWrapSol(tokenAccounts, fromMint, strFromCoinAmount)
        )
      }
      console.timeEnd('Solana TXS')

      // @ts-ignore
      await routeSwap(
        conn,
        fromWallet,

        priceInfo.dexInfo,
        SPL_STABLE_POOL,

        fromMint,
        midMint,
        wormholeToken.mintAddress,
        get(tokenAccounts, `${fromMint}.tokenAccountAddress`),
        get(tokenAccounts, `${midMint}.tokenAccountAddress`),
        get(tokenAccounts, `${wormholeToken.mintAddress}.tokenAccountAddress`),
        
        feeOwner,

        strFromCoinAmount,
        amountMid,

        endpoint1,
        endpoint2
      )
      amountNew = amountMid
    }
    
    amountTransfer = '' + (Math.round(parseFloat(amountNew) * 996) / 1000)
    // amountTransfer = '1'
    const targetAddressFormatted = zeroPad(hexToUint8Array(targetAddress.slice(2)), 32)

    do
    {
      await sleep(500)
      console.log("Confirming wormhole Token exist");

      tokenAccounts = (await getTokenAccounts(conn, fromWallet)).tokenAccounts
    }while(
      !get(tokenAccounts, `${wormholeToken.mintAddress}.tokenAccountAddress`)
    )

    const wormholeSourceToken = {
      decimals: wormholeToken.decimals,
      mintAddress: wormholeToken.mintAddress,
      publicKey: get(tokenAccounts, `${wormholeToken.mintAddress}.tokenAccountAddress`)
    }

    signedVAA = await doSplWormholeTransfer(
        wormholeSourceToken,
        amountTransfer,
        fromWallet,
        targetAddressFormatted,
        toChain,
      )

  }


  return {
    signedVAA,
    amountTransfer
  }

}
