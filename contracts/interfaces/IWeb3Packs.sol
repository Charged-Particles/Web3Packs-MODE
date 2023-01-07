// SPDX-License-Identifier: MIT

// IChargedSettings.sol -- Part of the Charged Particles Protocol
// Copyright (c) 2022 Firma Lux, Inc. <https://charged.fi>
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

interface IWeb3Packs {
  event ChargedParticlesSet(address indexed chargedParticles);
  event ChargedStateSet(address indexed chargedState);
  event UniswapRouterSet(address indexed router);
  event ProtonSet(address indexed proton);
  event PackBundled(uint256 indexed tokenId, address indexed receiver);
  event PackUnbundled(uint256 indexed tokenId, address indexed receiver);

  struct ERC20SwapOrder {
    address inputTokenAddress;
    address outputTokenAddress;
    uint256 inputTokenAmount;
  }

  struct Web3PackOrder {
    address[] erc20TokenAddresses;
    address[] erc721TokenAddresses;
    uint256[] erc721TokenIds;
  }

  function bundle(
    address receiver,
    ERC20SwapOrder[] calldata erc20SwapOrders
  ) external returns(uint256 tokenId);

  function unbundle(
    address receiver,
    uint256 tokenId,
    Web3PackOrder calldata web3PackOrder
  ) external;
}
