import { Token } from '@uniswap/sdk-core'

export interface Swap {
  in: Token
  amountIn: number
  out: Token
  poolFee: number
}