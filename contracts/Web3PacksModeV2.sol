// SPDX-License-Identifier: MIT

// Web3PacksModeV2.sol
// Copyright (c) 2025 Firma Lux, Inc. <https://charged.fi>
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
//
//  __    __     _    _____   ___           _                   ____
// / / /\ \ \___| |__|___ /  / _ \__ _  ___| | _____     /\   /\___ \
// \ \/  \/ / _ \ '_ \ |_ \ / /_)/ _` |/ __| |/ / __|____\ \ / / __) |
//  \  /\  /  __/ |_) |__) / ___/ (_| | (__|   <\__ \_____\ V / / __/
//   \/  \/ \___|_.__/____/\/    \__,_|\___|_|\_\___/      \_/ |_____|
//

pragma solidity 0.8.17;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/BlackholePrevention.sol";
import "./interfaces/v2/IWeb3Packs.sol";
import "./interfaces/v2/IWeb3PacksDefs.sol";
import "./interfaces/v2/IWeb3PacksBundler.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";
import "./interfaces/IWETH9.sol";

contract Web3PacksModeV2 is
  IWeb3Packs,
  Ownable,
  Pausable,
  BlackholePrevention,
  ReentrancyGuard
{
  event ChargedParticlesSet(address indexed chargedParticles);
  event ChargedStateSet(address indexed chargedState);
  event ProtonSet(address indexed proton);
  event PackBundled(uint256 indexed tokenId, address indexed receiver, bytes32 packType, uint256 ethPackPrice);
  event PackUnbundled(uint256 indexed tokenId, address indexed receiver, uint256 ethAmount);
  event ProtocolFeeSet(uint256 fee);
  event Web3PacksTreasurySet(address indexed treasury);
  event BundlerRegistered(address indexed bundlerAddress, bytes32 bundlerId);

  address public _weth;
  address public _proton;
  address public _chargedParticles;
  address public _chargedState;
  address payable internal _treasury;
  uint256 public _protocolFee;

  mapping (bytes32 => address) internal _bundlersById;
  mapping (uint256 => bytes32[]) internal _bundlesByPackId;

  // Charged Particles Wallet Managers
  string public _cpWalletManager = "generic.B";
  string public _cpBasketManager = "generic.B";

  constructor(
    address weth,
    address proton,
    address chargedParticles,
    address chargedState
  ) {
    _weth = weth;
    _proton = proton;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    IWeb3PacksDefs.BundleChunk[] calldata bundleChunks,
    string calldata tokenMetaUri,
    IWeb3PacksDefs.LockState calldata lockState,
    bytes32 packType,
    uint256 ethPackPrice
  )
    external
    override
    payable
    whenNotPaused
    nonReentrant
    returns(uint256 tokenId)
  {
    _collectFees(ethPackPrice);
    tokenId = _bundle(
      bundleChunks,
      tokenMetaUri,
      lockState,
      ethPackPrice
    );
    emit PackBundled(tokenId, _msgSender(), packType, ethPackPrice);
  }

  function unbundle(
    address payable receiver,
    address tokenAddress,
    uint256 tokenId,
    bool sellAll
  )
    external
    override
    payable
    whenNotPaused
    nonReentrant
  {
    _collectFees(0);
    uint256 ethAmount = _unbundle(
      receiver,
      tokenAddress,
      tokenId,
      sellAll
    );
    emit PackUnbundled(tokenId, receiver, ethAmount);
  }

  /***********************************|
  |     Private Bundle Functions      |
  |__________________________________*/

  function _bundle(
    IWeb3PacksDefs.BundleChunk[] calldata bundleChunks,
    string calldata tokenMetaUri,
    IWeb3PacksDefs.LockState calldata lockState,
    uint256 ethPackPrice
  )
    internal
    returns(uint256 tokenId)
  {
    IWeb3PacksBundler bundler;

    // Mint Web3Pack NFT
    tokenId = _createBasicProton(tokenMetaUri);

    // Wrap ETH for WETH
    IWETH9(_weth).deposit{value: ethPackPrice}();
    uint256 wethTotal = IERC20(_weth).balanceOf(address(this));
    uint256 chunkWeth;

    // Returned from Each Bundle:
    address tokenAddress;
    uint256 amountOut;
    uint256 nftTokenId;

    bytes32[] memory packBundlerIds = new bytes32[](bundleChunks.length);
    for (uint256 i; i < bundleChunks.length; i++) {
      IWeb3PacksDefs.BundleChunk memory chunk = bundleChunks[i];
      packBundlerIds[i] = chunk.bundlerId;

      // Ensure Bundler is Registered
      if (_bundlersById[chunk.bundlerId] == address(0)) {
        revert BundlerNotRegistered(chunk.bundlerId);
      }
      bundler = IWeb3PacksBundler(_bundlersById[chunk.bundlerId]);

      // Calculate Percent
      chunkWeth = (wethTotal * chunk.percentBasisPoints) / 10000;

      // Send WETH to Bundler
      TransferHelper.safeTransfer(_weth, address(bundler), chunkWeth);

      // Receive Assets from Bundler
      (tokenAddress, amountOut, nftTokenId) = bundler.bundle(tokenId, _msgSender());

      // Deposit the Assets into the Web3Packs NFT
      if (nftTokenId == 0) {
        _energize(tokenId, tokenAddress, amountOut);
      } else {
        _bond(tokenId, tokenAddress, nftTokenId);
      }
    }

    // Track Bundles in Pack
    _bundlesByPackId[tokenId] = packBundlerIds;

    // Set the Timelock State
    _lock(lockState, tokenId);

    // Transfer the Web3Packs NFT to the Buyer
    IBaseProton(_proton).safeTransferFrom(address(this), _msgSender(), tokenId);
  }

  function _unbundle(
    address payable receiver,
    address tokenAddress,
    uint256 packTokenId,
    bool sellAll
  )
    internal
    returns (uint ethAmount)
  {
    IWeb3PacksBundler bundler;

    // Verify Ownership
    address owner = IERC721(tokenAddress).ownerOf(packTokenId);
    if (_msgSender() != owner) {
      revert NotOwnerOrApproved();
    }

    // Ensure Pack has Bundles
    if (_bundlesByPackId[packTokenId].length == 0) {
      revert NoBundlesInPack();
    }

    address assetReceiver;
    address lpTokenAddress;
    uint256 lpTokenId;
    for (uint i; i < _bundlesByPackId[packTokenId].length; i++) {
      bytes32 bundlerId = _bundlesByPackId[packTokenId][i];

      // Ensure Bundler is Registered
      if (_bundlersById[bundlerId] == address(0)) {
        // revert BundlerNotRegistered(bundlerId);
        continue; // skip unregistered bundlers
      }
      bundler = IWeb3PacksBundler(_bundlersById[bundlerId]);

      // Pull Assets from NFT
      (lpTokenAddress, lpTokenId) = bundler.getLiquidityToken(packTokenId);
      assetReceiver = sellAll ? _bundlersById[bundlerId] : receiver;
      if (lpTokenId == 0) {
        _release(assetReceiver, packTokenId, lpTokenAddress);
      } else {
        _breakBond(assetReceiver, packTokenId, lpTokenAddress, lpTokenId);
      }

      // Unbundle current asset
      ethAmount += bundler.unbundle(receiver, packTokenId, sellAll);
    }

    // Clear Bundles for Pack
    delete _bundlesByPackId[packTokenId];
  }

  /***********************************|
  |     Private Charged Functions     |
  |__________________________________*/

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

  function _energize(
    uint256 packTokenId,
    address assetTokenAddress,
    uint256 assetTokenAmount
  )
    internal
  {
    if (assetTokenAmount == 0) {
      assetTokenAmount = IERC20(assetTokenAddress).balanceOf(address(this));
    }

    TransferHelper.safeApprove(
      assetTokenAddress,
      address(_chargedParticles),
      assetTokenAmount
    );

    IChargedParticles(_chargedParticles).energizeParticle(
      _proton,
      packTokenId,
      _cpWalletManager,
      assetTokenAddress,
      assetTokenAmount,
      address(this)
    );
  }

  function _release(
    address receiver,
    uint256 packTokenId,
    address assetTokenAddress
  )
    internal
  {
    IChargedParticles(_chargedParticles).releaseParticle(
      receiver,
      _proton,
      packTokenId,
      _cpWalletManager,
      assetTokenAddress
    );
  }

  function _bond(
    uint256 packTokenId,
    address nftTokenAddress,
    uint256 nftTokenId
  )
    internal
  {
    IERC721(nftTokenAddress).setApprovalForAll(_chargedParticles, true);

    IChargedParticles(_chargedParticles).covalentBond(
      _proton,
      packTokenId,
      _cpBasketManager,
      nftTokenAddress,
      nftTokenId,
      1
    );
  }

  function _breakBond(
    address receiver,
    uint256 packTokenId,
    address nftTokenAddress,
    uint256 nftTokenId
  )
    internal
  {
    IChargedParticles(_chargedParticles).breakCovalentBond(
      receiver,
      _proton,
      packTokenId,
      _cpBasketManager,
      nftTokenAddress,
      nftTokenId,
      1
    );
  }

  function _lock(LockState calldata lockState, uint256 tokenId) internal {
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
    _chargedState = chargedState;
    emit ChargedStateSet(chargedState);
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

  function registerBundlerId(bytes32 bundlerId, address bundlerAddress) external onlyOwner {
    _bundlersById[bundlerId] = bundlerAddress;
    emit BundlerRegistered(bundlerAddress, bundlerId);
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
