import { expect } from "chai";
import { Swap } from "../uniswap/libs/types";
import { multiQuote, quote } from "../uniswap/quote";
import { WMATIC_TOKEN, USDC_TOKEN, UNI_TOKEN } from "../uniswap/libs/constants";
import { toReadableAmount } from "../uniswap/libs/conversion";


describe('UniSwap', async () => {
  const maticUSDcSwap: Swap = {
    in: WMATIC_TOKEN,
    amountIn: 100,
    out: USDC_TOKEN,
    poolFee: 500,
  };

  const maticUniSwap: Swap = {
    in: WMATIC_TOKEN,
    amountIn: 100,
    out: UNI_TOKEN,
    poolFee: 3000,
  };

  it ('Gets fetches single quote', async () => {
    const quoteResult = await quote(maticUSDcSwap);
    expect(Number(toReadableAmount(
      quoteResult,
      USDC_TOKEN.decimals
    ))).to.be.within(90, 100);
  });

  it ('Fetches multiple quotes using multicall', async () => {
    const swaps: Swap[] =  [ maticUSDcSwap, maticUniSwap ];
    const [ usdcQuote, uniQuote ] = await multiQuote(swaps);

    expect(Number(toReadableAmount(
      usdcQuote,
      USDC_TOKEN.decimals
    ))).to.be.within(90, 100);

    expect(Number(toReadableAmount(
      uniQuote,
      UNI_TOKEN.decimals
    ))).to.be.within(10, 20);
  });
});