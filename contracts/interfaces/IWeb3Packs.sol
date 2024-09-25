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

interface IWeb3Packs {
  event ChargedParticlesSet(address indexed chargedParticles);
  event ChargedStateSet(address indexed chargedState);
  event RouterSet(address indexed router);
  event ProtonSet(address indexed proton);
  event PackBundled(uint256 indexed tokenId, address indexed receiver);
  event PackUnbundled(uint256 indexed tokenId, address indexed receiver);
  event ProtocolFeeSet(uint256 fee);

  // Custom Errors
  error NotOwnerOrApproved();
  error FundingFailed();
  error NullReceiver();
  error ContractNotAllowed();
  error NativeAssetTransferFailed();
  error MismatchedTokens();
  error UnsucessfulSwap(address tokenOut, uint256 amountIn, address router);
  error InsufficientForFee();

  enum RouterType {
    UniswapV2,
    UniswapV3,
    Velodrome
  }

  /// @notice Represents the deposit of an NFT
  struct TokenAmount {
    address token;
    uint256 amount;
  }

  struct ContractCallGeneric {
    bytes callData;
    address contractAddress;
    uint256 amountIn;
  }

  struct ERC20SwapOrderGeneric {
    bytes callData;
    address router;
    address tokenIn;
    address tokenOut;
    uint256 tokenAmountIn;
    uint256 payableAmountIn;
    bytes32 liquidityUuid;
    RouterType routerType;
  }

  struct LiquidityOrderGeneric {
    address router;
    address token0;
    address token1;
    uint256 amount0ToMint;
    uint256 amount1ToMint;
    uint256 amount0Min;
    uint256 amount1Min;
    bytes32 liquidityUuidToken0;
    bytes32 liquidityUuidToken1;
    int24 tickLower;
    int24 tickUpper;
    bool stable;
    RouterType routerType;
  }

  struct Web3PackOrder {
    address[] erc20TokenAddresses;
    NFT[] nfts;
  }

  struct LiquidityPosition {
    uint256 lpTokenId;
    uint256 liquidity;
    bool stable;
    address token0;
    address token1;
    address router;
    RouterType routerType;
  }

  struct NFT {
    address tokenAddress;
    uint256 id;
  }

  struct LockState {
    uint256 ERC20Timelock;
    uint256 ERC721Timelock;
  }

  function bundle(
    address payable receiver,
    string calldata tokenMetaUri,
    ContractCallGeneric[] calldata contractCalls,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState,
    uint256 ethPackPrice
  )
    external
    payable
    returns(uint256 tokenId);

  function unbundle(
    address receiver,
    address contractAddress,
    uint256 tokenId,
    Web3PackOrder calldata web3PackOrder
  ) external;
}
