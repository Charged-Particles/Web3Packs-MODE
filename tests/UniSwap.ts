import { expect } from "chai";
import { Swap } from "../uniswap/libs/types";
import { multiQuote, quote } from "../uniswap/quote";
import { WMATIC_TOKEN, USDC_TOKEN, UNI_TOKEN } from "../uniswap/libs/constants";

describe('UniSwap', async () => {
  const maticUSDcSwap: Swap = {
    tokens: {
      in: WMATIC_TOKEN,
      amountIn: 100,
      out: USDC_TOKEN,
      poolFee: 500,
    },
  };

  const maticUniSwap: Swap = {
    tokens: {
      in: WMATIC_TOKEN,
      amountIn: 100,
      out: UNI_TOKEN,
      poolFee: 3000,
    },
  };

  it ('Gets fetches single quote', async () => {
    const quoteResult = await quote(maticUSDcSwap);
    expect(Number(quoteResult)).to.be.within(90,100);
  });

  it.only ('Fetches multiple quotes using multicall', async () => {
    const swaps: Swap[] =  [maticUSDcSwap, maticUniSwap]
    const quotesResult = await multiQuote(swaps);
    console.log(quotesResult);
  });
});