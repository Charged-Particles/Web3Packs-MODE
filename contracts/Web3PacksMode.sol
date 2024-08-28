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
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/ERC721Mintable.sol";
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
  address _proton;
  address _nonfungiblePositionManager;
  address _chargedParticles;
  address _chargedState;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  mapping (address => bool) allowlisted;

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
  ){
    _proton = proton;
    _nonfungiblePositionManager = nonfungiblePositionManager;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;

    allowlisted[kimRouter] = true;
    allowlisted[velodromeRouter] = true;
    allowlisted[nonfungiblePositionManager] = true;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundleMode(
    address payable receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState,
    uint256 fee
  )
    external
    whenNotPaused
    payable
    returns(uint256 tokenId)
  {
    if (receiver == address(0x0))
      revert NullReceiver();

    _swap(erc20SwapOrders);
    _depositLiquidity(liquidityOrders);

    tokenId = _bundle(
      address(this),
      tokenMetaUri,
      erc20SwapOrders
    );

    _lock(lockState, tokenId);

    IBaseProton(_proton).safeTransferFrom(address(this), receiver, tokenId);
    _returnPositiveSlippageNative(receiver, fee);

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

  function swap(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders
  )
    external
    payable
    virtual
  {
    _swap(erc20SwapOrders);
  }

  function bond(
    address contractAddress,
    uint256 tokenId,
    string calldata tokenMetadataUri,
    string calldata basketManagerId,
    address nftTokenAddress
  )
   external
   returns (uint256 mintedTokenId)
  {
    mintedTokenId = _createBasicProton(
      contractAddress,
      tokenMetadataUri
    );

    _bond(
      contractAddress,
      tokenId,
      basketManagerId,
      nftTokenAddress,
      mintedTokenId
    );
  }

  function swapGeneric(ERC20SwapOrderGeneric calldata swapOrder) public payable {
    if (!allowlisted[swapOrder.router]) revert ContractNotAllowed();

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
  }

  function depositLiquidity(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders
  )
    public
    payable
  {
    _swap(erc20SwapOrders);
    _depositLiquidity(liquidityOrders);
  }


  /***********************************|
  |         Private Functions         |
  |__________________________________*/

  function _swap(
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders
  )
    internal
    virtual
  {
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      swapGeneric(
        erc20SwapOrders[i]
      );
    }
  }

  function _depositLiquidity(
   LiquidityOrderGeneric[] calldata orders
  )
    internal
    virtual
  {
    for (uint256 i; i < orders.length; i++) {
      LiquidityOrderGeneric calldata order = orders[i];
      if (!allowlisted[order.router]) revert ContractNotAllowed();

      TransferHelper.safeTransferFrom(order.token0, _msgSender(), address(this), order.amount0ToMint);
      TransferHelper.safeTransferFrom(order.token1, _msgSender(), address(this), order.amount1ToMint);

      TransferHelper.safeApprove(
        order.token0,
        address(order.router),
        order.amount0ToMint
      );

      TransferHelper.safeApprove(
        order.token1,
        address(order.router),
        order.amount1ToMint
      );

      (bool success, bytes memory data ) = order.router.call{ value: order.amountIn }(
        order.callData
      );

      if (!success) {
        assembly {
          let dataSize := mload(data) // Load the size of the data
          let dataPtr := add(data, 0x20) // Advance data pointer to the next word
          revert(dataPtr, dataSize) // Revert with the given data
        }
      }
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
    ERC721Mintable(nftTokenAddress).setApprovalForAll(_chargedParticles, true);

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
    bool forLiqudity
  )
   internal
  {
    if (! forLiqudity) {
      uint256 balance = ERC20(tokenAddress).balanceOf(address(this));

      TransferHelper.safeApprove(
        tokenAddress,
        address(_chargedParticles),
        balance
      );

      IChargedParticles(_chargedParticles).energizeParticle(
        _proton,
        tokenId,
        _cpWalletManager,
        tokenAddress,
        balance,
        address(this)
      );
    }
  }

  function _bundle(
    address receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders
  )
    internal
    returns (uint256 tokenId)
  {
    // Mint Web3Pack NFT to Receiver
    tokenId = IBaseProton(_proton).createBasicProton(address(this), receiver, tokenMetaUri);

    // Bundle Assets into NFT
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      _energize(tokenId, erc20SwapOrders[i].tokenOut, erc20SwapOrders[i].forLiquidity);
    }
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

  function _fund(
    address payable receiver,
    uint256 fundingAmount
  )
    private
  {
    if (address(this).balance >= fundingAmount) {
      (bool sent, ) = receiver.call{value: fundingAmount}("");
      if (!sent) {
        revert FundingFailed();
      }
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
      return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
  }

  function _returnPositiveSlippageNative(address receiver, uint256 fee) private {
    uint256 nativeBalance = address(this).balance;

    if (fee > nativeBalance) {
      revert InsufficientForFee();
    }

    uint256 amountToReturn = nativeBalance - fee;

    if (amountToReturn > 0) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = receiver.call{ value: amountToReturn }("");
        if (!success) revert NativeAssetTransferFailed();
    }
  }
}