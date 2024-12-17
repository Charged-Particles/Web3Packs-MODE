// SPDX-License-Identifier: MIT

// UniswapV2.sol
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
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../interfaces/IWeb3Packs.sol";

contract UniswapV2 {
  address private _weth;

  constructor(address weth) {
    _weth = weth;
  }

  function uniswapV2SwapSingle(
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

  function uniswapV2SwapForEth(
    address token0,
    address token1,
    address router
  )
    internal
  {
    uint256 balance;
    address[] memory path;

    if (token0 != _weth) {
      balance = IERC20(token0).balanceOf(address(this));
      path[0] = token0;
      path[1] = _weth;
      if (balance > 0) {
        TransferHelper.safeApprove(token0, router, balance);
        IUniswapV2Router02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(
          balance,
          0,
          path,
          address(this),
          block.timestamp
        );
      }
    }
    if (token1 != _weth) {
      balance = IERC20(token1).balanceOf(address(this));
      path[0] = token1;
      path[1] = _weth;
      if (balance > 0) {
        TransferHelper.safeApprove(token1, router, balance);
        IUniswapV2Router02(router).swapExactTokensForETHSupportingFeeOnTransferTokens(
          balance,
          0,
          path,
          address(this),
          block.timestamp
        );
      }
    }
  }

  function uniswapV2CreatePosition(
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
    (amount0, amount1, liquidity) = IUniswapV2Router02(liquidityOrder.router).addLiquidity(
      liquidityOrder.token0,
      liquidityOrder.token1,
      balanceAmount0,
      balanceAmount1,
      minAmount0,
      minAmount1,
      address(this),
      block.timestamp
    );

    // Deposit the LP tokens into the Web3Packs NFT
    address lpTokenAddress = _getUniswapV2PairAddress(liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);
    lpTokenId = uint256(uint160(lpTokenAddress));
  }

  function uniswapV2RemoveLiquidity(
    IWeb3Packs.LiquidityPosition memory liquidityPosition,
    IWeb3Packs.LiquidityPairs memory liquidityPairs
  )
    internal
    returns (uint amount0, uint amount1)
  {
    address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

    TransferHelper.safeApprove(
      lpTokenAddress,
      liquidityPosition.router,
      liquidityPosition.liquidity
    );

    (amount0, amount1) = IUniswapV2Router02(liquidityPosition.router).removeLiquidity(
      liquidityPosition.token0,
      liquidityPosition.token1,
      liquidityPosition.liquidity,
      liquidityPairs.token0.amount,
      liquidityPairs.token1.amount,
      address(this),
      block.timestamp
    );
  }

  function uniswapV2GetLiquidityTokenAddress(
    IWeb3Packs.LiquidityPosition memory liquidityPosition
  )
    internal
    view
    returns (address lpTokenAddress, uint256 lpTokenId)
  {
    lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);
    lpTokenId = 0;
  }

  function _getUniswapV2Factory(address router) private pure returns (address) {
    IUniswapV2Router02 _router = IUniswapV2Router02(router);
    return _router.factory();
  }

  function _getUniswapV2PairAddress(address router, address token0, address token1) private view returns (address) {
    IUniswapV2Factory _factory = IUniswapV2Factory(_getUniswapV2Factory(router));
    return _factory.getPair(token0, token1);
  }
}
