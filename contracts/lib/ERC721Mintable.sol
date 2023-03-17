// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721Mintable is ERC721  {
  using Counters for Counters.Counter;

  Counters.Counter private _tokenIdCounter;

  constructor() ERC721("MyTestToken", "MTK") {}

  function mint(address to)
    public
    returns (uint256 tokenId)
  {
    tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _mint(to, tokenId);
  }
}
