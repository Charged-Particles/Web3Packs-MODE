import { expect } from "chai";
import { quote } from "../uniswap/quote";

describe('UniSwap', async () => {
  it ('Gets fetches single quote', async () => {
    const quoteResult = await quote();
    expect(quoteResult).to.be.eq('93');
  });
});