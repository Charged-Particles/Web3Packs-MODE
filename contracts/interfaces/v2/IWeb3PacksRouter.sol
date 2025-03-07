// SPDX-License-Identifier: MIT

// IWeb3PacksRouter.sol
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

import "./IWeb3PacksDefs.sol";

interface IWeb3PacksRouter is IWeb3PacksDefs {
  function getToken0() external returns (IWeb3PacksDefs.Token calldata token0);
  function getToken1() external returns (IWeb3PacksDefs.Token calldata token1);
  // function getMiddleTokens() external returns (address[] memory middleTokens);

  function getBalanceToken0() external returns (uint256 balanceToken0);
  function getBalanceToken1() external returns (uint256 balanceToken1);

  function enterWeth(uint256 amount) external;
  function exitWethAndTransfer(address payable receiver) external returns (uint256 ethAmount);
  function refundUnusedTokens(address sender) external;

  function swapSingle(uint256 percentOfAmount, bool reverse)
    external
    returns (uint256 amountOut);

  function createLiquidityPosition(
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256 minAmount0,
    uint256 minAmount1,
    bool stable
  )
    external
    returns (
      uint256 lpTokenId,
      uint256 liquidity,
      uint256 amount0,
      uint256 amount1
    );

  function collectLpFees(IWeb3PacksDefs.LiquidityPosition calldata liquidityPosition)
    external
    returns (uint256 amount0, uint256 amount1);

  function removeLiquidityPosition(IWeb3PacksDefs.LiquidityPosition calldata liquidityPosition)
    external
    returns (uint amount0, uint amount1);
}
