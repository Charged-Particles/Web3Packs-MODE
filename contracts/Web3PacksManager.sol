// SPDX-License-Identifier: MIT

// Web3PacksManager.sol
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

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./lib/BlackholePrevention.sol";
import "./interfaces/IWeb3PacksManager.sol";
import "./interfaces/IWeb3PacksManagerOld.sol";
import { IWeb3PacksDefs } from "./interfaces/IWeb3PacksDefs.sol";

contract Web3PacksManager is
  IWeb3PacksManager,
  Ownable,
  BlackholePrevention
{
  mapping (address => bool) internal _web3packsContracts;
  mapping (address => bool) internal _allowlistedContracts;
  mapping (uint256 => LiquidityPosition[]) internal _liquidityPositions;

  constructor() {}

  /***********************************|
  |               Public              |
  |__________________________________*/

  function isContractAllowed(address contractAddress) external view returns (bool isAllowed) {
    isAllowed = _allowlistedContracts[contractAddress];
  }

  function isWeb3PacksAllowed(address contractAddress) external view returns (bool isAllowed) {
    isAllowed = _web3packsContracts[contractAddress];
  }

  function getLiquidityPositions(uint256 tokenId) external view returns (LiquidityPosition[] memory positions) {
    positions = _liquidityPositions[tokenId];
  }

  function saveLiquidityPosition(uint256 tokenId, LiquidityPosition memory position) external onlyWeb3PacksOrOwner(msg.sender) {
    _liquidityPositions[tokenId].push(position);
  }

  function clearLiquidityPositions(uint256 tokenId) external onlyWeb3PacksOrOwner(msg.sender) {
    delete _liquidityPositions[tokenId];
  }

  function setContractAllowlist(address contractAddress, bool isAllowed) external onlyWeb3PacksOrOwner(msg.sender) {
    _allowlistedContracts[contractAddress] = isAllowed;
  }

  function setWeb3PacksContract(address contractAddress, bool isAllowed) external onlyOwner {
    _web3packsContracts[contractAddress] = isAllowed;
  }

  function migrateFromOldManager(address oldManagerAddress, uint256 tokenId, address uniswapV3Router) external onlyOwner {
    IWeb3PacksManagerOld oldMgr = IWeb3PacksManagerOld(oldManagerAddress);
    IWeb3PacksManagerOld.LiquidityPosition[] memory positions = oldMgr.getLiquidityPositions(tokenId);
    delete _liquidityPositions[tokenId];

    for (uint256 i; i < positions.length; i++) {
      IWeb3PacksManager.LiquidityPosition memory position = LiquidityPosition({
        lpTokenId: positions[i].lpTokenId,
        liquidity: positions[i].liquidity,
        stable: positions[i].stable,
        token0: positions[i].token0,
        token1: positions[i].token1,
        tickLower: positions[i].tickLower,
        tickUpper: positions[i].tickUpper,
        poolId: positions[i].poolId,
        router: positions[i].router,
        routerType: RouterType(uint(positions[i].routerType))
      });
      if (position.routerType == IWeb3PacksDefs.RouterType.UniswapV3) {
        position.router = uniswapV3Router;
      }
      _liquidityPositions[tokenId].push(position);
    }
  }

  modifier onlyWeb3PacksOrOwner(address sender) {
    require(owner() == sender || _web3packsContracts[sender], "Web3PacksManager - Invalid caller");
    _;
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
}
