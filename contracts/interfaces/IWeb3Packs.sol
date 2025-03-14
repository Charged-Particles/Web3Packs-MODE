// SPDX-License-Identifier: MIT

// IWeb3Packs.sol
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
pragma solidity 0.8.17;

import "./IWeb3PacksDefs.sol";

interface IWeb3Packs is IWeb3PacksDefs {
  function bundle(
    string calldata tokenMetaUri,
    ContractCallGeneric[] calldata contractCalls,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState,
    uint256 ethPackPrice,
    bytes32 usdPackPrice,
    bytes32 packType
  )
    external
    payable
    returns(uint256 tokenId);

  function unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] calldata liquidityPairs,
    bool sellAll
  ) external
    payable;

  function unbundleFromManager(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    string calldata walletManager,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] calldata liquidityPairs,
    bool sellAll
  )
    external
    payable;

  function energize(
    uint256 tokenId,
    address tokenAddress,
    uint256 tokenAmount
  )
    external;

  function bond(
    uint256 tokenId,
    address nftTokenAddress,
    uint256 mintedTokenId
  )
    external;
}
