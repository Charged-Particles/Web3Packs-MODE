import { quote } from "../uniswap/quote";

describe('UniSwap', async () => {
  it.only('Gets a pool contract', async () => {
    const quoteResult = await quote();
    console.log(quoteResult);
  });
});