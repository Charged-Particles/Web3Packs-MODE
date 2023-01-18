import { Token, SupportedChainId } from '@uniswap/sdk-core'

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

export const USDC_TOKEN = new Token(
  SupportedChainId.POLYGON,
  '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  6,
  'USDC',
  'USD//C'
)
