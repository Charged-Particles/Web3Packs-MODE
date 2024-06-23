
export default {
    erc20Abi : [
    "function transfer(address to, uint amount)",
    "function balanceOf(address account) public view virtual override returns (uint256)"
    ],
    USDcContractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDtContractAddress:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    UniContractAddress: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    wrapMaticContractAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    testAddress: '0x277BFc4a8dc79a9F194AD4a83468484046FAFD3A',
    USDcWhale: '0xfa0b641678f5115ad8a8de5752016bd1359681b9',
    ipfsMetadata: 'Qmao3Rmq9m38JVV8kuQjnL3hF84cneyt5VQETirTH1VUST',
    deadline:  Math.floor(Date.now() / 1000) + (60 * 10),
}