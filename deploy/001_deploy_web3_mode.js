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
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',
    Proton: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
    NonfungibleTokenPositionDescriptor: '0x2e8614625226D26180aDf6530C3b1677d3D7cf10',
    kimRouter: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
    VelodromeRouter: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
  },
};

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy } = deployments;
  const { deployer, protocolOwner, user1 } = await getNamedAccounts();
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
  log('  - Owner:    ', protocolOwner);
  log('  - User1:    ', user1);
  log(' ');

  //
  // Deploy Contracts
  //
  log('  Deploying Web3PacksMode...');

  const constructorArgs = [
    _ADDRESS[chainId].Proton,
    _ADDRESS[chainId].NonfungibleTokenPositionDescriptor,
    _ADDRESS[chainId].ChargedParticles,
    _ADDRESS[chainId].ChargedState,
    _ADDRESS[chainId].kimRouter,
    _ADDRESS[chainId].VelodromeRouter
  ];
  await deploy('Web3PacksMode', {
    from: deployer,
    args: constructorArgs,
    log: true,
  });

  if (!isHardhat()) {
    await verifyContract('Web3PacksMode', await ethers.getContract('Web3PacksMode'), constructorArgs);
  }

  const web3packs = await ethers.getContract('Web3PacksMode');
  let tx = await web3packs.setProtocolFee(globals.protocolFee);
  await tx.wait();

  tx = await web3packs.setContractAllowlist(globals.wrapETHAddress, true);
  await tx.wait();
};

module.exports.tags = ['mode_packs']
