// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract MyToken is ERC721, Ownable {
  using Counters for Counters.Counter;

  Counters.Counter private _tokenIdCounter;

  constructor() ERC721("MyTestToken", "MTK") {}

  function mint(address to)
    public
    onlyOwner
    returns (uint256 tokenId)
  {
    tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _mint(to, tokenId);
  }
}
