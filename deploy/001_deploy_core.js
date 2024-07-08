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
