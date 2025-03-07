// SPDX-License-Identifier: MIT

// PancakeRouter.sol
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
import "../../../interfaces/IPancakeRouter02.sol";
import "../../../interfaces/IPancakeFactory.sol";


// UniswapV2-like Router
abstract contract PancakeRouter is Web3PacksRouterBase {
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
    IWeb3PacksDefs.Token memory token0 = reverse ? getToken1() : getToken0();
    IWeb3PacksDefs.Token memory token1 = reverse ? getToken0() : getToken1();
    amountOut = _performSwap(percentOfAmount, token0.tokenAddress, token1.tokenAddress);
  }

  // function swapForEth(uint256 percentOfAmount)
  //   public
  //   virtual
  //   override
  //   onlyManagerOrSelf
  //   returns (uint256 amountOut)
  // {
  //   IWeb3PacksDefs.Token memory token0 = getToken0();
  //   IWeb3PacksDefs.Token memory token1 = getToken1();
  //   amountOut = _performSwap(percentOfAmount, token1.tokenAddress, token0.tokenAddress);
  // }

  function createLiquidityPosition(
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256 minAmount0,
    uint256 minAmount1,
    bool
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
    (amount0, amount1, liquidity) = IPancakeRouter02(_router).addLiquidity(
      token0.tokenAddress,
      token1.tokenAddress,
      balanceAmount0,
      balanceAmount1,
      minAmount0,
      minAmount1,
      address(this),
      block.timestamp
    );

    // Deposit the LP tokens into the Web3Packs NFT
    address lpTokenAddress = _getPancakePairAddress(token0.tokenAddress, token1.tokenAddress);
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
    address lpTokenAddress = _getPancakePairAddress(token0.tokenAddress, token1.tokenAddress);

    TransferHelper.safeApprove(
      lpTokenAddress,
      _router,
      liquidityPosition.liquidity
    );

    (amount0, amount1) = IPancakeRouter02(_router).removeLiquidity(
      token0.tokenAddress,
      token1.tokenAddress,
      liquidityPosition.liquidity,
      0,
      0,
      address(this),
      block.timestamp
    );
  }


  function _performSwap(uint256 percentOfAmount, address token0, address token1)
    internal
    returns (uint256 amountOut)
  {
    address[] memory routes = new address[](1);
    routes[0] = token0;
    routes[1] = token1;

    uint256 balance = IERC20(token0).balanceOf(address(this));
    uint256 swapAmount = (balance * percentOfAmount) / 10000;

    if (swapAmount > 0) {
      TransferHelper.safeApprove(token0, _router, swapAmount);
      IPancakeRouter02(_router).swapExactTokensForTokens(
        swapAmount,
        0,
        routes,
        address(this),
        block.timestamp
      );
      amountOut = IERC20(token1).balanceOf(address(this));
    }
  }

  function _getPancakeFactory() private view returns (address) {
    return IPancakeRouter02(_router).factory();
  }

  function _getPancakePairAddress(address token0, address token1) private view returns (address) {
    IPancakeFactory _factory = IPancakeFactory(_getPancakeFactory());
    return _factory.getPair(token0, token1);
  }
}
