import fs from 'fs';
import metadata from '../public/metadata.json';
import {
  USDC_USDT_SWAP,
  WMATIC_USDC_SWAP,
  WAMTIC_UNI_SWAP
} from '../uniswap/libs/constants';

const createWeb3PackMetadata = () => {
  // iterate over swaps constants and add out token to metadata
  const swaps = [USDC_USDT_SWAP, WMATIC_USDC_SWAP, WAMTIC_UNI_SWAP];

  // for every swap in swaps create a new object with the out token address as key
  swaps.forEach((swap, index) => {
    const { in: tokenIn, out: tokenOut } = swap;
    const  swapMetadata = {
      ...metadata,
      swap: {
        out: {
          address: tokenOut.address,
          decimals: tokenOut.decimals,
          name: tokenOut.name,
          symbol: tokenOut.symbol
        },
        in: {
         address: tokenIn.address,
          decimals: tokenIn.decimals,
          name: tokenIn.name,
          symbol: tokenIn.symbol
        }
      }
    }
    // create new json file with the merged metada
    console.log(swapMetadata);
    // fs.writeFileSync(`./${index}.json`, JSON.stringify(swapMetadata, null, 2));
  });
};

createWeb3PackMetadata();