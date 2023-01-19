import { expect } from "chai";
import { Swap } from "../uniswap/libs/types";
import { quote } from "../uniswap/quote";
import { WMATIC_TOKEN, USDC_TOKEN } from "../uniswap/libs/constants";

describe('UniSwap', async () => {
  it ('Gets fetches single quote', async () => {
    const swap: Swap = {
      tokens: {
        in: WMATIC_TOKEN,
        amountIn: 100,
        out: USDC_TOKEN,
        poolFee: 500,
      },
    };
    
    const quoteResult = await quote(swap);
    expect(Number(quoteResult)).to.be.within(90,100);
  });

  it.skip ('Fetches multiple quotes using multicall', async () => {
    // const swaps: [Swap] =  []
    // const quotesResult = await multiQuotes(swaps);
  });
});