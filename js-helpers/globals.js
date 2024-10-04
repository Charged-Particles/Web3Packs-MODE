const { utils } = require('ethers');

const globals = {
  erc20Abi : [
    'function transfer(address to, uint amount)',
    'function balanceOf(address account) public view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)'
  ],
  wethAbi : [
    'function deposit() public',
    'function withdraw(uint wad) public',
  ],

  // Charged Particles
  chargedStateContractAddress: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',

  // Proton NFT Address
  protonPolygon: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
  protonMode: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',

  // Token Addresses
  USDcContractAddress: '0xd988097fb8612cc24eeC14542bC03424c656005f',
  USDtContractAddress:  '0xf0F161fDA2712DB8b566946122a5af183995e2eD',
  UniContractAddress: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
  DAIContractAddress: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
  wrapMaticContractAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  wrapETHAddress: '0x4200000000000000000000000000000000000006',
  modeTokenAddress: '0xDfc7C877a950e49D2610114102175A06C2e3167a',
  ionTokenAddress: '0x18470019bF0E94611f15852F7e93cf5D65BC34CA',
  iclTokenAddress: '0x95177295A394f2b9B04545FFf58f4aF0673E839d',
  ionxTokenAddress: '0x77E7bcfeE826b12cD498Faa9831d7055b7478272',

  // IPFS
  ipfsMetadata: 'Qmao3Rmq9m38JVV8kuQjnL3hF84cneyt5VQETirTH1VUST',

  // Velodrome Router
  velodromeRouter: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
  velodromeRouterAbi: [
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address,address,bool)[] calldata routes, address to, uint256 deadline) external returns (uint256[] memory amounts)',
    'function swapExactETHForTokens(uint256 amountOutMin, (address,address,bool)[] routes, address to, uint256 deadline) payable returns (uint256[] memory amounts)',
    'function addLiquidity(address tokenA, address tokenB, bool stable, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) public returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
    'function removeLiquidity(address tokenA, address tokenB, bool stable, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) public returns (uint256 amountA, uint256 amountB)',
  ],

  // Kim Router
  kimRouterMode: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
  KimNonfungibleTokenPosition: '0x2e8614625226D26180aDf6530C3b1677d3D7cf10',

  // Balancer (Router is Vault)
  balancerPools: {
    MODE_WETH_LP: {
      vault: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
      poolId: '0x7c86a44778c52a0aad17860924b53bf3f35dc932000200000000000000000007',
    },
    MODE: {
      vault: '',
      poolId: '',
    },
    IONX: {
      vault: '',
      poolId: '',
    },
  },

  // Standard Parameters
  deadline: Math.floor(Date.now() / 1000) + (60 * 10),
  protocolFee: utils.parseUnits('0.0003', 18),

  // Random Addresses
  testAddress: '0x277BFc4a8dc79a9F194AD4a83468484046FAFD3A',
  USDcWhale: '0xfa0b641678f5115ad8a8de5752016bd1359681b9',
};

module.exports = globals;