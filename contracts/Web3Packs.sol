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

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/ERC721Mintable.sol";
import "./lib/BlackholePrevention.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";


contract Web3Packs is
  IWeb3Packs,
  Ownable,
  Pausable,
  ReentrancyGuard,
  BlackholePrevention
{
  // @TODO: Remove hardcoded variables
  address internal _proton = 0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC;
  address internal _router = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
  address internal _nonfungiblePositionManager = 0xC36442b4a4522E871399CD717aBDD847Ab11FE88;
  address internal _chargedParticles = 0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  // Custom Errors
  error FundingFailed();
  error NullReceiver();

  constructor(){}


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundle(
    address payable receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrder[] calldata erc20SwapOrders,
    ERC721MintOrders[] calldata erc721MintOrders,
    uint256 fundingAmount
  )
    external
    whenNotPaused
    nonReentrant
    payable
    returns(uint256 tokenId)
  {
    if (receiver == address(0x0))
      revert NullReceiver();

    uint256[] memory realAmounts = _swap(erc20SwapOrders);
    // mint liquidity position

    tokenId = _bundle(
      receiver,
      tokenMetaUri,
      erc20SwapOrders,
      erc721MintOrders,
      realAmounts
    );
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

  function depositLiquidity(
    address token0,
    address token1,
    uint256 amount0ToMint,
    uint256 amount1ToMint,
    uint24 poolFee
  )
    external
    returns (uint256) 
  {
    return _depositLiquidity(
      token0,
      token1,
      amount0ToMint,
      amount1ToMint,
      poolFee
    );
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
    tokenMetadataUri,
    basketManagerId,
    nftTokenAddress,
    mintedTokenId
  );
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
    string memory tokenMetadataUri,
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

  function _bundle(
    address receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrder[] calldata erc20SwapOrders,
    ERC721MintOrders[] calldata erc721MintOrders,
    uint256[] memory realAmounts
  )
    internal
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

    for (uint256 i; i < erc721MintOrders.length; i++) {
      uint256 mintedTokenId = _createBasicProton(
        erc721MintOrders[i].erc721TokenAddress,
        erc721MintOrders[i].tokenMetadataUri
      );

      _bond(
        _proton,
        tokenId,
        erc721MintOrders[i].tokenMetadataUri,
        erc721MintOrders[i].basketManagerId,
        erc721MintOrders[i].erc721TokenAddress,
        mintedTokenId
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
      (bool sent, bytes memory data) = receiver.call{value: fundingAmount}("");
      if (!sent) {
        revert FundingFailed();
      }
    }
  }

  function _depositLiquidity(
    address token0,
    address token1,
    uint256 amount0ToMint,
    uint256 amount1ToMint,
    uint24 poolFee
  )
   private
   returns (uint256 tokenId)
  {
    TransferHelper.safeApprove(token0, address(_nonfungiblePositionManager), amount0ToMint);
    TransferHelper.safeApprove(token1, address(_nonfungiblePositionManager), amount1ToMint);

    int256 tickSpace = 10; // TODO: Remove hardcoded value
    int24 tickLower = int24(_findNearestValidTick(tickSpace, true));
    int24 tickUpper = int24(_findNearestValidTick(tickSpace, false));

    // TODO: Remove log
    console.log("Lower",uint24(tickLower), uint24(tickLower % 10), uint24(tickUpper %10));

    INonfungiblePositionManager.MintParams memory params = 
      INonfungiblePositionManager.MintParams({
        token0: token0,
        token1: token1,
        fee: poolFee,
        tickLower: tickLower,
        tickUpper: tickUpper,
        amount0Desired: amount0ToMint,
        amount1Desired: amount1ToMint,
        amount0Min: 0,
        amount1Min: 0,
        recipient: address(this),
        deadline: block.timestamp
      });

      (tokenId, , , ) = INonfungiblePositionManager(
        _nonfungiblePositionManager
      ).mint(params);
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

  function onERC721Received(
      address,
      address,
      uint256,
      bytes calldata
  ) external pure returns(bytes4) {
      return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
  }

/**
 * @dev Finds the nearest valid tick to either MIN_TICK or MAX_TICK based on the tickSpacing.
 * This function accounts for edge cases to ensure the returned tick is within valid range.
 * @param tickSpacing The spacing between valid ticks, must be a positive integer.
 * @param nearestToMin If true, finds the nearest valid tick greater than or equal to MIN_TICK.
 *                     If false, finds the nearest valid tick less than or equal to MAX_TICK.
 * @return The nearest valid tick as an integer, ensuring it falls
   within the valid tick range.
 */
  function _findNearestValidTick(int256 tickSpacing, bool nearestToMin) public pure returns (int256) {
    require(tickSpacing > 0, "Tick spacing must be positive");
    int256 MIN_TICK = -887272;
    int256 MAX_TICK = -MIN_TICK;

    if (nearestToMin) {
        // Adjust to find a tick greater than or equal to MIN_TICK.
        int256 adjustedMinTick = MIN_TICK + (tickSpacing - 1);
        // Prevent potential overflow.
        if (MIN_TICK < 0 && adjustedMinTick > 0) {
            adjustedMinTick = MIN_TICK;
        }
        int256 adjustedTick = (adjustedMinTick / tickSpacing) * tickSpacing;
        // Ensure the adjusted tick does not fall below MIN_TICK.
        return (adjustedTick > MIN_TICK) ? adjustedTick - tickSpacing : adjustedTick;
    } else {
        // Find the nearest valid tick less than or equal to MAX_TICK, straightforward due to floor division.
        return (MAX_TICK / tickSpacing) * tickSpacing;
    }
  }

}