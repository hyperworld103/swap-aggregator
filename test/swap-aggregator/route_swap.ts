import { AccountMeta, Connection, PublicKey, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";
// @ts-ignore
import { nu64, struct, u8, publicKey, u64 } from 'buffer-layout';
import { SYSTEM_PROGRAM_ID, SWAP_AGGREGATOR_PROGRAM_ID, TOKEN_PROGRAM_ID } from "../common/ids";
import { loadPools,  getPoolAccountInfos} from "../pools";
import { AggregatorPath } from "../common/types";

export const ROUTE_STATE_SEED = "Dex router state";

export async function getGlobalStateAddress(): Promise<PublicKey> {
  const [ address, nonce ] = await PublicKey.findProgramAddress(
    [ Buffer.from(ROUTE_STATE_SEED), SWAP_AGGREGATOR_PROGRAM_ID.toBuffer()],
    SWAP_AGGREGATOR_PROGRAM_ID
  );
  return address;
}

export async function getGlobalStateAccount(connection: Connection): Promise<any> {
  const stateId = await getGlobalStateAddress();
  const state = await connection.getAccountInfo(stateId);

  const GLOBAL_STATE_LAYOUT = struct([
    u8("isInitialized"),
    publicKey("stateOwner"),
    publicKey("feeOwner"),
    u64('feeNumerator'),
    u64('feeDenominator'),
  ]);  

  let state_account = null;
  if (state) {
    const stateData:any = GLOBAL_STATE_LAYOUT.decode(Buffer.from(state.data));
    if (stateData.isInitialized) {
      state_account = {
        ...stateData
      }
    }
  }
  return state_account;
}

export function updateGlobalStateInstruction(
  stateId: PublicKey,
  curStateOwner: PublicKey,
  newStateOwner: PublicKey,
  feeOwner: PublicKey,
  feeNumerator: number,
  feeDenominator: number
): TransactionInstruction {
  const dataLayout = struct([u8('instruction'), nu64('feeNumerator'), nu64('feeDenominator')])
  const keys: AccountMeta[] = [
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
      instruction: 0,
      feeNumerator,
      feeDenominator,
    },
    data
  )

  return new TransactionInstruction({
    keys,
    programId: SWAP_AGGREGATOR_PROGRAM_ID,
    data
  })
}

export function routeSwapInstruction(
  pool: any,
  route1: AggregatorPath,
  route2: AggregatorPath,   // Unused [warning]
  stateId: PublicKey,
  sourceMint: PublicKey,
  destMint: PublicKey,
  userSourceTokenAccount: PublicKey,
  userDestTokenAccount: PublicKey,
  userOwner: PublicKey,
  feeTokenAccount: PublicKey,
  amountIn: number,
  amountOut: number
): TransactionInstruction {
  const dataLayout = struct([u8('instruction'), u8('route1'), u8('route2'), nu64('amountIn'), nu64('amountOut'), ])
  const keys = [
    { pubkey: stateId, isSigner: false, isWritable: false },
    { pubkey: userOwner, isSigner: true, isWritable: false },
    { pubkey: userSourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: userDestTokenAccount, isSigner: false, isWritable: true },
    { pubkey: feeTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ...getPoolAccountInfos(sourceMint, destMint, route1, pool),
  ]

  const data = Buffer.alloc(dataLayout.span)
  dataLayout.encode(
    {
      instruction: 1,
      route1,
      route2,
      amountIn,
      amountOut
    },
    data
  )

  return new TransactionInstruction({
    keys,
    programId: new PublicKey(SWAP_AGGREGATOR_PROGRAM_ID),
    data
  })
}