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

contract Web3PacksMode is
  IWeb3Packs,
  Ownable,
  Pausable,
  BlackholePrevention
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

  // Custom Errors
  error FundingFailed();
  error NullReceiver();
  error ContractNotAllowed();
  error NativeAssetTransferFailed();
  error UnsucessfulSwap(address tokenOut, uint256 amountIn, address router);
  error InsufficientForFee();

  constructor(
    address proton,
    address nonfungiblePositionManager,
    address chargedParticles,
    address chargedState,
    address kimRouter,
    address velodromeRouter
  ) {
    _proton = proton;
    _nonfungiblePositionManager = nonfungiblePositionManager;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;

    _allowlisted[kimRouter] = true;
    _allowlisted[velodromeRouter] = true;
    _allowlisted[nonfungiblePositionManager] = true;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    address payable receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState
  )
    external
    whenNotPaused
    payable
    returns(uint256 tokenId)
  {
    if (receiver == address(0x0)) {
      revert NullReceiver();
    }

    // Track Collected Fees
    if (_protocolFee > 0 && msg.value < _protocolFee) {
      revert InsufficientForFee();
    }
    _feesCollected += _protocolFee;

    // Mint Web3Pack NFT to Receiver
    tokenId = IBaseProton(_proton).createBasicProton(address(this), receiver, tokenMetaUri);

    // Swap ETH for Various Assets to be put inside of the Web3Pack NFT
    _swap(erc20SwapOrders,  tokenId);

    // Swap ETH for Various Assets to be used for creating an LP position owned by the Web3Pack NFT
    _depositLiquidity(liquidityOrders, tokenId);

    // Set the Timelock State
    _lock(lockState, tokenId);

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
    payable
    whenNotPaused
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
  {
    _unbundle(receiver, tokenAddress,tokenId, walletManager, web3PackOrder);
    emit PackUnbundled(tokenId, receiver);
  }


  /***********************************|
  |         Private Functions         |
  |__________________________________*/

  function _swap(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    uint256 web3packsTokenId
  )
    internal
    virtual
  {
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      _swapSingleOrder(erc20SwapOrders[i], web3packsTokenId);
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
    address tokenAddress
  )
   internal
  {
    uint256 tokenBalance = ERC20(tokenAddress).balanceOf(address(this));
    TransferHelper.safeApprove(
      tokenAddress,
      address(_chargedParticles),
      tokenBalance
    );

    IChargedParticles(_chargedParticles).energizeParticle(
      _proton,
      tokenId,
      _cpWalletManager,
      tokenAddress,
      tokenBalance,
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
  }

  function _swapSingleOrder(
    ERC20SwapOrderGeneric memory swapOrder,
    uint256 web3packsTokenId
  )
    internal
    returns (uint256 amountOut)
  {
    if (!_allowlisted[swapOrder.router]) revert ContractNotAllowed();

    TransferHelper.safeApprove(swapOrder.tokenIn, address(swapOrder.router), swapOrder.amountIn);

    (bool success, bytes memory data ) = swapOrder.router.call{ value: swapOrder.amountIn }(
      swapOrder.callData
    );
    if (!success) {
      assembly {
        let dataSize := mload(data) // Load the size of the data
        let dataPtr := add(data, 0x20) // Advance data pointer to the next word
        revert(dataPtr, dataSize) // Revert with the given data
      }
    }

    if (swapOrder.routerType == RouterType.UniswapV2) {
      uint[] memory amounts = abi.decode(data, (uint[]));
      amountOut = amounts[1];
    }

    if (swapOrder.routerType == RouterType.UniswapV3) {
      amountOut = abi.decode(data, (uint256));
    }

    // Deposit the Assets into the Web3Packs NFT
    _energize(web3packsTokenId, swapOrder.tokenOut);
  }

  function _createLiquidityPosition(
    LiquidityOrderGeneric memory liquidityOrder,
    uint256 web3packsTokenId
  ) internal {
    if (!_allowlisted[liquidityOrder.router]) revert ContractNotAllowed();

    TransferHelper.safeTransferFrom(liquidityOrder.token0, _msgSender(), address(this), liquidityOrder.amount0ToMint);
    TransferHelper.safeTransferFrom(liquidityOrder.token1, _msgSender(), address(this), liquidityOrder.amount1ToMint);

    TransferHelper.safeApprove(
      liquidityOrder.token0,
      address(liquidityOrder.router),
      liquidityOrder.amount0ToMint
    );

    TransferHelper.safeApprove(
      liquidityOrder.token1,
      address(liquidityOrder.router),
      liquidityOrder.amount1ToMint
    );

    // Pass calldata to Router to initiale LP position
    (bool success, bytes memory data ) = liquidityOrder.router.call{ value: liquidityOrder.amountIn }(
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
    uint256 liquidity;
    uint256 amount0;
    uint256 amount1;

    if (liquidityOrder.routerType == RouterType.UniswapV2) {
      (amount0, amount1, liquidity) = abi.decode(data, (uint256, uint256, uint128));

      // Deposit the LP tokens into the Web3Packs NFT
      address lpTokenAddress = _getUniswapV2PairAddress(liquidityOrder.router, liquidityOrder.token0, liquidityOrder.token1);
      _energize(web3packsTokenId, lpTokenAddress);
    }

    if (liquidityOrder.routerType == RouterType.UniswapV3) {
      (lpTokenId, liquidity, amount0, amount1) = abi.decode(data, (uint256, uint128, uint256, uint256));

      // Deposit the LP NFT into the Web3Packs NFT
      _bond(_proton, web3packsTokenId, _cpBasketManager, _nonfungiblePositionManager, lpTokenId);
    }

    // Refund unused assets
    _refundUnusedAssets(
      _msgSender(),
      liquidityOrder.token0,
      amount0,
      liquidityOrder.amount0ToMint,
      liquidityOrder.token1,
      amount1,
      liquidityOrder.amount1ToMint
    );
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


  /***********************************|
  |     Router-specific Functions     |
  |__________________________________*/

  function _getUniswapV2Factory(address router) private pure returns (address) {
    IUniswapV2Router02 _router = IUniswapV2Router02(router);
    return _router.factory();
  }

  function _getUniswapV2PairAddress(address router, address tokenA, address tokenB) private view returns (address) {
    IUniswapV2Factory _factory = IUniswapV2Factory(_getUniswapV2Factory(router));
    return _factory.getPair(tokenA, tokenB);
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

  function _returnPositiveSlippageNative(address receiver) private {
    uint256 extraBalance = address(this).balance - _feesCollected;
    if (extraBalance > 0) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{ value: extraBalance }("");
        if (!success) revert NativeAssetTransferFailed();
    }
  }

  function _refundUnusedAssets(
    address receiver,
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
        TransferHelper.safeTransfer(token0, receiver, refund0); // refund
    }

    if (amount1 < amount1ToMint) {
        TransferHelper.safeApprove(token1, address(_nonfungiblePositionManager), 0); // Remove approval
        uint256 refund1 = amount1ToMint - amount1;
        TransferHelper.safeTransfer(token1, receiver, refund1); // refund
    }
  }
}
