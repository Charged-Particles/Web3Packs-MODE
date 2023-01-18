import { ethers } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { getProvider } from './libs/providers';
import { computePoolAddress } from '@uniswap/v3-sdk'
import { toReadableAmount, fromReadableAmount } from './libs/conversion'
import { QUOTER_CONTRACT_ADDRESS, POOL_FACTORY_CONTRACT_ADDRESS } from './libs/constants'
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'

import { WMATIC_TOKEN, USDC_TOKEN } from './libs/constants';

export interface ExampleConfig {
  tokens: {
    in: Token
    amountIn: number
    out: Token
    poolFee: number
  }
}

const CurrentConfig: ExampleConfig = {
  tokens: {
    in: WMATIC_TOKEN,
    amountIn: 1000,
    out: USDC_TOKEN,
    poolFee: 500,
  },
};

export async function quote(): Promise<string> {
  const quoterContract = new ethers.Contract(
    QUOTER_CONTRACT_ADDRESS,
    Quoter.abi,
    getProvider()
  )
  const poolConstants = await getPoolConstants()

  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    poolConstants.token0,
    poolConstants.token1,
    poolConstants.fee,
    fromReadableAmount(
      CurrentConfig.tokens.amountIn,
      CurrentConfig.tokens.in.decimals
    ).toString(),
    
  )

  return toReadableAmount(quotedAmountOut, CurrentConfig.tokens.out.decimals)
}

async function getPoolConstants(): Promise<{
  token0: string
  token1: string
  fee: number
}> {
  const currentPoolAddress = computePoolAddress({
    factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: CurrentConfig.tokens.in,
    tokenB: CurrentConfig.tokens.out,
    fee: CurrentConfig.tokens.poolFee,
  })

  const poolContract = new ethers.Contract(
    currentPoolAddress,
    IUniswapV3PoolABI.abi,
    getProvider()
  )
  const [token0, token1, fee] = await Promise.all([
    poolContract.token0(),
    poolContract.token1(),
    poolContract.fee(),
  ])

  return {
    token0,
    token1,
    fee,
  }
}
