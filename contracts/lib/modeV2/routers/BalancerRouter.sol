// SPDX-License-Identifier: MIT

// BalancerRouter.sol
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
import {IAsset, IBalancerV2Vault} from "../../../interfaces/IBalancerV2Vault.sol";


abstract contract BalancerRouter is Web3PacksRouterBase {
  // Pass constructor data
  constructor(IWeb3PacksDefs.RouterConfig memory config) Web3PacksRouterBase(config) {}

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

  function createLiquidityPosition(
    uint256 balanceAmount0,
    uint256 balanceAmount1,
    uint256,
    uint256,
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

    (address poolAddress, ) = IBalancerV2Vault(_router).getPool(getPoolId());

    (IAsset[] memory assets, uint256[] memory amounts) = _getAssetsAndAmounts(
      token0.tokenAddress,
      token1.tokenAddress,
      poolAddress,
      balanceAmount0,
      balanceAmount1,
      stable
    );

    // Add Liquidity
    bytes memory userData = abi.encode(IBalancerV2Vault.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT, amounts, 0);
    IBalancerV2Vault.JoinPoolRequest memory joinData = IBalancerV2Vault.JoinPoolRequest({
      assets: assets,
      maxAmountsIn: amounts,
      userData: userData,
      fromInternalBalance: false
    });
    IBalancerV2Vault(_router).joinPool(getPoolId(), address(this), address(this), joinData);

    lpTokenId = uint256(uint160(poolAddress));
    liquidity = IERC20(poolAddress).balanceOf(address(this));
    amount0 = balanceAmount0 - IERC20(token0.tokenAddress).balanceOf(address(this));
    amount1 = balanceAmount1 - IERC20(token1.tokenAddress).balanceOf(address(this));
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

    (address poolAddress, ) = IBalancerV2Vault(_router).getPool(getPoolId());
    (IAsset[] memory assets, uint256[] memory amounts) = _getAssetsAndAmounts(
      token0.tokenAddress,
      token1.tokenAddress,
      poolAddress,
      0,
      0,
      liquidityPosition.stable
    );

    TransferHelper.safeApprove(
      poolAddress,
      _router,
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
    IBalancerV2Vault(_router).exitPool(getPoolId(), address(this), payable(address(this)), exitData);

    amount0 = IERC20(token0.tokenAddress).balanceOf(address(this));
    amount1 = IERC20(token1.tokenAddress).balanceOf(address(this));
  }


  function _performSwap(uint256 percentOfAmount, address token0, address token1)
    internal
    returns (uint256 amountOut)
  {
    uint256 balance = IERC20(token0).balanceOf(address(this));
    uint256 swapAmount = (balance * percentOfAmount) / 10000;

    TransferHelper.safeApprove(token0, _router, swapAmount);

    if (swapAmount > 0) {
      IBalancerV2Vault.SingleSwap memory swapData = IBalancerV2Vault.SingleSwap({
        poolId: getPoolId(),
        kind: IBalancerV2Vault.SwapKind.GIVEN_IN,
        assetIn: IAsset(token0),
        assetOut: IAsset(_weth),
        amount: swapAmount,
        userData: bytes("")
      });

      IBalancerV2Vault.FundManagement memory fundData = IBalancerV2Vault.FundManagement({
        sender: address(this),
        fromInternalBalance: false,
        recipient: payable(address(this)),
        toInternalBalance: false
      });
      IBalancerV2Vault(_router).swap(swapData, fundData, 0, block.timestamp);

      amountOut = IERC20(token1).balanceOf(address(this));
    }
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
