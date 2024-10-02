// SPDX-License-Identifier: MIT

// Web3Packs.sol
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
import "./lib/AllowList.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";

interface ERC20 {
  function balanceOf(address account) external view returns (uint256);
}

interface IVelodrome {
  function poolFor(address tokenA, address tokenB, bool stable) external view returns (address pool);
  function removeLiquidity(
    address tokenA,
    address tokenB,
    bool stable,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadline
  ) external returns (uint256 amountA, uint256 amountB);
}

contract Web3PacksMode is
  IWeb3Packs,
  Ownable,
  Pausable,
  BlackholePrevention,
  ReentrancyGuard
{
  address internal _proton;
  address internal _nonfungiblePositionManager;
  address internal _chargedParticles;
  address internal _chargedState;

  uint256 internal _feesCollected;
  uint256 internal _protocolFee;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  mapping (address => bool) internal _allowlisted;
  mapping (uint256 => mapping (address => uint256)) internal _refundableAssets;
  mapping (bytes32 => TokenAmount) internal _swapForLiquidityAmount;
  mapping (uint256 => LiquidityPosition[]) internal _liquidityPositions;

  // TODO: Refactor router handling for better scalability and maintainability
  // Consider using an array of routers in the constructor and removing the RouterType enum
  constructor(
    address proton,
    address nonfungiblePositionManager,
    address chargedParticles,
    address chargedState,
    address kimRouter,
    address velodromeRouter,
    address balancerRouter
  ) {
    _proton = proton;
    _nonfungiblePositionManager = nonfungiblePositionManager;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;

    _allowlisted[kimRouter] = true;
    _allowlisted[velodromeRouter] = true;
    _allowlisted[nonfungiblePositionManager] = true;
    _allowlisted[balancerRouter] = true;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

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
    whenNotPaused
    nonReentrant
    payable
    returns(uint256 tokenId)
  {
    if (receiver == address(0x0)) {
      revert NullReceiver();
    }

    // Track Collected Fees
    if (_protocolFee > 0 && msg.value < ethPackPrice + _protocolFee) {
      revert InsufficientForFee(msg.value, ethPackPrice, _protocolFee);
    }
    _feesCollected += _protocolFee;

    // Mint Web3Pack NFT
    tokenId = IBaseProton(_proton).createBasicProton(address(this), address(this), tokenMetaUri);

    // Perform Generic Contract Calls before Bundling Assets
    _contractCalls(contractCalls);

    // Perform Token Swaps owned by the Web3Pack NFT
    _swap(erc20SwapOrders,  tokenId);

    // Create an LP position owned by the Web3Pack NFT
    _depositLiquidity(liquidityOrders, tokenId);

    // Set the Timelock State
    _lock(lockState, tokenId);

    // Transfer the Web3Packs NFT to the Buyer
    IBaseProton(_proton).safeTransferFrom(address(this), receiver, tokenId);

    // Refund any slippage amounts
    _returnPositiveSlippageNative(receiver);

    emit PackBundled(tokenId, receiver);
  }

  function unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    Web3PackOrder calldata web3PackOrder
  )
    external
    whenNotPaused
    nonReentrant
  {
    _unbundle(
      receiver,
      tokenAddress,
      tokenId,
      _cpWalletManager,
      web3PackOrder
    );
    emit PackUnbundled(tokenId, receiver);
  }

  function unbundleFromManager(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    string calldata walletManager,
    Web3PackOrder calldata web3PackOrder
  )
    external
    whenNotPaused
    nonReentrant
  {
    _unbundle(receiver, tokenAddress,tokenId, walletManager, web3PackOrder);
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
    address contractAddress,
    string memory tokenMetadataUri
  )
    internal
    returns (uint256 mintedTokenId)
  {
    // mint
    mintedTokenId = IBaseProton(contractAddress).createBasicProton(
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
      tokenAmount = ERC20(tokenAddress).balanceOf(address(this));
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
    Web3PackOrder calldata web3PackOrder
  )
    internal
  {
    // Verify Ownership
    address owner = IERC721(tokenAddress).ownerOf(tokenId);
    if (_msgSender() != owner) {
      revert NotOwnerOrApproved();
    }

    for (uint256 i; i < web3PackOrder.erc20TokenAddresses.length; i++) {
      IChargedParticles(_chargedParticles).releaseParticle(
        receiver,
        tokenAddress,
        tokenId,
        walletManager,
        web3PackOrder.erc20TokenAddresses[i]
      );
    }

    for (uint256 i; i < web3PackOrder.nfts.length; i++) {
      IChargedParticles(_chargedParticles).breakCovalentBond(
        receiver,
        tokenAddress,
        tokenId,
        walletManager,
        web3PackOrder.nfts[i].tokenAddress,
        web3PackOrder.nfts[i].id,
        1
      );
    }

    // Remove all Liquidity Positions
    _removeLiquidityPositions(tokenId, receiver);
  }

  function _contractCall(
    ContractCallGeneric memory contractCall
  ) internal {
    if (!_allowlisted[contractCall.contractAddress]) revert ContractNotAllowed();

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
    if (!_allowlisted[swapOrder.router]) revert ContractNotAllowed();

    TransferHelper.safeApprove(swapOrder.tokenIn, address(swapOrder.router), swapOrder.tokenAmountIn);

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

    if (swapOrder.routerType == RouterType.Balancer) {
      (int256[] memory assetDeltas) = abi.decode(data, (int256[]));
      amountOut = uint256(-assetDeltas[1]);
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
    if (!_allowlisted[liquidityOrder.router]) revert ContractNotAllowed();

    uint256 balanceAmount0 = liquidityOrder.amount0ToMint;
    uint256 balanceAmount1 = liquidityOrder.amount1ToMint;

    if (liquidityOrder.liquidityUuidToken0 != bytes32("")) {
      if (liquidityOrder.token0 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].token) {
        revert MismatchedTokens();
      }
      balanceAmount0 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken0].amount;
    }

    if (liquidityOrder.liquidityUuidToken1 != bytes32("")) {
      if (liquidityOrder.token1 != _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].token) {
        revert MismatchedTokens();
      }
      balanceAmount1 = _swapForLiquidityAmount[liquidityOrder.liquidityUuidToken1].amount;
    }

    TransferHelper.safeApprove(
      liquidityOrder.token0,
      address(liquidityOrder.router),
      balanceAmount0
    );

    TransferHelper.safeApprove(
      liquidityOrder.token1,
      address(liquidityOrder.router),
      balanceAmount1
    );

    // Pass calldata to Router to initiale LP position
    (bool success, bytes memory data ) = liquidityOrder.router.call{ value: liquidityOrder.payableAmountIn }(
      liquidityOrder.callData
    );
    if (!success) {
      assembly {
        let dataSize := mload(data) // Load the size of the data
        let dataPtr := add(data, 0x20) // Advance data pointer to the next word
        revert(dataPtr, dataSize) // Revert with the given data
      }
    }

    uint256 lpTokenId;
    uint128 liquidity;
    uint256 amount0;
    uint256 amount1;

    if (liquidityOrder.routerType == RouterType.UniswapV2 || liquidityOrder.routerType == RouterType.Velodrome) {
      (amount0, amount1, liquidity) = abi.decode(data, (uint256, uint256, uint128));

      // Deposit the LP tokens into the Web3Packs NFT
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityOrder.routerType, liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);

      lpTokenId = uint256(uint160(lpTokenAddress));
      _energize(web3packsTokenId, lpTokenAddress, 0);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV3) {
      (lpTokenId, liquidity, amount0, amount1) = abi.decode(data, (uint256, uint128, uint256, uint256));

      // Deposit the LP NFT into the Web3Packs NFT
      _bond(_proton, web3packsTokenId, _cpBasketManager, _nonfungiblePositionManager, lpTokenId);
    }

    // Track Liquidity Positions
    _liquidityPositions[web3packsTokenId].push(
      LiquidityPosition({
        lpTokenId: lpTokenId,
        liquidity: liquidity,
        token0: liquidityOrder.token0,
        token1: liquidityOrder.token1,
        routerType: liquidityOrder.routerType,
        router: liquidityOrder.router
      })
    );

    // Refund unused assets
    _updateRefundableAssets(
      lpTokenId,
      liquidityOrder.token0,
      amount0,
      balanceAmount0,
      liquidityOrder.token1,
      amount1,
      balanceAmount1
    );
  }

  function _removeLiquidityPositions(
    uint256 web3packsTokenId,
    address receiver
  ) internal {
    uint amount0;
    uint amount1;
    uint refund0;
    uint refund1;

    for (uint256 i; i < _liquidityPositions[web3packsTokenId].length; i++) {
      LiquidityPosition memory lp = _liquidityPositions[web3packsTokenId][i];

      _pullLiquidityTokens(lp, web3packsTokenId);

      // Remove All Liquidity
      //  - must be done before collectLpFees as the removed liquidity
      //    is only returned through INonfungiblePositionManager.collect()
      (amount0, amount1) = _removeLiquidity(lp);

      // Collect Fees
      if (lp.routerType == RouterType.UniswapV3) {
        (amount0, amount1) = _collectLpFees(lp);
      }

      // Check for Refundable Assets
      refund0 = _refundableAssets[lp.lpTokenId][lp.token0];
      refund1 = _refundableAssets[lp.lpTokenId][lp.token1];
      _refundableAssets[lp.lpTokenId][lp.token0] = 0;
      _refundableAssets[lp.lpTokenId][lp.token1] = 0;

      // Send to Receiver
      TransferHelper.safeTransfer(lp.token0, receiver, amount0 + refund0);
      TransferHelper.safeTransfer(lp.token1, receiver, amount1 + refund1);
    }
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
    LiquidityPosition memory liquidityPosition
  )
    internal
    returns (uint amount0, uint amount1)
  {
    if (liquidityPosition.routerType == RouterType.Velodrome) {
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.routerType, liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

      TransferHelper.safeApprove(
        lpTokenAddress,
        address(liquidityPosition.router),
        liquidityPosition.liquidity
      );

      (amount0, amount1) = IVelodrome(liquidityPosition.router).removeLiquidity(
        liquidityPosition.token0,
        liquidityPosition.token1,
        false,
        liquidityPosition.liquidity,
        0,
        0,
        address(this),
        block.timestamp
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV2) {
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityPosition.routerType, liquidityPosition.router, liquidityPosition.token0, liquidityPosition.token1);

      TransferHelper.safeApprove(
        lpTokenAddress,
        address(liquidityPosition.router),
        liquidityPosition.liquidity
      );

      (amount0, amount1) = IUniswapV2Router02(liquidityPosition.router).removeLiquidity(
        liquidityPosition.token0,
        liquidityPosition.token1,
        liquidityPosition.liquidity,
        0,
        0,
        address(this),
        block.timestamp
      );
    }

    if (liquidityPosition.routerType == RouterType.UniswapV3) {
      // Release Liquidity
      INonfungiblePositionManager.DecreaseLiquidityParams memory params =
        INonfungiblePositionManager.DecreaseLiquidityParams({
          tokenId: liquidityPosition.lpTokenId,
          liquidity: liquidityPosition.liquidity,
          amount0Min: 0,
          amount1Min: 0,
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

  function _returnPositiveSlippageNative(address receiver) private {
    uint256 extraBalance = address(this).balance - _feesCollected;
    if (extraBalance > 0) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{ value: extraBalance }("");
        if (!success) revert NativeAssetTransferFailed();
    }
  }

  function _updateRefundableAssets(
    uint256 lpTokenId,
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
        _refundableAssets[lpTokenId][token0] = refund0;
    }

    if (amount1 < amount1ToMint) {
        TransferHelper.safeApprove(token1, address(_nonfungiblePositionManager), 0); // Remove approval
        uint256 refund1 = amount1ToMint - amount1;
        _refundableAssets[lpTokenId][token1] = refund1;
    }
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
    _chargedParticles = chargedParticles;
    emit ChargedParticlesSet(chargedParticles);
  }

  function setChargedState(address chargedState) external onlyOwner {
    _chargedParticles = chargedState;
    emit ChargedStateSet(chargedState);
  }

  function setProton(address proton) external onlyOwner {
    _proton = proton;
    emit ProtonSet(proton);
  }

  function setProtocolFee(uint256 fee) external onlyOwner {
    _protocolFee = fee;
    emit ProtocolFeeSet(fee);
  }

  function setContractAllowlist(address contractAddress, bool isAllowed) external onlyOwner {
    _allowlisted[contractAddress] = isAllowed;
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

