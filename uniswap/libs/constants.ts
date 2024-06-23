import { Token, SupportedChainId } from '@uniswap/sdk-core'
import { Swap } from './types';

// todo convert to object chainId => address
export const POOL_FACTORY_CONTRACT_ADDRESS =
  '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const QUOTER_CONTRACT_ADDRESS =
  '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';

export const WMATIC_TOKEN = new Token(
  SupportedChainId.POLYGON,
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  18,
  'WMATIC',
  'Wrapped Matic'
)

export const UNI_TOKEN = new Token(
  SupportedChainId.POLYGON,
  '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
  18,
  'UNI',
  'Uniswap'
)

export const USDC_TOKEN = new Token(
  SupportedChainId.POLYGON,
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  6,
  'USDC',
  'USD//C'
)

export const USDT_TOKEN = new Token(
  SupportedChainId.POLYGON,
  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  6,
  'USDT',
  'USD//T'
)

export const USDC_USDT_SWAP: Swap = {
  in: USDC_TOKEN,
  amountIn: 10,
  out: USDT_TOKEN,
  poolFee: 3000,
};

export const WMATIC_USDC_SWAP: Swap = {
  in: WMATIC_TOKEN,
  amountIn: 10,
  out: USDC_TOKEN,
  poolFee: 500,
};

export const WAMTIC_UNI_SWAP: Swap = {
  in: WMATIC_TOKEN,
  amountIn: 10,
  out: UNI_TOKEN,
  poolFee: 3000,
};
