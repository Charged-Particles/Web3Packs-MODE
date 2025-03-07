// SPDX-License-Identifier: MIT

// SingleSidedWethIonx.sol
// Copyright (c) 2025 Firma Lux, Inc. <https://charged.fi>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

pragma solidity 0.8.17;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../routers/AlgebraRouter.sol";
import "../../../interfaces/v2/IWeb3PacksBundler.sol";

/*
  Performs a Single-Sided Swap on Kim Exchange using the Algebra Router
  Token 0 = WETH
  Token 1 = IONX
 */
contract SingleSidedWethIonx is IWeb3PacksBundler, AlgebraRouter {
  address internal _primaryToken;

  // Inherit from the Algebra Router
  constructor(
    address weth,
    address primaryToken, // for reuse on various chains
    address router,
    address manager,
    string memory bundlerId,
    int24 tickLower,
    int24 tickUpper
  )
    AlgebraRouter(weth, router, manager, bundlerId, tickLower, tickUpper)
  {
    _primaryToken = primaryToken;
  }

  // Token 1 = IONX on Mode (Kim Exchange)
  function getToken1() public view override returns (IWeb3PacksDefs.Token memory token1) {
    IWeb3PacksDefs.Token memory token = IWeb3PacksDefs.Token({
      tokenAddress: _primaryToken,
      tokenDecimals: 18,
      tokenSymbol: "IONX"
    });
    return token;
  }

  function getLiquidityToken(uint256) public override view returns (address tokenAddress, uint256 tokenId) {
    tokenAddress = getToken1().tokenAddress;
    tokenId = 0;
  }

  // NOTE: Call via "staticCall" for Quote
  function quoteSwap(bool reverse) public payable virtual returns (uint256 amountOut) {
    enterWeth(msg.value);
    amountOut = swapSingle(10000, reverse);
  }

  function bundle(uint256, address sender)
    payable
    external
    override
    onlyManagerOrSelf
    returns(
      address tokenAddress,
      uint256 amountOut,
      uint256 nftTokenId
    )
  {
    // Perform Swap
    amountOut = swapSingle(10000, false); // 100% WETH -> IONX

    // Transfer back to Manager
    tokenAddress = getToken1().tokenAddress;
    nftTokenId = 0;
    TransferHelper.safeTransfer(tokenAddress, _manager, amountOut);

    // Refund Unused Amounts
    refundUnusedTokens(sender);
  }

  function unbundle(address payable receiver, uint256, bool sellAll)
    external
    override
    onlyManagerOrSelf
    returns(uint256 ethAmountOut)
  {
    // Perform Swap
    swapSingle(10000, true); // 100% IONX -> WETH

    // Transfer Assets to Receiver
    if (sellAll) {
      ethAmountOut = exitWethAndTransfer(receiver);
    } else {
      TransferHelper.safeTransfer(getToken0().tokenAddress, receiver, getBalanceToken0());
    }
  }
}
