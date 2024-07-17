const { getDeployData } = require('../js-helpers/deploy');
const { executeTx } = require('../js-helpers/executeTx');
const {
  log,
  chainNameById,
} = require('../js-helpers/utils');

const _ = require('lodash');

const _ADDRESS = {
  // Ethereum
  1: {
    ChargedParticles: '0xaB1a1410EA40930755C1330Cc0fB3367897C8c41',
    ChargedState: '0x48974C6ae5A0A25565b0096cE3c81395f604140f',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0x04d572734006788B646ce35b133Bdf7160f79995',
  },
  // Polygon
  137: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
  },
  // Hardhat
  31337: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0xaB1a1410EA40930755C1330Cc0fB3367897C8c41',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
  },
  34443: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',
    UniswapRouter: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
    Proton: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
  },
};

module.exports = async (hre) => {
    const { ethers, getNamedAccounts } = hre;
    const { deployer, protocolOwner, user2 } = await getNamedAccounts();
    const chainId = hre.network.config.chainId;

    // const chainId = chainIdByName(network.name);

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    log('Charged Particles - Web3 Packs - Contract Deployment');
    log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

    log(`  Using Network: ${chainNameById(chainId)} (${hre.network.name}:${chainId})`);
    log('  Using Accounts:');
    log('  - Deployer: ', deployer);
    log('  - Owner:    ', protocolOwner);
    log('  - User2:    ', user2);
    log(' ');


    const ddWeb3Packs = getDeployData('Web3Packs', chainId);
    log('  Loading Web3Packs from:     ', ddWeb3Packs.address);
    const web3Packs = await ethers.getContract('Web3Packs', deployer);

    //
    // Prepare Contracts
    //
    await executeTx('1-a', 'Web3Packs: Setting ChargedParticles', async () =>
      await web3Packs.setChargedParticles(_ADDRESS[chainId].ChargedParticles)
    );

    await executeTx('1-c', 'Web3Packs: Setting Uniswap Router', async () =>
      await web3Packs.setRouter(_ADDRESS[chainId].UniswapRouter)
    );

    await executeTx('1-e', 'Web3Packs: Set proton address ', async () =>
      await web3Packs.setProton(_ADDRESS[chainId].Proton)
    );

    await executeTx('1-e', 'Web3Packs: Set proton address ', async () =>
      await web3Packs.setChargedState(_ADDRESS[chainId].chargedState)
    );

    // await executeTx('1-d', 'Web3Packs: Transfer Contract Ownership', async () =>
    //   await web3Packs.transferOwnership(protocolOwner)
    // );

    log('\n  Contract Deployment Data saved to "deployments" directory.');
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['setup']
