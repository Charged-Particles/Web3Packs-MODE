// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";


contract ERC721Mintable is ERC721, ERC721URIStorage  {
  using Counters for Counters.Counter;

  Counters.Counter private _tokenIdCounter;

  constructor() ERC721("MyTestToken", "MTK") ERC721URIStorage() {}

  function mint(address to)
    public
    returns (uint256 tokenId)
  {
    tokenId = _tokenIdCounter.current();
    _tokenIdCounter.increment();
    _mint(to, tokenId);
  }

  function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
  {
    return super.tokenURI(tokenId);
  }

  function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
      super._burn(tokenId);
  }

  function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
    return super.supportsInterface(interfaceId);
  }

}
