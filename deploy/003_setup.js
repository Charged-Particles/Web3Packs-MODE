const  { chargedSettingsAbi } = require ('@charged-particles/charged-js-sdk');
const { getDeployData } = require('../js-helpers/deploy');
const { executeTx } = require('../js-helpers/executeTx');
const {
  log,
  toWei,
  chainNameById,
  chainIdByName,
} = require('../js-helpers/utils');

const _ = require('lodash');

const _ADDRESS = {
  137: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    ChargedSettings: '0xdc29C7014d104432B15eD2334e654fCBf3d5E528',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
  },
  31337: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    ChargedSettings: '0xdc29C7014d104432B15eD2334e654fCBf3d5E528',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
  },
  80001: {
    ChargedParticles: '0x51f845af34c60499a1056FCDf47BcBC681A0fA39',
    ChargedState: '0x581c57b86fC8c2D639f88276478324cE1380979D',
    ChargedSettings: '0x60428D3e580907C74Ee8690E4E192317864aAE1d',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    Proton: '0xC5b2d04669b6B701195F90c15C560edaa3509C92',
  },
};

module.exports = async (hre) => {
    const { ethers, getNamedAccounts } = hre;
    const { deployer, protocolOwner, user2 } = await getNamedAccounts();
    const network = await hre.network;

    const chainId = chainIdByName(network.name);

    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
    log('Charged Particles - Web3 Packs - Contract Deployment');
    log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

    log(`  Using Network: ${chainNameById(chainId)} (${network.name}:${chainId})`);
    log('  Using Accounts:');
    log('  - Deployer: ', deployer);
    log('  - Owner:    ', protocolOwner);
    log('  - User2:    ', user2);
    log(' ');


    const ddWeb3Packs = getDeployData('Web3Packs', chainId);
    log('  Loading Web3Packs from:     ', ddWeb3Packs.address);
    const web3Packs = await ethers.getContract('Web3Packs', deployer);
    // const Web3Packs = await ethers.getContractFactory('Web3Packs');
    // const web3Packs = await Web3Packs.attach(ddWeb3Packs.address);

    const ddChargedSettings = { address: _ADDRESS[chainId].ChargedSettings };
    log('  Loading ChargedSettings from: ', ddChargedSettings.address);
    
    //
    // Prepare Contracts
    //
    await executeTx('1-a', 'Web3Packs: Setting ChargedParticles', async () =>
      await web3Packs.setChargedParticles(_ADDRESS[chainId].ChargedParticles)
    );

    await executeTx('1-b', 'Web3Packs: Setting ChargedState', async () =>
      await web3Packs.setChargedState(_ADDRESS[chainId].ChargedState)
    );

    await executeTx('1-c', 'Web3Packs: Setting Uniswap Router', async () =>
      await web3Packs.setUniswapRouter(_ADDRESS[chainId].UniswapRouter)
    );

    await executeTx('1-e', 'Web3Packs: Set proton address ', async () =>
      await web3Packs.setProton(_ADDRESS[chainId].Proton)
    );

    await executeTx('1-d', 'Web3Packs: Transfer Contract Ownership', async () =>
      await web3Packs.transferOwnership(protocolOwner)
    );

    log('\n  Contract Deployment Data saved to "deployments" directory.');
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['Web3packs']
