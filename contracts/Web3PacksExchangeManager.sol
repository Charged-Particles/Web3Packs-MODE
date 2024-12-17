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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/BlackholePrevention.sol";
import "./lib/Balancer.sol";
import "./lib/UniswapV2.sol";
import "./lib/UniswapV3.sol";
import "./lib/Velodrome.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IWeb3PacksManager.sol";
import "./interfaces/IWeb3PacksExchangeManager.sol";

contract Web3PacksExchangeManager is
  IWeb3PacksExchangeManager,
  Ownable,
  Pausable,
  BlackholePrevention,
  ReentrancyGuard,
  Balancer,
  UniswapV2,
  UniswapV3,
  Velodrome
{
  address public _weth;
  address public _web3Packs;
  address public _web3PacksManager;
  uint256 internal _receivedAmount;

  mapping (bytes32 => TokenAmount) internal _swapForLiquidityAmount;

  // TODO: Refactor router handling for better scalability and maintainability
  // Consider using an array of routers in the constructor and removing the RouterType enum
  constructor(address weth)
    Balancer(weth)
    UniswapV2(weth)
    UniswapV3(weth)
    Velodrome(weth)
  {
    _weth = weth;
  }

  receive() external payable {
    _receivedAmount = msg.value;
  }

  fallback() external payable {
    _receivedAmount = msg.value;
  }

  /***********************************|
  |          Public Functions         |
  |__________________________________*/

  function performContractCalls(
    ContractCallGeneric[] calldata contractCalls
  )
    external
    override
    onlyWeb3Packs
  {
    for (uint256 i; i < contractCalls.length; i++) {
      _contractCall(contractCalls[i]);
    }
  }

  function performSwaps(
    ERC20SwapOrderGeneric[] calldata orders,
    uint256 web3packsTokenId
  )
    external
    override
    onlyWeb3Packs
  {
    for (uint256 i; i < orders.length; i++) {
      _swapSingleOrder(orders[i], web3packsTokenId);
    }
  }

  function depositLiquidity(
    LiquidityOrderGeneric[] calldata orders,
    uint256 web3PacksTokenId
  )
    external
    override
    onlyWeb3Packs
  {
    uint256 wethSplit;
    for (uint256 i; i < orders.length; i++) {
      if (orders[i].liquidityUuidToken0 == bytes32("WETH") || orders[i].liquidityUuidToken1 == bytes32("WETH")) {
        wethSplit++;
      }
    }

    uint256 wethBalance = IERC20(_weth).balanceOf(address(this));
    uint256 wethPerLp = wethSplit > 1 ? wethBalance / wethSplit : 0;

    for (uint256 i; i < orders.length; i++) {
      _createLiquidityPosition(orders[i], web3PacksTokenId, wethPerLp);
    }
  }

  function removeLiquidity(
    LiquidityPosition calldata liquidityPosition,
    LiquidityPairs calldata liquidityPair,
    address receiver,
    bool sellAll
  )
    external
    override
    onlyWeb3Packs
  {
    (uint256 amount0, uint256 amount1) = _removeLiquidity(liquidityPosition, liquidityPair);

    if (!sellAll) {
      TransferHelper.safeTransfer(liquidityPosition.token0, receiver, amount0);
      TransferHelper.safeTransfer(liquidityPosition.token1, receiver, amount1);
    }
  }

  function swapAllForEth(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] memory liquidityPairs,
    address receiver
  )
    external
    onlyWeb3Packs
    returns (uint ethAmount)
  {
    // Swaps
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      ERC20SwapOrderGeneric memory swap = erc20SwapOrders[i];
      _requireAllowlisted(swap.router);

      if (swap.routerType == RouterType.Balancer) {
        balancerSwapForEth(swap.tokenIn, swap.tokenOut, swap.router, swap.poolId);
      }
      if (swap.routerType == RouterType.Velodrome) {
        velodromeSwapForEth(swap.tokenIn, swap.tokenOut, swap.router);
      }
      if (swap.routerType == RouterType.UniswapV2) {
        uniswapV2SwapForEth(swap.tokenIn, swap.tokenOut, swap.router);
      }
      if (swap.routerType == RouterType.UniswapV3) {
        uniswapV3SwapForEth(swap.tokenIn, swap.tokenOut, swap.router);
      }
    }

    // LPs
    for (uint256 i; i < liquidityPairs.length; i++) {
      LiquidityPairs memory lp = liquidityPairs[i];
      _requireAllowlisted(lp.router);

      if (lp.routerType == RouterType.Balancer) {
        balancerSwapForEth(lp.token0.token, lp.token1.token, lp.router, lp.poolId);
      }
      if (lp.routerType == RouterType.Velodrome) {
        velodromeSwapForEth(lp.token0.token, lp.token1.token, lp.router);
      }
      if (lp.routerType == RouterType.UniswapV2) {
        uniswapV2SwapForEth(lp.token0.token, lp.token1.token, lp.router);
      }
      if (lp.routerType == RouterType.UniswapV3) {
        uniswapV3SwapForEth(lp.token0.token, lp.token1.token, lp.router);
      }
    }

    // Transfer wETH to Receiver
    ethAmount = IERC20(_weth).balanceOf(address(this));
    TransferHelper.safeTransfer(_weth, receiver, ethAmount);
  }

  function getLiquidityTokenData(LiquidityPosition calldata liquidityPosition)
    external
    view
    override
    returns (address lpTokenAddress, uint256 lpTokenId)
  {
    if (liquidityPosition.routerType == RouterType.Balancer) {
      return balancerGetLiquidityTokenAddress(liquidityPosition);
    }
    if (liquidityPosition.routerType == RouterType.Velodrome) {
      return velodromeGetLiquidityTokenAddress(liquidityPosition);
    }
    if (liquidityPosition.routerType == RouterType.UniswapV2) {
      return uniswapV2GetLiquidityTokenAddress(liquidityPosition);
    }
    if (liquidityPosition.routerType == RouterType.UniswapV3) {
      return uniswapV3GetLiquidityTokenAddress(liquidityPosition);
    }
  }


  /***********************************|
  |         Private Functions         |
  |__________________________________*/

  function _contractCall(
    ContractCallGeneric memory contractCall
  ) internal {
    _requireAllowlisted(contractCall.contractAddress);
    require(_receivedAmount >= contractCall.amountIn, "Invalid amount for ContractCall");

    (bool success, bytes memory data) = contractCall.contractAddress.call{value: contractCall.amountIn}(
      contractCall.callData
    );
    if (!success) {
      assembly {
        let dataSize := mload(data) // Load the size of the data
        let dataPtr := add(data, 0x20) // Advance data pointer to the next word
        revert(dataPtr, dataSize) // Revert with the given data
      }
    }
  }

  function _swapSingleOrder(
    ERC20SwapOrderGeneric memory swapOrder,
    uint256 web3packsTokenId
  )
    internal
    returns (uint256 amountOut)
  {
    _requireAllowlisted(swapOrder.router);

    TransferHelper.safeApprove(swapOrder.tokenIn, swapOrder.router, swapOrder.tokenAmountIn);

    if (swapOrder.routerType == RouterType.Balancer) {
      amountOut = balancerSwapSingle(swapOrder);
    }
    if (swapOrder.routerType == RouterType.Velodrome) {
      amountOut = velodromeSwapSingle(swapOrder);
    }
    if (swapOrder.routerType == RouterType.UniswapV2) {
      amountOut = uniswapV2SwapSingle(swapOrder);
    }
    if (swapOrder.routerType == RouterType.UniswapV3) {
      amountOut = uniswapV3SwapSingle(swapOrder);
    }

    // Deposit the Assets into the Web3Packs NFT
    if (swapOrder.liquidityUuid == bytes32("")) {
      _energize(web3packsTokenId, swapOrder.tokenOut, amountOut);
    } else {
      _swapForLiquidityAmount[swapOrder.liquidityUuid] = TokenAmount({token: swapOrder.tokenOut, amount: amountOut});
    }
  }

  function _createLiquidityPosition(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3PacksTokenId,
    uint256 wethPerLp
  ) internal {
    _requireAllowlisted(liquidityOrder.router);

    uint256 lpTokenId;
    uint256 liquidity;
    uint256 amount0;
    uint256 amount1;

    (uint256 balanceAmount0, uint256 balanceAmount1) = _getAmountsForLiquidity(liquidityOrder, wethPerLp);

    uint256 amount0Min = (balanceAmount0 * (10000 - liquidityOrder.slippage)) / 10000;
    uint256 amount1Min = (balanceAmount1 * (10000 - liquidityOrder.slippage)) / 10000;

    TransferHelper.safeApprove(liquidityOrder.token0, address(liquidityOrder.router), balanceAmount0);
    TransferHelper.safeApprove(liquidityOrder.token1, address(liquidityOrder.router), balanceAmount1);

    if (liquidityOrder.routerType == RouterType.Balancer) {
      (lpTokenId, liquidity, amount0, amount1) = balancerCreatePosition(liquidityOrder, balanceAmount0, balanceAmount1);
      _energize(web3PacksTokenId, address(uint160(lpTokenId)), liquidity);
    }

    if (liquidityOrder.routerType == RouterType.Velodrome) {
      (lpTokenId, liquidity, amount0, amount1) = velodromeCreatePosition(liquidityOrder, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
      _energize(web3PacksTokenId, address(uint160(lpTokenId)), 0);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV2) {
      (lpTokenId, liquidity, amount0, amount1) = uniswapV2CreatePosition(liquidityOrder, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
      _energize(web3PacksTokenId, address(uint160(lpTokenId)), 0);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV3) {
      (lpTokenId, liquidity, amount0, amount1) = uniswapV3CreatePosition(liquidityOrder, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
      _bond(web3PacksTokenId, liquidityOrder.router, lpTokenId);
    }

    // Track Liquidity Positions
    LiquidityPosition memory position = LiquidityPosition({
      lpTokenId: lpTokenId,
      liquidity: liquidity,
      stable: liquidityOrder.stable,
      token0: liquidityOrder.token0,
      token1: liquidityOrder.token1,
      tickLower: liquidityOrder.tickLower,
      tickUpper: liquidityOrder.tickUpper,
      poolId: liquidityOrder.poolId,
      routerType: liquidityOrder.routerType,
      router: liquidityOrder.router
    });
    IWeb3PacksManager(_web3PacksManager).saveLiquidityPosition(web3PacksTokenId, position);

    // Refund unused assets
    _refundUnusedAssets(
      liquidityOrder.token0,
      amount0,
      balanceAmount0,
      liquidityOrder.token1,
      amount1,
      balanceAmount1
    );
  }

  function _removeLiquidity(
    LiquidityPosition memory liquidityPosition,
    LiquidityPairs memory liquidityPair
  )
    internal
    returns (uint amount0, uint amount1)
  {
    _requireAllowlisted(liquidityPosition.router);

    if (liquidityPosition.routerType == RouterType.Balancer) {
      (amount0, amount1) = balancerRemoveLiquidity(liquidityPosition, liquidityPair);
    }
    if (liquidityPosition.routerType == RouterType.Velodrome) {
      (amount0, amount1) = velodromeRemoveLiquidity(liquidityPosition, liquidityPair);
    }
    if (liquidityPosition.routerType == RouterType.UniswapV2) {
      (amount0, amount1) = uniswapV2RemoveLiquidity(liquidityPosition, liquidityPair);
    }
    if (liquidityPosition.routerType == RouterType.UniswapV3) {
      (amount0, amount1) = uniswapV3RemoveLiquidity(liquidityPosition, liquidityPair);
      (amount0, amount1) = uniswapV3CollectLpFees(liquidityPosition);
    }
  }

  function _getAmountsForLiquidity(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 wethPerLp
  )
    internal
    returns (uint256 balanceAmount0, uint256 balanceAmount1)
  {
    uint256 wethBalance = IERC20(_weth).balanceOf(address(this));

    if (liquidityOrder.liquidityUuidToken0 == bytes32("")) revert MissingLiquidityUUID(liquidityOrder.token0);
    if (liquidityOrder.liquidityUuidToken0 != bytes32("WETH")) {
      if (liquidityOrder.token0 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].token) revert MismatchedTokens();
      balanceAmount0 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].amount;
      delete _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0];
    } else {
      balanceAmount0 = wethPerLp > 0 ? wethPerLp : wethBalance;
    }

    if (liquidityOrder.liquidityUuidToken1 == bytes32("")) revert MissingLiquidityUUID(liquidityOrder.token1);
    if (liquidityOrder.liquidityUuidToken1 != bytes32("WETH")) {
      if (liquidityOrder.token1 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].token) revert MismatchedTokens();
      balanceAmount1 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].amount;
      delete _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1];
    } else {
      balanceAmount1 = wethPerLp > 0 ? wethPerLp : wethBalance;
    }

    if (liquidityOrder.liquidityUuidToken0 != bytes32("WETH") || wethPerLp == 0) {
      balanceAmount0 = (balanceAmount0 * liquidityOrder.percentToken0) / 10000;
    }
    if (liquidityOrder.liquidityUuidToken1 != bytes32("WETH") || wethPerLp == 0) {
      balanceAmount1 = (balanceAmount1 * liquidityOrder.percentToken1) / 10000;
    }
  }

  function _energize(
    uint256 tokenId,
    address tokenAddress,
    uint256 tokenAmount
  ) internal {
    if (tokenAmount == 0) {
      tokenAmount = IERC20(tokenAddress).balanceOf(address(this));
    }
    TransferHelper.safeTransfer(tokenAddress, _web3Packs, tokenAmount);
    IWeb3Packs(_web3Packs).energize(tokenId, tokenAddress, tokenAmount);
  }

  function _bond(
    uint256 tokenId,
    address nftTokenAddress,
    uint256 mintedTokenId
  ) internal {
    IERC721(nftTokenAddress).safeTransferFrom(address(this), _web3Packs, mintedTokenId);
    IWeb3Packs(_web3Packs).bond(tokenId, nftTokenAddress, mintedTokenId);
  }

  function _refundUnusedAssets(
    address token0,
    uint256 amount0,
    uint256 amount0ToMint,
    address token1,
    uint256 amount1,
    uint256 amount1ToMint
  ) internal {
    // Remove allowance and refund in both assets.
    if (amount0 < amount0ToMint) {
      uint256 refund0 = amount0ToMint - amount0;
      TransferHelper.safeTransfer(token0, _msgSender(), refund0);
    }

    if (amount1 < amount1ToMint) {
      uint256 refund1 = amount1ToMint - amount1;
      TransferHelper.safeTransfer(token1, _msgSender(), refund1);
    }
  }

  function _requireAllowlisted(address contractAddress) internal {
    if (!IWeb3PacksManager(_web3PacksManager).isContractAllowed(contractAddress)) {
      revert ContractNotAllowed();
    }
  }

  /***********************************|
  |          Only Admin/DAO           |
  |__________________________________*/

  /**
    * @dev Setup the Web3Packs Interface
  */
  function setWeb3Packs(address web3packs) external onlyOwner {
    require(web3packs != address(0), "Invalid address for web3packs");
    _web3Packs = web3packs;
    emit Web3PacksSet(web3packs);
  }

  /**
    * @dev Setup the Web3Packs Interface
  */
  function setWeb3PacksManager(address manager) external onlyOwner {
    require(manager != address(0), "Invalid address for web3packs manager");
    _web3PacksManager = manager;
    emit Web3PacksManagerSet(manager);
  }

  /***********************************|
  |          Only Admin/DAO           |
  |      (blackhole prevention)       |
  |__________________________________*/

  function withdrawEther(address payable receiver, uint256 amount) external virtual onlyOwner {
    _withdrawEther(receiver, amount);
  }

  function withdrawErc20(address payable receiver, address tokenAddress, uint256 amount) external virtual onlyOwner {
    _withdrawERC20(receiver, tokenAddress, amount);
  }

  function withdrawERC721(address payable receiver, address tokenAddress, uint256 tokenId) external virtual onlyOwner {
    _withdrawERC721(receiver, tokenAddress, tokenId);
  }

  function withdrawERC1155(address payable receiver, address tokenAddress, uint256 tokenId, uint256 amount) external virtual onlyOwner {
    _withdrawERC1155(receiver, tokenAddress, tokenId, amount);
  }

  function onERC721Received(
    address,
    address,
    uint256,
    bytes calldata
  ) external pure returns(bytes4) {
    return this.onERC721Received.selector;
  }

  modifier onlyWeb3Packs() {
    require(msg.sender == _web3Packs, "Web3PacksExchangeManager - Invalid Web3Packs");
    _;
  }
}
