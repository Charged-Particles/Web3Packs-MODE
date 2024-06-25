const {
  saveDeploymentData,
  getContractAbi,
  getTxGasCost,
} = require('../js-helpers/deploy');

const {
  executeTx,
  getAccumulatedGasCost,
} = require('../js-helpers/executeTx');

const {
  log,
  chainNameById,
  chainIdByName,
} = require('../js-helpers/utils');

const _ = require('lodash');

const _ADDRESS = {
  // Ethereum
  1: {
    ChargedParticles: '',
    ChargedState: '',
    UniswapRouter: '',
  },
  5: {
    ChargedParticles: '',
    ChargedState: '',
    UniswapRouter: '',
  },
  // Polygon
  137: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  80001: {
    ChargedParticles: '0x51f845af34c60499a1056FCDf47BcBC681A0fA39',
    ChargedState: '0x581c57b86fC8c2D639f88276478324cE1380979D',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
};

module.exports = async (hre) => {
    const { ethers, getNamedAccounts, deployments } = hre;
    const { deploy } = deployments;
    const { deployer, protocolOwner, user1 } = await getNamedAccounts();
    const network = await hre.network;
    const deployData = {};
    const chainId = chainIdByName(network.name);

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    log('Charged Particles - Web3 Packs - Contract Deployment');
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

    log('  Deploying Web3Packs...');

    await deploy('Web3Packs', {
      from: deployer,
      args: [],
      log: true,
    });
};

module.exports.tags = ['core']
