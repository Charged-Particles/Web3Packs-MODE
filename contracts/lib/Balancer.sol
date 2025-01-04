// SPDX-License-Identifier: MIT

// Balancer.sol
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
import {IAsset, IBalancerV2Vault} from "../interfaces/IBalancerV2Vault.sol";
import "../interfaces/IWeb3Packs.sol";

contract Balancer {
  address private _weth;

  constructor(address weth) {
    _weth = weth;
  }

  function balancerSwapSingle(
    IWeb3Packs.ERC20SwapOrderGeneric memory swapOrder
  )
    internal
    returns (uint256 amountOut)
  {
    IBalancerV2Vault.SingleSwap memory swapData = IBalancerV2Vault.SingleSwap({
      poolId: swapOrder.poolId,
      kind: IBalancerV2Vault.SwapKind.GIVEN_IN,
      assetIn: IAsset(swapOrder.tokenIn),
      assetOut: IAsset(swapOrder.tokenOut),
      amount: swapOrder.tokenAmountIn,
      userData: bytes("")
    });

    IBalancerV2Vault.FundManagement memory fundData = IBalancerV2Vault.FundManagement({
      sender: address(this),
      fromInternalBalance: false,
      recipient: payable(address(this)),
      toInternalBalance: false
    });
    amountOut = IBalancerV2Vault(swapOrder.router).swap(swapData, fundData, swapOrder.tokenAmountOutMin, block.timestamp);
  }

  function balancerSwapForEth(
    address token0,
    address token1,
    address router,
    bytes32 poolId
  )
    internal
  {
    uint256 balance;

    if (token0 != _weth) {
      balance = IERC20(token0).balanceOf(address(this));
      TransferHelper.safeApprove(token0, router, balance);

      if (balance > 0) {
        IBalancerV2Vault.SingleSwap memory swapData = IBalancerV2Vault.SingleSwap({
          poolId: poolId,
          kind: IBalancerV2Vault.SwapKind.GIVEN_IN,
          assetIn: IAsset(token0),
          assetOut: IAsset(_weth),
          amount: balance,
          userData: bytes("")
        });

        IBalancerV2Vault.FundManagement memory fundData = IBalancerV2Vault.FundManagement({
          sender: address(this),
          fromInternalBalance: false,
          recipient: payable(address(this)),
          toInternalBalance: false
        });
        IBalancerV2Vault(router).swap(swapData, fundData, 0, block.timestamp);
      }
    }
    if (token1 != _weth) {
      balance = IERC20(token1).balanceOf(address(this));
      TransferHelper.safeApprove(token1, router, balance);

      if (balance > 0) {
        IBalancerV2Vault.SingleSwap memory swapData = IBalancerV2Vault.SingleSwap({
          poolId: poolId,
          kind: IBalancerV2Vault.SwapKind.GIVEN_IN,
          assetIn: IAsset(token1),
          assetOut: IAsset(_weth),
          amount: balance,
          userData: bytes("")
        });

        IBalancerV2Vault.FundManagement memory fundData = IBalancerV2Vault.FundManagement({
          sender: address(this),
          fromInternalBalance: false,
          recipient: payable(address(this)),
          toInternalBalance: false
        });
        IBalancerV2Vault(router).swap(swapData, fundData, 0, block.timestamp);
      }
    }
  }

  function balancerCreatePosition(
    IWeb3Packs.LiquidityOrderGeneric memory liquidityOrder,
    uint256 balanceAmount0,
    uint256 balanceAmount1
  ) internal returns (
    uint256 lpTokenId,
    uint256 liquidity,
    uint256 amount0,
    uint256 amount1
  ) {
    (address poolAddress, ) = IBalancerV2Vault(liquidityOrder.router).getPool(liquidityOrder.poolId);

    (IAsset[] memory assets, uint256[] memory amounts) = _getAssetsAndAmounts(
      liquidityOrder.token0,
      liquidityOrder.token1,
      poolAddress,
      balanceAmount0,
      balanceAmount1,
      liquidityOrder.stable
    );

    // Add Liquidity
    bytes memory userData = abi.encode(IBalancerV2Vault.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT, amounts, liquidityOrder.minimumLpTokens);
    IBalancerV2Vault.JoinPoolRequest memory joinData = IBalancerV2Vault.JoinPoolRequest({
      assets: assets,
      maxAmountsIn: amounts,
      userData: userData,
      fromInternalBalance: false
    });
    IBalancerV2Vault(liquidityOrder.router).joinPool(liquidityOrder.poolId, address(this), address(this), joinData);

    lpTokenId = uint256(uint160(poolAddress));
    liquidity = IERC20(poolAddress).balanceOf(address(this));
    amount0 = balanceAmount0 - IERC20(liquidityOrder.token0).balanceOf(address(this));
    amount1 = balanceAmount1 - IERC20(liquidityOrder.token1).balanceOf(address(this));
  }

  function balancerRemoveLiquidity(
    IWeb3Packs.LiquidityPosition memory liquidityPosition,
    IWeb3Packs.LiquidityPairs memory liquidityPairs
  )
    internal
    returns (uint amount0, uint amount1)
  {
    (address poolAddress, ) = IBalancerV2Vault(liquidityPosition.router).getPool(liquidityPosition.poolId);
    (IAsset[] memory assets, uint256[] memory amounts) = _getAssetsAndAmounts(
      liquidityPosition.token0,
      liquidityPosition.token1,
      poolAddress,
      liquidityPairs.token0.amount,
      liquidityPairs.token1.amount,
      liquidityPosition.stable
    );

    TransferHelper.safeApprove(
      poolAddress,
      liquidityPosition.router,
      liquidityPosition.liquidity
    );

    // Remove Liquidity
    bytes memory userData = abi.encode(IBalancerV2Vault.ExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT, liquidityPosition.liquidity);
    IBalancerV2Vault.ExitPoolRequest memory exitData = IBalancerV2Vault.ExitPoolRequest({
      assets: assets,
      minAmountsOut: amounts,
      userData: userData,
      toInternalBalance: false
    });
    IBalancerV2Vault(liquidityPosition.router).exitPool(liquidityPosition.poolId, address(this), payable(address(this)), exitData);

    amount0 = IERC20(liquidityPosition.token0).balanceOf(address(this));
    amount1 = IERC20(liquidityPosition.token1).balanceOf(address(this));
  }

  function balancerGetLiquidityTokenAddress(
    IWeb3Packs.LiquidityPosition memory liquidityPosition
  )
    internal
    view
    returns (address lpTokenAddress, uint256 lpTokenId)
  {
    (address poolAddress, ) = IBalancerV2Vault(liquidityPosition.router).getPool(liquidityPosition.poolId);
    lpTokenAddress = poolAddress;
    lpTokenId = 0;
  }

  function _getAssetsAndAmounts(
    address token0,
    address token1,
    address poolAddress,
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    bool isStable
  )
    internal
    pure
    returns (
      IAsset[] memory assets,
      uint256[] memory amounts
    )
  {
    // Balancer LPs must be entered into with Tokens ordered from Smallest to Largest.
    // Stable LPs also require the Pool Address, which also must be sorted.
    if (isStable) {
      assets = new IAsset[](3);
      amounts = new uint256[](3);

      if (uint160(token0) <= uint160(token1) && uint160(token0) <= uint160(poolAddress)) {
        assets[0] = IAsset(token0);
        amounts[0] = balanceAmount0;
        if (uint160(token1) <= uint160(poolAddress)) {
          assets[1] = IAsset(token1);
          assets[2] = IAsset(poolAddress);
          amounts[1] = balanceAmount1;
          amounts[2] = 0;
        } else {
          assets[1] = IAsset(poolAddress);
          assets[2] = IAsset(token1);
          amounts[1] = 0;
          amounts[2] = balanceAmount1;
        }
      } else if (uint160(token1) <= uint160(token0) && uint160(token1) <= uint160(poolAddress)) {
        assets[0] = IAsset(token1);
        amounts[0] = balanceAmount1;
        if (uint160(token0) <= uint160(poolAddress)) {
          assets[1] = IAsset(token0);
          assets[2] = IAsset(poolAddress);
          amounts[1] = balanceAmount0;
          amounts[2] = 0;
        } else {
          assets[1] = IAsset(poolAddress);
          assets[2] = IAsset(token0);
          amounts[1] = 0;
          amounts[2] = balanceAmount0;
        }
      } else {
        assets[0] = IAsset(poolAddress);
        amounts[0] = 0;
        if (uint160(token0) <= uint160(token1)) {
          assets[1] = IAsset(token0);
          assets[2] = IAsset(token1);
          amounts[1] = balanceAmount0;
          amounts[2] = balanceAmount1;
        } else {
          assets[1] = IAsset(token1);
          assets[2] = IAsset(token0);
          amounts[1] = balanceAmount1;
          amounts[2] = balanceAmount0;
        }
      }
    } else {
      assets = new IAsset[](2);
      amounts = new uint256[](2);

      if (uint160(token0) < uint160(token1)) {
        assets[0] = IAsset(token0);
        assets[1] = IAsset(token1);

        amounts[0] = balanceAmount0;
        amounts[1] = balanceAmount1;
      } else {
        assets[0] = IAsset(token1);
        assets[1] = IAsset(token0);

        amounts[0] = balanceAmount1;
        amounts[1] = balanceAmount0;
      }
    }
  }
}
