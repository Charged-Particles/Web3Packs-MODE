const {
  log,
  chainNameById,
  chainIdByName,
} = require('../js-helpers/utils');

const { verifyContract } = require('../js-helpers/verifyContract');

const _ = require('lodash');
const globals = require('../js-helpers/globals');

const _ADDRESS = {
  // Polygon
  137: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    Proton: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
    NonfungibleTokenPositionDescriptor: '0x91ae842A5Ffd8d12023116943e72A606179294f3',
  },
  // mode
  34443: {
    Weth: '0x4200000000000000000000000000000000000006',
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',
    Proton: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
    NonfungibleTokenPositionDescriptor: '0x2e8614625226D26180aDf6530C3b1677d3D7cf10',
    kimRouter: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
    VelodromeRouter: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
    BalancerRouter: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  },
};

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy } = deployments;
  const { deployer, treasury, user1 } = await getNamedAccounts();
  const network = await hre.network;
  const chainId = chainIdByName(network.name);

  const isHardhat = () => {
    const isForked = network?.config?.forking?.enabled ?? false;
    return isForked || network?.name === 'hardhat';
  };

  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  log('Charged Particles - Web3 Packs MODE - Contract Deployment');
  log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  log(`  Using Network: ${chainNameById(chainId)} (${network.name}:${chainId})`);
  log('  Using Accounts:');
  log('  - Deployer: ', deployer);
  log('  - Treaury:  ', treasury);
  log('  - User1:    ', user1);
  log(' ');

  //
  // Deploy Contracts
  //
  log('  Deploying Web3PacksMode...');
  const constructorArgs = [
    _ADDRESS[chainId].Weth,
    _ADDRESS[chainId].Proton,
    _ADDRESS[chainId].NonfungibleTokenPositionDescriptor,
    _ADDRESS[chainId].ChargedParticles,
    _ADDRESS[chainId].ChargedState
  ];
  await deploy('Web3PacksMode', {
    from: deployer,
    args: constructorArgs,
    log: true,
  });

  if (!isHardhat()) {
    await verifyContract('Web3PacksMode', await ethers.getContract('Web3PacksMode'), constructorArgs);
  }

  log('  Deploying Web3PacksManager...');
  await deploy('Web3PacksManager', {
    from: deployer,
    args: [],
    log: true,
  });

  if (!isHardhat()) {
    await verifyContract('Web3PacksManager', await ethers.getContract('Web3PacksManager'), []);
  }

  // Get Deployed Contracts
  const web3packs = await ethers.getContract('Web3PacksMode');
  const web3packsManager = await ethers.getContract('Web3PacksManager');

  // Set Web3Packs and Manager Contracts
  log(`  Setting Web3PacksManager Address in Web3Packs: ${web3packsManager.address}`);
  await web3packs.setWeb3PacksManager(web3packsManager.address);

  log(`  Setting Web3Packs Address in Web3PacksManager: ${web3packs.address}`);
  await web3packsManager.setWeb3PacksContract(web3packs.address, true);

  // Set Allowlisted Contracts
  log(`  Setting Allowlisted Contract (WETH) in Web3PacksManager: ${_ADDRESS[chainId].Weth}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].Weth, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (Proton) in Web3PacksManager: ${_ADDRESS[chainId].Proton}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].Proton, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (NFTPD) in Web3PacksManager: ${_ADDRESS[chainId].NonfungibleTokenPositionDescriptor}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].NonfungibleTokenPositionDescriptor, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (ChargedParticles) in Web3PacksManager: ${_ADDRESS[chainId].ChargedParticles}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].ChargedParticles, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (ChargedState) in Web3PacksManager: ${_ADDRESS[chainId].ChargedState}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].ChargedState, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (kimRouter) in Web3PacksManager: ${_ADDRESS[chainId].kimRouter}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].kimRouter, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (VelodromeRouter) in Web3PacksManager: ${_ADDRESS[chainId].VelodromeRouter}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].VelodromeRouter, true).then(tx => tx.wait());

  log(`  Setting Allowlisted Contract (Balancer) in Web3PacksManager: ${_ADDRESS[chainId].BalancerRouter}`);
  await web3packsManager.setContractAllowlist(_ADDRESS[chainId].BalancerRouter, true).then(tx => tx.wait());

  // Set Protocol Fees
  log(`  Setting Protocol Fee in Web3Packs: ${globals.protocolFee}`);
  await web3packs.setProtocolFee(globals.protocolFee).then(tx => tx.wait());

  // Set Protocol Treasury
  log(`  Setting Protocol Treasury in Web3Packs: ${treasury}`);
  await web3packs.setTreasury(treasury).then(tx => tx.wait());
};

module.exports.tags = ['mode_packs']
