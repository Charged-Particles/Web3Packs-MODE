// SPDX-License-Identifier: MIT

// BlackholePrevention.sol -- Part of the Charged Particles Protocol
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
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";
import "./lib/BlackholePrevention.sol";

contract Web3Packs is
  IWeb3Packs,
  ERC721,
  Ownable,
  Pausable,
  ReentrancyGuard,
  BlackholePrevention
{
  using Counters for Counters.Counter;

  Counters.Counter internal _tokenIdCounter;

  // Polygon Mainnet
  address internal _proton = 0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC;
  address internal _router = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  address internal _chargedState = 0xaB1a1410EA40930755C1330Cc0fB3367897C8c41;
  address internal _chargedParticles = 0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  constructor() ERC721("Web3Packs", "W3P") {}


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    address receiver,
    ERC20SwapOrder[] calldata erc20SwapOrders
  )
    external
    whenNotPaused
    nonReentrant
    returns(uint256 tokenId)
  {
    uint256[] memory realAmounts = _swap(erc20SwapOrders);
    tokenId = _bundle(receiver, erc20SwapOrders, realAmounts);
    emit PackBundled(tokenId, receiver);
  }

  function unbundle(
    address receiver,
    uint256 tokenId,
    Web3PackOrder calldata web3PackOrder
  )
    external
    whenNotPaused
    nonReentrant
  {
    require(isApprovedForAll(ownerOf(tokenId), _msgSender()), "Not owner or operator");
    _unbundle(receiver, tokenId, _cpWalletManager, _cpBasketManager, web3PackOrder);
    emit PackUnbundled(tokenId, receiver);
  }

  function unbundleFromManager(
    address receiver,
    uint256 tokenId,
    string memory walletManager,
    string memory basketManager,
    Web3PackOrder calldata web3PackOrder
  )
    external
    whenNotPaused
    nonReentrant
  {
    require(isApprovedForAll(ownerOf(tokenId), _msgSender()), "Not owner or operator");
    _unbundle(receiver, tokenId, walletManager, basketManager, web3PackOrder);
    emit PackUnbundled(tokenId, receiver);
  }

  function swap(
    ERC20SwapOrder[] calldata erc20SwapOrders
  )
    external
    virtual
    returns (uint256[] memory)
  {
    return _swap(erc20SwapOrders);
  }

  /***********************************|
  |          Only Admin/DAO           |
  |__________________________________*/

  /**
    * @dev Setup the ChargedParticles Interface
    */
  function setChargedParticles(address chargedParticles) external onlyOwner {
    emit ChargedParticlesSet(chargedParticles);
    _chargedParticles = chargedParticles;
  }

  /// @dev Setup the Charged-State Controller
  function setChargedState(address stateController) external onlyOwner {
    _chargedState = stateController;
    emit ChargedStateSet(stateController);
  }

  /// @dev Setup the Uniswap Router
  function setUniswapRouter(address router) external onlyOwner {
    _router = router;
    emit UniswapRouterSet(router);
  }

  function setProton(address proton) external onlyOwner {
    _proton = proton;
    emit ProtonSet(proton);
  }

  /// @dev Pre-approve ChargedParticles to pull Assets from this contract for bundling
  function preApproveAsset(address assetAddress) external onlyOwner {
    IERC20(assetAddress).approve(_chargedParticles, type(uint256).max);
  }

  /// @dev Pre-approve ChargedParticles to pull NFTs from this contract for bundling
  function preApproveNft(address nftAddress) external onlyOwner {
    IERC721(nftAddress).setApprovalForAll(_chargedParticles, true);
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


  /***********************************|
  |         Private Functions         |
  |__________________________________*/

  function _swap(
    ERC20SwapOrder[] calldata erc20SwapOrders
  )
    internal
    virtual
    returns (uint256[] memory)
  {
    uint256[] memory amountsOut = new uint256[](erc20SwapOrders.length);
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      amountsOut[i] = _singleSwap(
        erc20SwapOrders[i].inputTokenAddress,
        erc20SwapOrders[i].outputTokenAddress,
        erc20SwapOrders[i].inputTokenAmount
      );
    }
    return amountsOut;
  }

  function _singleSwap(
    address inputTokenAddress,
    address outputTokenAddress,
    uint256 inputTokenAmount
  ) internal returns (uint256 amountOut) {
    // Approve the router to spend DAI.
    TransferHelper.safeApprove(inputTokenAddress, address(_router), inputTokenAmount);

    ISwapRouter.ExactInputSingleParams memory params =
      ISwapRouter.ExactInputSingleParams({
        tokenIn: inputTokenAddress,
        tokenOut: outputTokenAddress,
        fee: 3000,
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: inputTokenAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });
      // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
      amountOut = ISwapRouter(_router).exactInputSingle(params);
  }

  function _bundle(
    address receiver,
    ERC20SwapOrder[] calldata erc20SwapOrders,
    uint256[] memory realAmounts
  )
    internal
    virtual
    returns (uint256 tokenId)
  {
    address self = address(this);
    IChargedParticles chargedParticles = IChargedParticles(_chargedParticles);

    // Mint Web3Pack NFT to Receiver
    tokenId = IBaseProton(_proton).createBasicProton(self, receiver, "test.com");

    // Bundle Assets into NFT
    for (uint256 i; i < erc20SwapOrders.length; i++) {
      TransferHelper.safeApprove(
        erc20SwapOrders[i].outputTokenAddress, 
        address(_chargedParticles), 
        realAmounts[i]
      );

      chargedParticles.energizeParticle(
        _proton,
        tokenId,
        _cpWalletManager,
        erc20SwapOrders[i].outputTokenAddress,
        realAmounts[i],
        self
      );
    }
  }

  function _unbundle(
    address receiver,
    uint256 tokenId,
    string memory walletManager,
    string memory basketManager,
    Web3PackOrder calldata web3PackOrder
  )
    internal
  {
    address self = address(this);
    for (uint256 i; i < web3PackOrder.erc20TokenAddresses.length; i++) {
      IChargedParticles(_chargedParticles).releaseParticle(
        receiver,
        self,
        tokenId,
        walletManager,
        web3PackOrder.erc20TokenAddresses[i]
      );
    }

    for (uint256 i; i < web3PackOrder.erc721TokenAddresses.length; i++) {
      IChargedParticles(_chargedParticles).breakCovalentBond(
        receiver,
        self,
        tokenId,
        basketManager,
        web3PackOrder.erc721TokenAddresses[i],
        web3PackOrder.erc721TokenIds[i],
        1
      );
    }
  }
}
