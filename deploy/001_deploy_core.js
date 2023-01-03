// module.exports = async function (hre) {
//     const {deployments, getNamedAccounts } = hre;
//     const {deploy} = deployments;

//     const {deployer} = await getNamedAccounts();
//     // const chainId = network.config.chainId

//     await deploy('Web3Packs', {
//       from: deployer,
//       args: [
//         '0x3A9891279481bB968a8d1300C40d9279111f1CDA'
//       ],
//       log: true,
//     });
//   };

//   module.exports.tags = ['core'];


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
    const { ethers, getNamedAccounts } = hre;
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
    const Web3Packs = await ethers.getContractFactory('Web3Packs');
    const Web3PacksInstance = await Web3Packs.deploy();
    const web3Packs = await Web3PacksInstance.deployed();
    deployData['Web3Packs'] = {
      abi: getContractAbi('Web3Packs'),
      address: web3Packs.address,
      deployTransaction: web3Packs.deployTransaction
    }
    saveDeploymentData(chainId, deployData);
    log('  - Web3Packs:   ', web3Packs.address);
    log('     - Block:    ', web3Packs.deployTransaction.blockNumber);
    log('     - Gas Cost: ', getTxGasCost({ deployTransaction: web3Packs.deployTransaction }));


    if (chainId === 80001 || chainId === 31337) {
      log('\n  Deploying Sample20 as TestTokenA1...');
      const TestTokenA1 = await ethers.getContractFactory('Sample20');
      const TestTokenA1Instance = await TestTokenA1.deploy('TestTokenA1', 'TTA1');
      const testTokenA1 = await TestTokenA1Instance.deployed();
      deployData['TestTokenA1'] = {
        abi: getContractAbi('Sample20'),
        address: testTokenA1.address,
        deployTransaction: testTokenA1.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - TestTokenA1:   ', testTokenA1.address);
      log('     - Block:    ', testTokenA1.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: testTokenA1.deployTransaction }));

      log('\n  Deploying Sample20 as TestTokenA2...');
      const TestTokenA2 = await ethers.getContractFactory('Sample20');
      const TestTokenA2Instance = await TestTokenA2.deploy('TestTokenA2', 'TTA2');
      const testTokenA2 = await TestTokenA2Instance.deployed();
      deployData['TestTokenA2'] = {
        abi: getContractAbi('Sample20'),
        address: testTokenA2.address,
        deployTransaction: testTokenA2.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - TestTokenA2:   ', testTokenA2.address);
      log('     - Block:    ', testTokenA2.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: testTokenA2.deployTransaction }));

      log('\n  Deploying Sample20 as TestTokenA3...');
      const TestTokenA3 = await ethers.getContractFactory('Sample20');
      const TestTokenA3Instance = await TestTokenA3.deploy('TestTokenA3', 'TTA3');
      const testTokenA3 = await TestTokenA3Instance.deployed();
      deployData['TestTokenA3'] = {
        abi: getContractAbi('Sample20'),
        address: testTokenA3.address,
        deployTransaction: testTokenA3.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - TestTokenA3:   ', testTokenA3.address);
      log('     - Block:    ', testTokenA3.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: testTokenA3.deployTransaction }));

      log('\n  Deploying Sample20 as TestTokenA4...');
      const TestTokenA4 = await ethers.getContractFactory('Sample20');
      const TestTokenA4Instance = await TestTokenA4.deploy('TestTokenA4', 'TTA4');
      const testTokenA4 = await TestTokenA4Instance.deployed();
      deployData['TestTokenA4'] = {
        abi: getContractAbi('Sample20'),
        address: testTokenA4.address,
        deployTransaction: testTokenA4.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - TestTokenA4:   ', testTokenA4.address);
      log('     - Block:    ', testTokenA4.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: testTokenA4.deployTransaction }));


      log('\n  Deploying Sample721...');
      const Sample721 = await ethers.getContractFactory('Sample721');
      const Sample721Instance = await Sample721.deploy();
      const sample721 = await Sample721Instance.deployed();
      deployData['Sample721'] = {
        abi: getContractAbi('Sample721'),
        address: sample721.address,
        deployTransaction: sample721.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - Sample721:   ', sample721.address);
      log('     - Block:    ', sample721.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: sample721.deployTransaction }));


      log('\n  Deploying Sample1155...');
      const Sample1155 = await ethers.getContractFactory('Sample1155');
      const Sample1155Instance = await Sample1155.deploy();
      const sample1155 = await Sample1155Instance.deployed();
      deployData['Sample1155'] = {
        abi: getContractAbi('Sample1155'),
        address: sample1155.address,
        deployTransaction: sample1155.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - Sample1155:   ', sample1155.address);
      log('     - Block:    ', sample1155.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: sample1155.deployTransaction }));
    }


    log('\n  Contract Deployment Data saved to "deployments" directory.');
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['core']
