import fs from 'fs';
import metadata from '../public/metadata/metadata.json';
import {
  USDC_USDT_SWAP,
  WMATIC_USDC_SWAP,
  WAMTIC_UNI_SWAP
} from '../uniswap/libs/constants';

const createWeb3PackMetadata = () => {
  // iterate over swaps constants and add out token to metadata
  const web3PackTrades = [
    [ WMATIC_USDC_SWAP, WAMTIC_UNI_SWAP ],
  ];

  // for every swap in swaps create a new object with the out token address as key
  web3PackTrades.forEach((trades, index) => {
    const swaps = trades.map((swap) => {
      const { in: tokenIn, out: tokenOut } = swap;
      return {
        in: {
          address: tokenIn.address,
          decimals: tokenIn.decimals,
          name: tokenIn.name,
          symbol: tokenIn.symbol
        },
        out: {
          address: tokenOut.address,
          decimals: tokenOut.decimals,
          name: tokenOut.name,
          symbol: tokenOut.symbol
        }
      }
    }); 
    const fileName = `${index + 1}_web3Pack`;
    const  swapMetadata = {
      ...metadata,
      swaps
    }
    // create new json file with the merged metada
    fs.writeFileSync(`./public/metadata/${fileName}.json`, JSON.stringify(swapMetadata, null, 2));
  });
};

createWeb3PackMetadata();