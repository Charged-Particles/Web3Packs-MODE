// SPDX-License-Identifier: MIT

// LPWethMode.sol
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

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../routers/AlgebraRouter.sol";
import "../../../interfaces/v2/IWeb3PacksBundler.sol";


/*
  Creates a Liquidity Position on Kim Exchange using the Algebra Router
  Token 0 = WETH 50%
  Token 1 = MODE 50%
 */
contract LPWethMode is IWeb3PacksBundler, AlgebraRouter {
  // Inherit from the Algebra Router
  constructor(IWeb3PacksDefs.RouterConfig memory config) AlgebraRouter(config) {}

  // Token 0 = WETH
  // Token 1 = Mode on Mode (Kim Exchange)
  function getToken1() public view override returns (IWeb3PacksDefs.Token memory token1) {
    IWeb3PacksDefs.Token memory token = IWeb3PacksDefs.Token({
      tokenAddress: _primaryToken,
      tokenDecimals: 18,
      tokenSymbol: "MODE"
    });
    return token;
  }

  function getLiquidityToken(uint256 packTokenId) public override view returns (address tokenAddress, uint256 tokenId) {
    tokenAddress = _router;
    tokenId = _liquidityPositionsByTokenId[packTokenId].lpTokenId;
  }

  // NOTE: Call via "staticCall" for Quote
  function quoteSwap(bool reverse) public payable virtual returns (uint256 amountOut) {
    enterWeth(msg.value);
    amountOut = swapSingle(10000, reverse);
  }

  function bundle(uint256 packTokenId, address sender)
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
    uint256 wethBalance = getBalanceToken0();

    // Perform Swap
    amountOut = swapSingle(5000, false); // 50% WETH -> MODE
    wethBalance = getBalanceToken0();

    // Deposit Liquidity
    (uint256 lpTokenId, uint256 liquidity, , ) = createLiquidityPosition(wethBalance, amountOut, 0, 0, false);
    nftTokenId = lpTokenId;

    // Transfer back to Manager
    tokenAddress = _router;
    IERC721(tokenAddress).safeTransferFrom(address(this), _manager, nftTokenId);

    // Track Liquidity Position by Pack Token ID
    _liquidityPositionsByTokenId[packTokenId] = IWeb3PacksDefs.LiquidityPosition({
      lpTokenId: lpTokenId,
      liquidity: liquidity,
      stable: false
    });

    // Refund Unused Amounts
    refundUnusedTokens(sender);
  }

  function unbundle(address payable receiver, uint256 packTokenId, bool sellAll)
    external
    override
    onlyManagerOrSelf
    returns(uint256 ethAmountOut)
  {
    // Remove Liquidity
    IWeb3PacksDefs.LiquidityPosition memory liquidityPosition = _liquidityPositionsByTokenId[packTokenId];
    removeLiquidityPosition(liquidityPosition);
    collectLpFees(liquidityPosition);

    // Perform Swap
    if (sellAll) {
      // Swap Assets back to WETH
      swapSingle(10000, true); // 100% MODE -> WETH
      ethAmountOut = exitWethAndTransfer(receiver);
    } else {
      // Transfer Assets to Receiver
      TransferHelper.safeTransfer(getToken0().tokenAddress, receiver, getBalanceToken0());
      TransferHelper.safeTransfer(getToken1().tokenAddress, receiver, getBalanceToken1());
    }

    // Clear Liquidity Position
    delete _liquidityPositionsByTokenId[packTokenId];
  }
}
