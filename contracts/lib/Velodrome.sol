// SPDX-License-Identifier: MIT

// Velodrome.sol
// Copyright (c) 2023 Firma Lux, Inc. <https://charged.fi>
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

//                _    ____                   _
//               | |  |___ \                 | |
//  __      _____| |__  __) |_ __   __ _  ___| | _____
//  \ \ /\ / / _ \ '_ \|__ <| '_ \ / _` |/ __| |/ / __|
//   \ V  V /  __/ |_) |__) | |_) | (_| | (__|   <\__ \
//    \_/\_/ \___|_.__/____/| .__/ \__,_|\___|_|\_\___/
//                          | |
//                          |_|

pragma solidity 0.8.17;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../interfaces/IWeb3Packs.sol";
import "../interfaces/IVelodrome.sol";

contract Velodrome {
  address public weth;

  constructor(address _weth) {
    weth = _weth;
  }

  function velodromeSwapSingle(
    IWeb3Packs.ERC20SwapOrderGeneric memory swapOrder
  )
    internal
    returns (uint256 amountOut)
  {
    (bool success, bytes memory data ) = swapOrder.router.call{value: swapOrder.payableAmountIn}(
      swapOrder.callData
    );
    if (!success) {
      assembly {
        let dataSize := mload(data) // Load the size of the data
        let dataPtr := add(data, 0x20) // Advance data pointer to the next word
        revert(dataPtr, dataSize) // Revert with the given data
      }
    }

    uint[] memory amounts = abi.decode(data, (uint[]));
    amountOut = amounts[amounts.length-1];
  }

  function velodromeSwapForEth(
    address token0,
    address token1,
    address router
  )
    internal
  {
    uint256 balance;
    IVelodrome.Route[] memory routes = new IVelodrome.Route[](1);

    if (token0 != weth) {
      balance = IERC20(token0).balanceOf(address(this));
      routes[0] = IVelodrome.Route(token0, weth, false);
      if (balance > 0) {
        TransferHelper.safeApprove(token0, router, balance);
        IVelodrome(router).swapExactTokensForTokens(
          balance,
          0,
          routes,
          address(this),
          block.timestamp
        );
      }
    }
    if (token1 != weth) {
      balance = IERC20(token1).balanceOf(address(this));
      routes[0] = IVelodrome.Route(token1, weth, false);
      if (balance > 0) {
        TransferHelper.safeApprove(token1, router, balance);
        IVelodrome(router).swapExactTokensForTokens(
          balance,
          0,
          routes,
          address(this),
          block.timestamp
        );
      }
    }
  }

  function velodromeCreatePosition(
    IWeb3Packs.LiquidityOrderGeneric memory liquidityOrder,
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256 minAmount0,
    uint256 minAmount1
  )
    internal
    returns (
      uint256 lpTokenId,
      uint256 liquidity,
      uint256 amount0,
      uint256 amount1
    )
  {
    // Add Liquidity
    (amount0, amount1, liquidity) = IVelodrome(liquidityOrder.router).addLiquidity(
      liquidityOrder.token0,
      liquidityOrder.token1,
      liquidityOrder.stable,
      balanceAmount0,
      balanceAmount1,
      minAmount0,
      minAmount1,
      address(this),
      block.timestamp
    );

    // Deposit the LP tokens into the Web3Packs NFT
    address lpTokenAddress = _getVelodromePairAddress(liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);
    lpTokenId = uint256(uint160(lpTokenAddress));
  }

  function velodromeRemoveLiquidity(
    IWeb3Packs.LiquidityPosition memory liquidityPosition,
    IWeb3Packs.LiquidityPairs memory liquidityPairs
  )
    internal
    returns (uint amount0, uint amount1)
  {
    address lpTokenAddress = _getVelodromePairAddress(liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

    TransferHelper.safeApprove(
      lpTokenAddress,
      liquidityPosition.router,
      liquidityPosition.liquidity
    );

    (amount0, amount1) = IVelodrome(liquidityPosition.router).removeLiquidity(
      liquidityPosition.token0,
      liquidityPosition.token1,
      liquidityPosition.stable,
      liquidityPosition.liquidity,
      liquidityPairs.token0.amount,
      liquidityPairs.token1.amount,
      address(this),
      block.timestamp
    );
  }

  function velodromeGetLiquidityTokenAddress(
    IWeb3Packs.LiquidityPosition memory liquidityPosition
  )
    internal
    view
    returns (address lpTokenAddress, uint256 lpTokenId)
  {
    lpTokenAddress = _getVelodromePairAddress(liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);
    lpTokenId = 0;
  }

  function _getVelodromePairAddress(address router, address token0, address token1) private view returns (address) {
    return IVelodrome(router).poolFor(token0, token1, false);
  }
}
