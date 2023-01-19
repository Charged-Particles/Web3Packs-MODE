import { Token } from '@uniswap/sdk-core'

export interface Swap {
  tokens: {
    in: Token
    amountIn: number
    out: Token
    poolFee: number
  }
}