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
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/BlackholePrevention.sol";
import "./lib/Balancer.sol";
import "./lib/UniswapV2.sol";
import "./lib/UniswapV3.sol";
import "./lib/Velodrome.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IWeb3PacksManager.sol";
import "./interfaces/IWeb3PacksExchangeManager.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";

contract Web3PacksMode is
  IWeb3Packs,
  Ownable,
  Pausable,
  BlackholePrevention,
  ReentrancyGuard
{
  address public _weth;
  address public _proton;
  address public _web3PacksManager;
  address public _web3PacksExchangeManager;
  address public _chargedParticles;
  address public _chargedState;
  address payable internal _treasury;
  uint256 public _protocolFee;

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
    override
    payable
    whenNotPaused
    nonReentrant
    returns(uint256 tokenId)
  {
    _collectFees(ethPackPrice);
    tokenId = _bundle(
      tokenMetaUri,
      contractCalls,
      erc20SwapOrders,
      liquidityOrders,
      lockState,
      ethPackPrice
    );
    emit PackBundled(tokenId, _msgSender(), packType, usdPackPrice);
  }

  function unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] calldata liquidityPairs,
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
      _cpWalletManager,
      erc20SwapOrders,
      liquidityPairs,
      sellAll
    );
    emit PackUnbundled(tokenId, receiver, ethAmount);
  }

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
      walletManager,
      erc20SwapOrders,
      liquidityPairs,
      sellAll
    );
    emit PackUnbundled(tokenId, receiver, ethAmount);
  }

  function energize(
    uint256 tokenId,
    address tokenAddress,
    uint256 tokenAmount
  )
    external
    override
    whenNotPaused
    onlyExchangeManager
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

  function bond(
    uint256 tokenId,
    address nftTokenAddress,
    uint256 mintedTokenId
  )
    external
    override
    whenNotPaused
    onlyExchangeManager
  {
    IERC721(nftTokenAddress).setApprovalForAll(_chargedParticles, true);

    IChargedParticles(_chargedParticles).covalentBond(
      _proton,
      tokenId,
      _cpWalletManager,
      nftTokenAddress,
      mintedTokenId,
      1
    );
  }

  /***********************************|
  |         Private Functions         |
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

  function _bundle(
    string calldata tokenMetaUri,
    ContractCallGeneric[] calldata contractCalls,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityOrderGeneric[] calldata liquidityOrders,
    LockState calldata lockState,
    uint256 ethPackPrice
  )
    internal
    returns(uint256 tokenId)
  {
    // Mint Web3Pack NFT
    tokenId = _createBasicProton(tokenMetaUri);

    // Transfer ETH (ethPackPrice)
    (bool sent, ) = _web3PacksExchangeManager.call{value: ethPackPrice}("");
    require(sent, "Failed to send fees to Exchange Manager");

    // Perform Generic Contract Calls before Bundling Assets
    IWeb3PacksExchangeManager(_web3PacksExchangeManager).performContractCalls(contractCalls);

    // Perform Token Swaps owned by the Web3Pack NFT
    IWeb3PacksExchangeManager(_web3PacksExchangeManager).performSwaps(erc20SwapOrders, tokenId);

    // Create an LP position owned by the Web3Pack NFT
    IWeb3PacksExchangeManager(_web3PacksExchangeManager).depositLiquidity(liquidityOrders, tokenId);

    // Set the Timelock State
    _lock(lockState, tokenId);

    // Transfer the Web3Packs NFT to the Buyer
    IBaseProton(_proton).safeTransferFrom(address(this), _msgSender(), tokenId);
  }

  function _unbundle(
    address receiver,
    address tokenAddress,
    uint256 tokenId,
    string memory walletManager,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityPairs[] memory liquidityPairs,
    bool sellAll
  )
    internal
    returns (uint ethAmount)
  {
    // Verify Ownership
    address owner = IERC721(tokenAddress).ownerOf(tokenId);
    if (_msgSender() != owner) {
      revert NotOwnerOrApproved();
    }

    // Pull Swap Tokens from Web3 Pack
    address _receiver = sellAll ? _web3PacksExchangeManager : receiver;
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      if (erc20SwapOrders[i].tokenIn != _weth) {
        IChargedParticles(_chargedParticles).releaseParticle(_receiver, tokenAddress, tokenId, walletManager, erc20SwapOrders[i].tokenIn);
      }
      if (erc20SwapOrders[i].tokenOut != _weth) {
        IChargedParticles(_chargedParticles).releaseParticle(_receiver, tokenAddress, tokenId, walletManager, erc20SwapOrders[i].tokenOut);
      }
    }

    // Remove Liquidity Tokens from Web3 Pack
    _removeLiquidityTokens(receiver, tokenId, liquidityPairs, sellAll);

    // Sell All Tokens for wETH
    if (sellAll) {
      ethAmount = IWeb3PacksExchangeManager(_web3PacksExchangeManager).swapAllForEth(erc20SwapOrders, liquidityPairs, receiver);
    }
  }

  function _removeLiquidityTokens(
    address receiver,
    uint256 web3packsTokenId,
    LiquidityPairs[] memory liquidityPairs,
    bool sellAll
  ) internal {
    LiquidityPosition[] memory positions = IWeb3PacksManager(_web3PacksManager).getLiquidityPositions(web3packsTokenId);
    for (uint256 i; i < positions.length; i++) {
      LiquidityPosition memory liquidityPosition = positions[i];
      LiquidityPairs memory liquidityPair = liquidityPairs[i];

      address _receiver = (sellAll || liquidityPair.exitLpOnUnbundle) ? _web3PacksExchangeManager : receiver;
      (address lpTokenAddress, uint256 lpTokenId) = IWeb3PacksExchangeManager(_web3PacksExchangeManager).getLiquidityTokenData(liquidityPosition);

      if (lpTokenId > 0) {
        // Grab LP NFT From Web3 Pack
        IChargedParticles(_chargedParticles).breakCovalentBond(
          _receiver,
          _proton,
          web3packsTokenId,
          _cpBasketManager,
          lpTokenAddress,
          lpTokenId,
          1
        );
      } else {
        // Grab Liquidity Tokens from Web3 Pack
        IChargedParticles(_chargedParticles).releaseParticle(
          _receiver,
          _proton,
          web3packsTokenId,
          _cpBasketManager,
          lpTokenAddress
        );
      }

      // Remove Liquidity
      if (sellAll || liquidityPair.exitLpOnUnbundle) {
        IWeb3PacksExchangeManager(_web3PacksExchangeManager).removeLiquidity(liquidityPosition, liquidityPair, receiver, sellAll);
      }

      // Clear Liquidity Position
      IWeb3PacksManager(_web3PacksManager).clearLiquidityPositions(web3packsTokenId);
    }
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

  function setWeb3PacksExchangeManager(address manager) external onlyOwner {
    require(manager != address(0), "Invalid address for exchange manager");
    _web3PacksExchangeManager = manager;
    emit Web3PacksExchangeManagerSet(manager);
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

  modifier onlyExchangeManager() {
    require(msg.sender == _web3PacksExchangeManager, "Web3Packs - Invalid Exchange Manager");
    _;
  }
}
