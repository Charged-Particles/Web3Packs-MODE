
export default {
    erc20Abi : [
      'function transfer(address to, uint amount)',
      'function balanceOf(address account) public view returns (uint256)',
      'function approve(address spender, uint256 amount) external returns (bool)'
    ],
    USDcContractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDtContractAddress:  '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    UniContractAddress: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    DAIContractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    protonPolygon: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
    protonMode: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
    wrapMaticContractAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    testAddress: '0x277BFc4a8dc79a9F194AD4a83468484046FAFD3A',
    USDcWhale: '0xfa0b641678f5115ad8a8de5752016bd1359681b9',
    ipfsMetadata: 'Qmao3Rmq9m38JVV8kuQjnL3hF84cneyt5VQETirTH1VUST',
    wrapETHAddress: '0x4200000000000000000000000000000000000006',
    modeTokenAddress: '0xDfc7C877a950e49D2610114102175A06C2e3167a',
    chargedStateContractAddress: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',
    kimRouterMode: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
    KimNonfungibleTokenPosition: '0x2e8614625226D26180aDf6530C3b1677d3D7cf10',
    deadline: Math.floor(Date.now() / 1000) + (60 * 10),
}