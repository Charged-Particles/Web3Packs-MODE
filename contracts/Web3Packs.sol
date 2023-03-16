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
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";
import "./lib/BlackholePrevention.sol";
import "./lib/ERC721Mintable.sol";

contract Web3Packs is
  IWeb3Packs,
  Ownable,
  Pausable,
  ReentrancyGuard,
  IERC721Receiver,
  BlackholePrevention
{
  address internal _proton = 0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC;
  address internal _router = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  address internal _chargedState = 0xaB1a1410EA40930755C1330Cc0fB3367897C8c41;
  address internal _chargedParticles = 0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  constructor(){}


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    address payable receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrder[] calldata erc20SwapOrders,
    address[] calldata nftOrders,
    uint256 fundingAmount
  )
    external
    whenNotPaused
    nonReentrant
    payable
    returns(uint256 tokenId)
  {
    require(receiver != address(0x0), "Receiver is null");

    uint256[] memory realAmounts = _swap(erc20SwapOrders);
    
    tokenId = _bundle(receiver, tokenMetaUri, erc20SwapOrders, nftOrders,realAmounts);

    _fund(receiver, fundingAmount);

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
    string memory walletManager,
    Web3PackOrder calldata web3PackOrder
  )
    external
    whenNotPaused
    nonReentrant
  {
    _unbundle(receiver, tokenAddress,tokenId, walletManager, web3PackOrder);
    emit PackUnbundled(tokenId, receiver);
  }

  function swap(
    ERC20SwapOrder[] calldata erc20SwapOrders
  )
    external
    payable
    virtual
    returns (uint256[] memory)
  {
    return _swap(erc20SwapOrders);
  }

  function bond(
    address contractAddress,
    uint256 tokenId,
    string calldata basketManagerId,
    address nftTokenAddress,
  )
   external
  {
    this._bond(contractAddress, tokenId, basketManagerId, nftTokenAddress);
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
        erc20SwapOrders[i]
      );
    }
    return amountsOut;
  }

  function _singleSwap(
    ERC20SwapOrder calldata erc20SwapOrder
  )
   internal
   returns (uint256 amountOut)
  {
    // Approve the router to spend ERC20.
    TransferHelper.safeApprove(erc20SwapOrder.inputTokenAddress, address(_router), erc20SwapOrder.inputTokenAmount);

    ISwapRouter.ExactInputSingleParams memory params =
      ISwapRouter.ExactInputSingleParams({
        tokenIn: erc20SwapOrder.inputTokenAddress,
        tokenOut: erc20SwapOrder.outputTokenAddress,
        fee: erc20SwapOrder.uniSwapPoolFee,
        recipient: address(this),
        deadline: erc20SwapOrder.deadline,
        amountIn: erc20SwapOrder.inputTokenAmount,
        amountOutMinimum: erc20SwapOrder.amountOutMinimum,
        sqrtPriceLimitX96: erc20SwapOrder.sqrtPriceLimitX96
      });

    // Executes the swap returning the amountIn needed to spend to receive the desired amountOut.
    uint256 amountIn = (msg.value > 0 ? erc20SwapOrder.inputTokenAmount : 0);

    amountOut = ISwapRouter(_router).exactInputSingle{value: amountIn }(params);
  }

  function _bond(
    address contractAddress,
    uint256 tokenId,
    string calldata basketManagerId,
    address nftTokenAddress,
  ) 
    internal
  {
    // mint 
    uint256 nftTokenId = ERC721Mintable(nftTokenAddress).mint(address(this));

    IChargedParticles chargedParticles = IChargedParticles(_chargedParticles);
    chargedParticles.covalentBond(
      contractAddress,
      tokenId,
      basketManagerId,
      nftTokenAddress,
      nftTokenId,
      1
    );
  }  

  function _bundle(
    address receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrder[] calldata erc20SwapOrders,
    address[] calldata nftOrders,
    uint256[] memory realAmounts
  )
    internal
    virtual
    returns (uint256 tokenId)
  {
    address self = address(this);
    IChargedParticles chargedParticles = IChargedParticles(_chargedParticles);

    // Mint Web3Pack NFT to Receiver
    tokenId = IBaseProton(_proton).createBasicProton(self, receiver, tokenMetaUri);

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

    for (uint256 i; i < nftOrders.length; i++) {
      this._bond(
        _proton,
        tokenId,
        "generic.B",
        nftOrders[i],
      );
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
  }

  function _fund(address payable receiver, uint256 fundigAmount) private{
    if (address(this).balance >= fundigAmount) {
      (bool sent, bytes memory data) = receiver.call{value: fundigAmount}("");
      require(sent, "Failed to send Ether");
    }
  }
}