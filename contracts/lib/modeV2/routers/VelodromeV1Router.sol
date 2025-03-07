// SPDX-License-Identifier: MIT

// VelodromeV1Router.sol
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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../Web3PacksRouterBase.sol";
import "../../../interfaces/v2/IWeb3PacksDefs.sol";
import "../../../interfaces/IVelodrome.sol";


// UniswapV2-like Router
abstract contract VelodromeV1Router is Web3PacksRouterBase {
  // Pass constructor data
  constructor(address weth, address router, address manager, string memory bundlerId, int24 tickLower, int24 tickUpper)
    Web3PacksRouterBase(weth, router, manager, bundlerId, tickLower, tickUpper) {}

  function swapSingle(uint256 percentOfAmount, bool reverse)
    public
    virtual
    override
    onlyManagerOrSelf
    returns (uint256 amountOut)
  {
    IWeb3PacksDefs.Token memory token0 = getToken0();
    IWeb3PacksDefs.Token memory token1 = getToken1();
    IWeb3PacksDefs.Route[] memory tokens = getTokenPath(reverse);
    IVelodrome.Route[] memory routes = new IVelodrome.Route[](tokens.length);
    for (uint i; i < tokens.length; i++) {
      routes[i] = IVelodrome.Route({from: tokens[i].token0, to: tokens[i].token1, stable: tokens[i].stable});
    }
    amountOut = _performSwap(percentOfAmount, token0.tokenAddress, token1.tokenAddress, routes);
  }

  // function swapForEth(uint256 percentOfAmount)
  //   public
  //   virtual
  //   override
  //   onlyManagerOrSelf
  //   returns (uint256 amountOut)
  // {
  //   IWeb3PacksDefs.Route[] memory tokens = getTokenPath(true);
  //   IVelodrome.Route[] memory routes = new IVelodrome.Route[](tokens.length);
  //   for (uint i; i < tokens.length; i++) {
  //     routes[i] = IVelodrome.Route({from: tokens[i].token0, to: tokens[i].token1, stable: tokens[i].stable});
  //   }
  //   amountOut = _performSwap(percentOfAmount, tokens[0].token0, routes);
  // }

  function createLiquidityPosition(
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256 minAmount0,
    uint256 minAmount1,
    bool stable
  )
    public
    virtual
    override
    onlyManagerOrSelf
    returns (
      uint256 lpTokenId,
      uint256 liquidity,
      uint256 amount0,
      uint256 amount1
    )
  {
    IWeb3PacksDefs.Token memory token0 = getToken0();
    IWeb3PacksDefs.Token memory token1 = getToken1();

    // Add Liquidity
    (amount0, amount1, liquidity) = IVelodrome(_router).addLiquidity(
      token0.tokenAddress,
      token1.tokenAddress,
      stable,
      balanceAmount0,
      balanceAmount1,
      minAmount0,
      minAmount1,
      address(this),
      block.timestamp
    );

    // Deposit the LP tokens into the Web3Packs NFT
    address lpTokenAddress = _getVelodromePairAddress(token0.tokenAddress, token1.tokenAddress);
    lpTokenId = uint256(uint160(lpTokenAddress));
  }

  function collectLpFees(IWeb3PacksDefs.LiquidityPosition memory)
    public
    virtual
    override
    onlyManagerOrSelf
    returns (uint256 amount0, uint256 amount1)
  {
    amount0 = 0;
    amount1 = 0;
  }

  function removeLiquidityPosition(IWeb3PacksDefs.LiquidityPosition memory liquidityPosition)
    public
    virtual
    override
    onlyManagerOrSelf
    returns (uint amount0, uint amount1)
  {
    IWeb3PacksDefs.Token memory token0 = getToken0();
    IWeb3PacksDefs.Token memory token1 = getToken1();
    address lpTokenAddress = _getVelodromePairAddress(token0.tokenAddress, token1.tokenAddress);

    TransferHelper.safeApprove(
      lpTokenAddress,
      _router,
      liquidityPosition.liquidity
    );

    (amount0, amount1) = IVelodrome(_router).removeLiquidity(
      token0.tokenAddress,
      token1.tokenAddress,
      liquidityPosition.stable,
      liquidityPosition.liquidity,
      0,
      0,
      address(this),
      block.timestamp
    );
  }


  function _performSwap(uint256 percentOfAmount, address token0, address token1, IVelodrome.Route[] memory routes)
    internal
    returns (uint256 amountOut)
  {
    uint256 balance = IERC20(token0).balanceOf(address(this));
    uint256 swapAmount = (balance * percentOfAmount) / 10000;

    if (swapAmount > 0) {
      TransferHelper.safeApprove(token0, _router, swapAmount);
      IVelodrome(_router).swapExactTokensForTokens(
        swapAmount,
        0,
        routes,
        address(this),
        block.timestamp
      );
      amountOut = IERC20(token1).balanceOf(address(this));
    }
  }

  function _getVelodromePairAddress(address token0, address token1) private view returns (address) {
    return IVelodrome(_router).poolFor(token0, token1, false);
  }
}
