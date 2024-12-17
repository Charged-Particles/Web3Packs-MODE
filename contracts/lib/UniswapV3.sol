// SPDX-License-Identifier: MIT

// UniswapV3.sol
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
import "../interfaces/IAlgebraRouter.sol";
import "../interfaces/INonfungiblePositionManager.sol";

contract UniswapV3 {
  address private _weth;

  constructor(address weth) {
    _weth = weth;
  }

  function uniswapV3SwapSingle(
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
    amountOut = abi.decode(data, (uint256));
  }

  function uniswapV3SwapForEth(
    address token0,
    address token1,
    address router
  )
    internal
  {
    uint256 balance;
    IAlgebraRouter.ExactInputSingleParams memory params;

    if (token0 != _weth) {
      balance = IERC20(token0).balanceOf(address(this));
      if (balance > 0) {
        TransferHelper.safeApprove(token0, router, balance);
        params = IAlgebraRouter.ExactInputSingleParams(token0, _weth, address(this), block.timestamp, balance, 0, 0);
        IAlgebraRouter(router).exactInputSingle(params);
      }
    }

    if (token1 != _weth) {
      balance = IERC20(token1).balanceOf(address(this));
      if (balance > 0) {
        TransferHelper.safeApprove(token1, router, balance);
        params = IAlgebraRouter.ExactInputSingleParams(token1, _weth, address(this), block.timestamp, balance, 0, 0);
        IAlgebraRouter(router).exactInputSingle(params);
      }
    }
  }

  function uniswapV3CreatePosition(
    IWeb3Packs.LiquidityOrderGeneric memory liquidityOrder,
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256 minAmount0,
    uint256 minAmount1
  ) internal returns (
    uint256 lpTokenId,
    uint256 liquidity,
    uint256 amount0,
    uint256 amount1
  ) {
    // Add Liquidity
    INonfungiblePositionManager.MintParams memory params =
      INonfungiblePositionManager.MintParams({
        token0: liquidityOrder.token0,
        token1: liquidityOrder.token1,
        tickLower: liquidityOrder.tickLower,
        tickUpper: liquidityOrder.tickUpper,
        amount0Desired: balanceAmount0,
        amount1Desired: balanceAmount1,
        amount0Min: minAmount0,
        amount1Min: minAmount1,
        recipient: address(this),
        deadline: block.timestamp
      });
    (lpTokenId, liquidity, amount0, amount1) = INonfungiblePositionManager(liquidityOrder.router).mint(params);
  }


  function uniswapV3CollectLpFees(
    IWeb3Packs.LiquidityPosition memory liquidityPosition
  )
    internal
    returns (uint256 amount0, uint256 amount1)
  {
    INonfungiblePositionManager.CollectParams memory params =
      INonfungiblePositionManager.CollectParams({
        tokenId: liquidityPosition.lpTokenId,
        recipient: address(this),
        amount0Max: type(uint128).max,
        amount1Max: type(uint128).max
      });

    (amount0, amount1) = INonfungiblePositionManager(liquidityPosition.router).collect(params);
  }

  function uniswapV3RemoveLiquidity(
    IWeb3Packs.LiquidityPosition memory liquidityPosition,
    IWeb3Packs.LiquidityPairs memory liquidityPairs
  )
    internal
    returns (uint amount0, uint amount1)
  {
    // Release Liquidity
    INonfungiblePositionManager.DecreaseLiquidityParams memory params =
      INonfungiblePositionManager.DecreaseLiquidityParams({
        tokenId: liquidityPosition.lpTokenId,
        liquidity: uint128(liquidityPosition.liquidity),
        amount0Min: liquidityPairs.token0.amount,
        amount1Min: liquidityPairs.token1.amount,
        deadline: block.timestamp
      });
    (amount0, amount1) = INonfungiblePositionManager(liquidityPosition.router).decreaseLiquidity(params);
  }

  function uniswapV3GetLiquidityTokenAddress(
    IWeb3Packs.LiquidityPosition memory liquidityPosition
  )
    internal
    pure
    returns (address lpTokenAddress, uint256 lpTokenId)
  {
    lpTokenAddress = liquidityPosition.router;
    lpTokenId = liquidityPosition.lpTokenId;
  }
}
