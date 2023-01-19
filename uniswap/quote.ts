import { Swap } from './libs/types';
import { BigNumber, BigNumberish, ethers } from 'ethers'
import { getProvider } from './libs/providers';
import { computePoolAddress } from '@uniswap/v3-sdk'
import { fromReadableAmount } from './libs/conversion'
import { QUOTER_CONTRACT_ADDRESS, POOL_FACTORY_CONTRACT_ADDRESS } from './libs/constants'
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json'
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'


export async function quote(swap: Swap): Promise<BigNumber> {
  const quoterContract = new ethers.Contract(
    QUOTER_CONTRACT_ADDRESS,
    Quoter.abi,
    getProvider()
  )

  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    swap.in.address,
    swap.out.address,
    swap.poolFee,
    fromReadableAmount(
      swap.amountIn,
      swap.in.decimals
    ).toString(),
    0
  )

  return quotedAmountOut;
  // return toReadableAmount(quotedAmountOut, swap.tokens.out.decimals)
}

export async function multiQuote(swaps: Swap[]): Promise<BigNumber[]> {
  const quotesPromises = swaps.map(swap => { return quote(swap) });

  return await Promise.all(quotesPromises)
};

export function amountOutMinimum(swapEstimation: BigNumber, slippagePercent: number = 1): BigNumber{
  if (slippagePercent > 100) {
    throw new Error('slippagePercent cannot be greater than 100');
  }

  const slippage = 100 - slippagePercent; 

  return swapEstimation.mul(BigNumber.from(slippage)).div(BigNumber.from(100)); 
};

export async function getPoolConstants(swap: Swap): Promise<{
  token0: string
  token1: string
  fee: number
}> {
  const currentPoolAddress = computePoolAddress({
    factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
    tokenA: swap.in,
    tokenB: swap.out,
    fee: swap.poolFee,
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
