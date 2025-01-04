// SPDX-License-Identifier: MIT

// IWeb3PacksDefs.sol
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

interface IWeb3PacksDefs {
  event ChargedParticlesSet(address indexed chargedParticles);
  event ChargedStateSet(address indexed chargedState);
  event RouterSet(address indexed router);
  event ProtonSet(address indexed proton);
  event PackBundled(uint256 indexed tokenId, address indexed receiver, bytes32 packType, bytes32 usdPackPrice);
  event PackUnbundled(uint256 indexed tokenId, address indexed receiver, uint256 ethAmount);
  event ProtocolFeeSet(uint256 fee);
  event Web3PacksSet(address indexed web3packs);
  event Web3PacksManagerSet(address indexed manager);
  event Web3PacksExchangeManagerSet(address indexed manager);
  event Web3PacksTreasurySet(address indexed treasury);

  // Custom Errors
  error NotOwnerOrApproved();
  error FundingFailed();
  error NullReceiver();
  error ContractNotAllowed();
  error NativeAssetTransferFailed();
  error MismatchedTokens();
  error MissingLiquidityUUID(address tokenAddress);
  error UnsucessfulSwap(address tokenOut, uint256 amountIn, address router);
  error InsufficientForFee(uint256 value, uint256 ethPackPrice, uint256 protocolFee);

  enum RouterType {
    UniswapV2,
    UniswapV3,
    Velodrome,
    Balancer,
    SwapMode
  }

  struct TokenAmount {
    address token;
    uint256 amount;
  }

  struct Route {
    address token0;
    address token1;
  }

  struct LiquidityPairs {
    TokenAmount token0;
    TokenAmount token1;
    uint256 slippage;
    bytes32 poolId;
    address router;
    RouterType routerType;
    bool exitLpOnUnbundle;
    Route[] reverseRoute;
    bool stable;
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
    uint256 tokenAmountOutMin;
    uint256 payableAmountIn;
    bytes32 liquidityUuid;
    bytes32 poolId;
    bool stable;
    Route[] reverseRoute;
    RouterType routerType;
  }

  struct LiquidityOrderGeneric {
    address router;
    address token0;
    address token1;
    bytes32 liquidityUuidToken0;
    bytes32 liquidityUuidToken1;
    uint256 percentToken0;
    uint256 percentToken1;
    uint256 minimumLpTokens;
    uint256 slippage;
    int24 tickLower;
    int24 tickUpper;
    bool stable;
    bytes32 poolId;
    RouterType routerType;
  }

  struct LiquidityPosition {
    uint256 lpTokenId;
    uint256 liquidity;
    bool stable;
    address token0;
    address token1;
    int24 tickLower;
    int24 tickUpper;
    bytes32 poolId;
    address router;
    RouterType routerType;
  }

  struct LiquidityPositionResult {
    address token0;
    address token1;
    uint256 amount0;
    uint256 amount1;
  }

  struct NFT {
    address tokenAddress;
    uint256 id;
  }

  struct LockState {
    uint256 ERC20Timelock;
    uint256 ERC721Timelock;
  }
}
