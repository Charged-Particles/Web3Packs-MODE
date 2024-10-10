// SPDX-License-Identifier: MIT

// Web3PacksMode.sol
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
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/BlackholePrevention.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IWeb3PacksManager.sol";
import "./interfaces/IVelodrome.sol";
import {IAsset, IBalancerV2Vault} from "./interfaces/IBalancerV2Vault.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";

contract Web3PacksMode is
  IWeb3Packs,
  Ownable,
  Pausable,
  BlackholePrevention,
  ReentrancyGuard
{
  address internal _weth;
  address internal _proton;
  address internal _web3PacksManager;
  address internal _nonfungiblePositionManager;
  address internal _chargedParticles;
  address internal _chargedState;
  address payable internal _treasury;
  uint256 internal _protocolFee;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  mapping (bytes32 => TokenAmount) internal _swapForLiquidityAmount;

  // TODO: Refactor router handling for better scalability and maintainability
  // Consider using an array of routers in the constructor and removing the RouterType enum
  constructor(
    address weth,
    address proton,
    address nonfungiblePositionManager,
    address chargedParticles,
    address chargedState
  ) {
    _weth = weth;
    _proton = proton;
    _nonfungiblePositionManager = nonfungiblePositionManager;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    string calldata tokenMetaUri,
    ContractCallGeneric[] calldata contractCalls,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState,
    uint256 ethPackPrice
  )
    external
    whenNotPaused
    nonReentrant
    payable
    returns(uint256 tokenId)
  {
    _collectFees(ethPackPrice);

    // Mint Web3Pack NFT
    tokenId = _createBasicProton(tokenMetaUri);

    // Perform Generic Contract Calls before Bundling Assets
    _contractCalls(contractCalls);

    // Perform Token Swaps owned by the Web3Pack NFT
    _swap(erc20SwapOrders,  tokenId);

    // Create an LP position owned by the Web3Pack NFT
    _depositLiquidity(liquidityOrders, tokenId);

    // Set the Timelock State
    _lock(lockState, tokenId);

    // Transfer the Web3Packs NFT to the Buyer
    IBaseProton(_proton).safeTransferFrom(address(this), _msgSender(), tokenId);

    emit PackBundled(tokenId, _msgSender());
  }

  function unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    address[] calldata erc20s,
    NFT[] calldata nfts,
    TokenPairs[] calldata lps
  )
    external
    payable
    whenNotPaused
    nonReentrant
  {
    _collectFees(0);
    _unbundle(
      receiver,
      tokenAddress,
      tokenId,
      _cpWalletManager,
      erc20s,
      nfts,
      lps
    );
    emit PackUnbundled(tokenId, receiver);
  }

  function unbundleFromManager(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    string calldata walletManager,
    address[] calldata erc20s,
    NFT[] calldata nfts,
    TokenPairs[] calldata lps
  )
    external
    payable
    whenNotPaused
    nonReentrant
  {
    _collectFees(0);
    _unbundle(
      receiver,
      tokenAddress,
      tokenId,
      walletManager,
      erc20s,
      nfts,
      lps
    );
    emit PackUnbundled(tokenId, receiver);
  }

  /***********************************|
  |         Private Functions         |
  |__________________________________*/

  function _contractCalls(
    ContractCallGeneric[] calldata contractCalls
  )
    internal
    virtual
  {
    for (uint256 i; i < contractCalls.length; i++) {
      _contractCall(contractCalls[i]);
    }
  }

  function _swap(
    ERC20SwapOrderGeneric[] calldata orders,
    uint256 web3packsTokenId
  )
    internal
    virtual
  {
    for (uint256 i; i < orders.length; i++) {
      _swapSingleOrder(orders[i], web3packsTokenId);
    }
  }

  function _depositLiquidity(
    LiquidityOrderGeneric[] calldata orders,
    uint256 web3packsTokenId
  )
    internal
    virtual
  {
    for (uint256 i; i < orders.length; i++) {
      _createLiquidityPosition(orders[i], web3packsTokenId);
    }
  }

  function _createBasicProton(
    string memory tokenMetadataUri
  )
    internal
    returns (uint256 mintedTokenId)
  {
    // Mint Web3Packs NFT (Charged-Particles ProtonC)
    mintedTokenId = IBaseProton(_proton).createBasicProton(
      address(this),
      address(this),
      tokenMetadataUri
    );
  }

  function _bond(
    address contractAddress,
    uint256 tokenId,
    string memory basketManagerId,
    address nftTokenAddress,
    uint256 mintedTokenId
  )
    internal
  {
    // permission
    IERC721(nftTokenAddress).setApprovalForAll(_chargedParticles, true);

    IChargedParticles(_chargedParticles).covalentBond(
      contractAddress,
      tokenId,
      basketManagerId,
      nftTokenAddress,
      mintedTokenId,
      1
    );
  }

  function _energize(
    uint256 tokenId,
    address tokenAddress,
    uint256 tokenAmount
  )
   internal
  {
    if (tokenAmount == 0) {
      tokenAmount = IERC20(tokenAddress).balanceOf(address(this));
    }

    TransferHelper.safeApprove(
      tokenAddress,
      address(_chargedParticles),
      tokenAmount
    );

    IChargedParticles(_chargedParticles).energizeParticle(
      _proton,
      tokenId,
      _cpWalletManager,
      tokenAddress,
      tokenAmount,
      address(this)
    );
  }

  function _unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    string memory walletManager,
    address[] memory erc20s,
    NFT[] memory nfts,
    TokenPairs[] memory lps
  )
    internal
  {
    // Verify Ownership
    address owner = IERC721(tokenAddress).ownerOf(tokenId);
    if (_msgSender() != owner) {
      revert NotOwnerOrApproved();
    }

    for (uint256 i; i < erc20s.length; i++) {
      if (erc20s[i] != address(0)) {
        IChargedParticles(_chargedParticles).releaseParticle(
          receiver,
          tokenAddress,
          tokenId,
          walletManager,
          erc20s[i]
        );
      }
    }

    for (uint256 i; i < nfts.length; i++) {
      if (nfts[i].tokenAddress != address(0)) {
        IChargedParticles(_chargedParticles).breakCovalentBond(
          receiver,
          tokenAddress,
          tokenId,
          walletManager,
          nfts[i].tokenAddress,
          nfts[i].id,
          1
        );
      }
    }

    // Remove all Liquidity Positions
    _removeLiquidityPositions(tokenId, receiver, lps);
  }

  function _contractCall(
    ContractCallGeneric memory contractCall
  ) internal {
    _requireAllowlisted(contractCall.contractAddress);

    (bool success, bytes memory data ) = contractCall.contractAddress.call{value: contractCall.amountIn}(
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

    } else {
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

      if (swapOrder.routerType == RouterType.UniswapV2 || swapOrder.routerType == RouterType.Velodrome) {
        uint[] memory amounts = abi.decode(data, (uint[]));
        amountOut = amounts[amounts.length-1];
      }

      if (swapOrder.routerType == RouterType.UniswapV3) {
        amountOut = abi.decode(data, (uint256));
      }
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
    uint256 web3packsTokenId
  ) internal {
    _requireAllowlisted(liquidityOrder.router);

    uint256 wethBalance = IERC20(_weth).balanceOf(address(this));
    uint256 balanceAmount0;
    uint256 balanceAmount1;

    uint256 lpTokenId;
    uint256 liquidity;
    uint256 amount0;
    uint256 amount1;

    if (liquidityOrder.liquidityUuidToken0 == bytes32("")) revert MissingLiquidityUUID(liquidityOrder.token0);
    if (liquidityOrder.liquidityUuidToken0 != bytes32("WETH")) {
      if (liquidityOrder.token0 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].token) revert MismatchedTokens();
      balanceAmount0 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].amount;
      delete _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0];
    } else {
      balanceAmount0 = wethBalance;
    }

    if (liquidityOrder.liquidityUuidToken1 == bytes32("")) revert MissingLiquidityUUID(liquidityOrder.token1);
    if (liquidityOrder.liquidityUuidToken1 != bytes32("WETH")) {
      if (liquidityOrder.token1 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].token) revert MismatchedTokens();
      balanceAmount1 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].amount;
      delete _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1];
    } else {
      balanceAmount1 = wethBalance;
    }

    balanceAmount0 = (balanceAmount0 * liquidityOrder.percentToken0) / 10000;
    balanceAmount1 = (balanceAmount1 * liquidityOrder.percentToken1) / 10000;

    uint256 amount0Min = (balanceAmount0 * (10000 - liquidityOrder.slippage)) / 10000;
    uint256 amount1Min = (balanceAmount1 * (10000 - liquidityOrder.slippage)) / 10000;

    if (liquidityOrder.routerType == RouterType.UniswapV3) {
      TransferHelper.safeApprove(liquidityOrder.token0, _nonfungiblePositionManager, balanceAmount0);
      TransferHelper.safeApprove(liquidityOrder.token1, _nonfungiblePositionManager, balanceAmount1);
    } else {
      TransferHelper.safeApprove(liquidityOrder.token0, address(liquidityOrder.router), balanceAmount0);
      TransferHelper.safeApprove(liquidityOrder.token1, address(liquidityOrder.router), balanceAmount1);
    }

    if (liquidityOrder.routerType == RouterType.Balancer) {
      (lpTokenId, liquidity, amount0, amount1) = _createBalancerPosition(liquidityOrder, web3packsTokenId, balanceAmount0, balanceAmount1);
    }

    if (liquidityOrder.routerType == RouterType.Velodrome) {
      (lpTokenId, liquidity, amount0, amount1) = _createVelodromePosition(liquidityOrder, web3packsTokenId, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV2) {
      (lpTokenId, liquidity, amount0, amount1) = _createUniswapV2Position(liquidityOrder, web3packsTokenId, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV3) {
      (lpTokenId, liquidity, amount0, amount1) = _createUniswapV3Position(liquidityOrder, web3packsTokenId, balanceAmount0, balanceAmount1, amount0Min, amount1Min);
    }

    // Track Liquidity Positions
    LiquidityPosition memory position = LiquidityPosition({
      lpTokenId: lpTokenId,
      liquidity: liquidity,
      stable: liquidityOrder.stable,
      token0: liquidityOrder.token0,
      token1: liquidityOrder.token1,
      poolId: liquidityOrder.poolId,
      routerType: liquidityOrder.routerType,
      router: liquidityOrder.router
    });
    IWeb3PacksManager(_web3PacksManager).saveLiquidityPosition(web3packsTokenId, position);

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

  function _createBalancerPosition(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3packsTokenId,
    uint256 balanceAmount0,
    uint256 balanceAmount1
  ) internal returns (
    uint256 lpTokenId,
    uint256 liquidity,
    uint256 amount0,
    uint256 amount1
  ) {
      (address poolAddress, ) = IBalancerV2Vault(liquidityOrder.router).getPool(liquidityOrder.poolId);

      IAsset[] memory assets = new IAsset[](2);
      assets[0] = IAsset(liquidityOrder.token0);
      assets[1] = IAsset(liquidityOrder.token1);

      uint256[] memory amounts = new uint256[](2);
      amounts[0] = balanceAmount0;
      amounts[1] = balanceAmount1;

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

      // Deposit the LP tokens into the Web3Packs NFT
      _energize(web3packsTokenId, poolAddress, liquidity);
  }

  function _createVelodromePosition(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3packsTokenId,
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
      (amount0, amount1, liquidity) = IVelodrome(liquidityOrder.router).addLiquidity(
        liquidityOrder.token0,
        liquidityOrder.token1,
        liquidityOrder.stable,
        balanceAmount0,
        balanceAmount1,
        minAmount0,
        minAmount1,
        address(this),
        block.timestamp
      );

      // Deposit the LP tokens into the Web3Packs NFT
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityOrder.routerType, liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);
      lpTokenId = uint256(uint160(lpTokenAddress));
      _energize(web3packsTokenId, lpTokenAddress, 0);
  }

  function _createUniswapV2Position(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3packsTokenId,
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
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityOrder.routerType, liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);
      lpTokenId = uint256(uint160(lpTokenAddress));
      _energize(web3packsTokenId, lpTokenAddress, 0);
  }

  function _createUniswapV3Position(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3packsTokenId,
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
      (lpTokenId, liquidity, amount0, amount1) = INonfungiblePositionManager(_nonfungiblePositionManager).mint(params);

      // Deposit the LP NFT into the Web3Packs NFT
      _bond(_proton, web3packsTokenId, _cpBasketManager, _nonfungiblePositionManager, lpTokenId);
  }

  function _removeLiquidityPositions(
    uint256 web3packsTokenId,
    address receiver,
    TokenPairs[] memory lps
  ) internal {
    uint amount0;
    uint amount1;

    LiquidityPosition[] memory positions = IWeb3PacksManager(_web3PacksManager).getLiquidityPositions(web3packsTokenId);
    for (uint256 i; i < positions.length; i++) {
      LiquidityPosition memory lp = positions[i];
      TokenPairs memory amountsOutMin = lps[i];

      _pullLiquidityTokens(lp, web3packsTokenId);

      // Remove All Liquidity
      //  - must be done before collectLpFees as the removed liquidity
      //    is only returned through INonfungiblePositionManager.collect()
      (amount0, amount1) = _removeLiquidity(lp, amountsOutMin);

      // Collect Fees
      if (lp.routerType == RouterType.UniswapV3) {
        (amount0, amount1) = _collectLpFees(lp);
      }

      // Send to Receiver
      TransferHelper.safeTransfer(lp.token0, receiver, amount0);
      TransferHelper.safeTransfer(lp.token1, receiver, amount1);
    }
    IWeb3PacksManager(_web3PacksManager).clearLiquidityPositions(web3packsTokenId);
  }

  function _collectLpFees(
    LiquidityPosition memory liquidityPosition
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

    (amount0, amount1) = INonfungiblePositionManager(_nonfungiblePositionManager).collect(params);
  }

  function _removeLiquidity(
    LiquidityPosition memory liquidityPosition,
    TokenPairs memory amountsOutMin
  )
    internal
    returns (uint amount0, uint amount1)
  {
    if (liquidityPosition.routerType == RouterType.Balancer) {
      (address poolAddress, ) = IBalancerV2Vault(liquidityPosition.router).getPool(liquidityPosition.poolId);

      IAsset[] memory assets = new IAsset[](2);
      assets[0] = IAsset(liquidityPosition.token0);
      assets[1] = IAsset(liquidityPosition.token1);

      uint256[] memory amounts = new uint256[](2);
      amounts[0] = amountsOutMin.token0.amount;
      amounts[1] = amountsOutMin.token1.amount;

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

    if (liquidityPosition.routerType == RouterType.Velodrome) {
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.routerType, liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

      TransferHelper.safeApprove(
        lpTokenAddress,
        liquidityPosition.router,
        liquidityPosition.liquidity
      );

      (amount0, amount1) = IVelodrome(liquidityPosition.router).removeLiquidity(
        liquidityPosition.token0,
        liquidityPosition.token1,
        liquidityPosition.stable,
        liquidityPosition.liquidity,
        amountsOutMin.token0.amount,
        amountsOutMin.token1.amount,
        address(this),
        block.timestamp
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV2) {
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.routerType, liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

      TransferHelper.safeApprove(
        lpTokenAddress,
        liquidityPosition.router,
        liquidityPosition.liquidity
      );

      (amount0, amount1) = IUniswapV2Router02(liquidityPosition.router).removeLiquidity(
        liquidityPosition.token0,
        liquidityPosition.token1,
        liquidityPosition.liquidity,
        amountsOutMin.token0.amount,
        amountsOutMin.token1.amount,
        address(this),
        block.timestamp
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV3) {
      // Release Liquidity
      INonfungiblePositionManager.DecreaseLiquidityParams memory params =
        INonfungiblePositionManager.DecreaseLiquidityParams({
          tokenId: liquidityPosition.lpTokenId,
          liquidity: uint128(liquidityPosition.liquidity),
          amount0Min: amountsOutMin.token0.amount,
          amount1Min: amountsOutMin.token1.amount,
          deadline: block.timestamp
        });
      (amount0, amount1) = INonfungiblePositionManager(_nonfungiblePositionManager).decreaseLiquidity(params);
    }
  }

  function _pullLiquidityTokens(
    LiquidityPosition memory liquidityPosition,
    uint256 web3packsTokenId
  )
    internal
  {
    if (liquidityPosition.routerType == RouterType.Balancer) {
      // Grab Liquidity Tokens from Web3 Pack
      (address poolAddress, ) = IBalancerV2Vault(liquidityPosition.router).getPool(liquidityPosition.poolId);
      IChargedParticles(_chargedParticles).releaseParticle(
        address(this),
        _proton,
        web3packsTokenId,
        _cpBasketManager,
        poolAddress
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV2 || liquidityPosition.routerType == RouterType.Velodrome) {
      // Grab Liquidity Tokens from Web3 Pack
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.routerType, liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);
      IChargedParticles(_chargedParticles).releaseParticle(
        address(this),
        _proton,
        web3packsTokenId,
        _cpBasketManager,
        lpTokenAddress
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV3) {
      // Grab LP NFT From Web3 Pack
      IChargedParticles(_chargedParticles).breakCovalentBond(
        address(this),
        _proton,
        web3packsTokenId,
        _cpBasketManager,
        _nonfungiblePositionManager,
        liquidityPosition.lpTokenId,
        1
      );
    }
  }

  function _lock (
    LockState calldata lockState,
    uint256 tokenId
  )
    private
  {

    if(lockState.ERC20Timelock > 0) {
      IChargedState(_chargedState).setReleaseTimelock(
        _proton,
        tokenId,
        lockState.ERC20Timelock
      );
    }

    if(lockState.ERC721Timelock > 0) {
      IChargedState(_chargedState).setBreakBondTimelock(
        _proton,
        tokenId,
        lockState.ERC721Timelock
      );
    }
  }

  function _refundUnusedAssets(
    address token0,
    uint256 amount0,
    uint256 amount0ToMint,
    address token1,
    uint256 amount1,
    uint256 amount1ToMint
  ) private {
    // Remove allowance and refund in both assets.
    if (amount0 < amount0ToMint) {
        TransferHelper.safeApprove(token0, address(_nonfungiblePositionManager), 0); // Remove approval
        uint256 refund0 = amount0ToMint - amount0;
        TransferHelper.safeTransfer(token0, _msgSender(), refund0);
    }

    if (amount1 < amount1ToMint) {
        TransferHelper.safeApprove(token1, address(_nonfungiblePositionManager), 0); // Remove approval
        uint256 refund1 = amount1ToMint - amount1;
        TransferHelper.safeTransfer(token1, _msgSender(), refund1);
    }
  }

  function _requireAllowlisted(address contractAddress) internal {
    if (!IWeb3PacksManager(_web3PacksManager).isContractAllowed(contractAddress)) {
      revert ContractNotAllowed();
    }
  }

  function _collectFees(uint256 excludedAmount) internal {
    // Track Collected Fees
    if (_protocolFee > 0 && msg.value < (_protocolFee + excludedAmount)) {
      revert InsufficientForFee(msg.value, excludedAmount, _protocolFee);
    }
    uint256 fees = msg.value - excludedAmount;
    (bool sent, ) = _treasury.call{value: fees}("");
    require(sent, "Failed to send fees to Treasury");
  }

  /***********************************|
  |     Router-specific Functions     |
  |__________________________________*/

  function _getUniswapV2Factory(address router) private pure returns (address) {
    IUniswapV2Router02 _router = IUniswapV2Router02(router);
    return _router.factory();
  }

  function _getUniswapV2PairAddress(RouterType routerType, address router, address token0, address token1) private view returns (address) {
    if (routerType == RouterType.Velodrome) {
      return IVelodrome(router).poolFor(token0, token1, false);
    } else { // UniswapV2
      IUniswapV2Factory _factory = IUniswapV2Factory(_getUniswapV2Factory(router));
      return _factory.getPair(token0, token1);
    }
  }


  /***********************************|
  |          Only Admin/DAO           |
  |__________________________________*/

  /**
    * @dev Setup the ChargedParticles Interface
  */
  function setChargedParticles(address chargedParticles) external onlyOwner {
    require(chargedParticles != address(0), "Invalid address for chargedParticles");
    _chargedParticles = chargedParticles;
    emit ChargedParticlesSet(chargedParticles);
  }

  function setChargedState(address chargedState) external onlyOwner {
    require(chargedState != address(0), "Invalid address for chargedState");
    _chargedParticles = chargedState;
    emit ChargedStateSet(chargedState);
  }

  function setWeb3PacksManager(address manager) external onlyOwner {
    require(manager != address(0), "Invalid address for manager");
    _web3PacksManager = manager;
    emit Web3PacksManagerSet(manager);
  }

  function setTreasury(address payable treasury) external onlyOwner {
    require(treasury != address(0), "Invalid address for treasury");
    _treasury = treasury;
    emit Web3PacksTreasurySet(treasury);
  }

  function setProton(address proton) external onlyOwner {
    require(proton != address(0), "Invalid address for proton");
    _proton = proton;
    emit ProtonSet(proton);
  }

  function setProtocolFee(uint256 fee) external onlyOwner {
    _protocolFee = fee;
    emit ProtocolFeeSet(fee);
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
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
}
