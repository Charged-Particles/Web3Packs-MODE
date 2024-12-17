// SPDX-License-Identifier: MIT

// Web3PacksExchangeManager.sol
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

import "./IWeb3PacksDefs.sol";

interface IWeb3PacksExchangeManager is IWeb3PacksDefs {
  function performContractCalls(
    ContractCallGeneric[] calldata contractCalls
  ) external;

  function performSwaps(
    ERC20SwapOrderGeneric[] calldata orders,
    uint256 web3packsTokenId
  ) external;

  function depositLiquidity(
    LiquidityOrderGeneric[] calldata orders,
    uint256 web3packsTokenId
  ) external;

  function removeLiquidity(
    LiquidityPosition calldata liquidityPosition,
    LiquidityPairs calldata liquidityPair,
    address receiver,
    bool sellAll
  ) external;

  function swapAllForEth(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] memory liquidityPairs,
    address receiver
  ) external returns (uint ethAmount);

  function getLiquidityTokenData(
    LiquidityPosition calldata liquidityPosition
  ) external returns (address lpTokenAddress, uint256 lpTokenId);
}
