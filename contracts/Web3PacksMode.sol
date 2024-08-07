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
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "./lib/ERC721Mintable.sol";
import "./lib/BlackholePrevention.sol";
import "./lib/AllowList.sol";
import "./interfaces/IWeb3Packs.sol";
import "./interfaces/IChargedState.sol";
import "./interfaces/INonfungiblePositionManager.sol";
import "./interfaces/IChargedParticles.sol";
import "./interfaces/IBaseProton.sol";

struct MintParams {
  address token0;
  address token1;
  int24 tickLower;
  int24 tickUpper;
  uint256 amount0Desired;
  uint256 amount1Desired;
  uint256 amount0Min;
  uint256 amount1Min;
  address recipient;
  uint256 deadline;
}

struct MintResponse {
  uint256 tokenId;
  uint128 liquidity;
  uint256 amount0;
  uint256 amount1;
}

interface IKimNonfungiblePositionManager {
  function mint(
    MintParams calldata params
  )
    external
    payable
    returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface ERC20 {
  function balanceOf(address account) external view returns (uint256);
}

contract Web3PacksMode is
  IWeb3Packs,
  LibAllowList,
  Ownable,
  Pausable,
  ReentrancyGuard,
  BlackholePrevention
{
  address _proton;
  address _nonfungiblePositionManager;
  address _chargedParticles;
  address _chargedState;

  // Charged Particles Wallet Managers
  string internal _cpWalletManager = "generic.B";
  string internal _cpBasketManager = "generic.B";

  // Custom Errors
  error FundingFailed();
  error NullReceiver();

  constructor(
    address proton,
    address nonfungiblePositionManager,
    address chargedParticles,
    address chargedState
  ){
    _proton = proton;
    _nonfungiblePositionManager = nonfungiblePositionManager;
    _chargedParticles = chargedParticles;
    _chargedState = chargedState;
  }


  /***********************************|
  |               Public              |
  |__________________________________*/

  function bundleMode(
    address payable receiver,
    string calldata tokenMetaUri,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    LiquidityMintOrder[] calldata liquidityMintOrders,
    LockState calldata lockState
  )
    external
    whenNotPaused
    nonReentrant
    payable
    returns(uint256 tokenId)
  {
    if (receiver == address(0x0))
      revert NullReceiver();

    _swap(erc20SwapOrders);

    MintResponse[] memory liquidity = _depositLiquidity(liquidityMintOrders);

    tokenId = _bundle(
      address(this),
      tokenMetaUri,
      erc20SwapOrders,
      liquidity
    );

    _lock(lockState, tokenId);

    IBaseProton(_proton).safeTransferFrom(address(this), receiver, tokenId);
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
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders
  )
    external
    payable
    virtual
  {
    _swap(erc20SwapOrders);
  }

  function depositLiquidity(
    LiquidityMintOrder[] calldata liquidityMintOrders,
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders
  )
    external
    payable
    returns (MintResponse[] memory) 
  {
    _swap(erc20SwapOrders);
    return _depositLiquidity(liquidityMintOrders);
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
    TransferHelper.safeApprove(swapOrder.tokenIn, address(swapOrder.router), swapOrder.amountIn);

    // filter by address
    // filger by method
    (bool success, bytes memory res) = swapOrder.router.call{ value: msg.value }(
        swapOrder.callData
    ); 
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
    ERC20SwapOrderGeneric[] calldata erc20SwapOrders,
    MintResponse[] memory liquidity
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

    for (uint256 i; i < liquidity.length; i++) {
      // if mint response.type == v2 -> energize 
      // if mint response.type == v3 -> bond

      _bond(
        _proton,
        tokenId,
        _cpBasketManager,
        _nonfungiblePositionManager,
        liquidity[i].tokenId
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
      (bool sent, ) = receiver.call{value: fundingAmount}("");
      if (!sent) {
        revert FundingFailed();
      }
    }
  }

  function _depositLiquidity(
    LiquidityMintOrder[] calldata liquidityMintOrders
  )
   private
   returns (MintResponse[] memory)
  {
    MintResponse[] memory liquidityNfts = new MintResponse[](liquidityMintOrders.length);

    for (uint256 i; i < liquidityMintOrders.length; i++) {
      TransferHelper.safeApprove(
        liquidityMintOrders[i].token0,
        address(_nonfungiblePositionManager),
        liquidityMintOrders[i].amount0ToMint
      );

      TransferHelper.safeApprove(
        liquidityMintOrders[i].token1,
        address(_nonfungiblePositionManager),
        liquidityMintOrders[i].amount1ToMint
      );

      int24 tickLower = int24(_findNearestValidTick(liquidityMintOrders[i].tickSpace, true));
      int24 tickUpper = int24(_findNearestValidTick(liquidityMintOrders[i].tickSpace, false));

      MintParams memory params = 
        MintParams({
          token0: liquidityMintOrders[i].token0,
          token1: liquidityMintOrders[i].token1,
          tickLower: tickLower,
          tickUpper: tickUpper,
          amount0Desired: ERC20(liquidityMintOrders[i].token0).balanceOf(address(this)),
          amount1Desired: ERC20(liquidityMintOrders[i].token1).balanceOf(address(this)),
          amount0Min: liquidityMintOrders[i].amount0Min,
          amount1Min: liquidityMintOrders[i].amount1Min,
          recipient: address(this),
          deadline: block.timestamp
        });

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = IKimNonfungiblePositionManager(
          _nonfungiblePositionManager
        ).mint{ value: liquidityMintOrders[i].amount0ToMint }(params);

        liquidityNfts[i] = MintResponse(tokenId, liquidity, amount0, amount1);
      }

      return liquidityNfts;
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