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
  
      log('Deploying Test NFT...');
      const ERC721Mintable = await ethers.getContractFactory('ERC721Mintable');
      const ERC721MintableInstance = await ERC721Mintable.deploy();
      const erc712Mintable = await ERC721MintableInstance.deployed();

      deployData['ERC721Mintable'] = {
        abi: getContractAbi('ERC721Mintable'),
        address: erc712Mintable.address,
        deployTransaction: erc712Mintable.deployTransaction
      }
      saveDeploymentData(chainId, deployData);
      log('  - MyTestNFT:   ', erc712Mintable.address);
      log('     - Block:    ', erc712Mintable.deployTransaction.blockNumber);
      log('     - Gas Cost: ', getTxGasCost({ deployTransaction: erc712Mintable.deployTransaction }));
  
      log('\n  Contract Deployment Data saved to "deployments" directory.');
      log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
  };
  
  module.exports.tags = ['ERC721Mintable']
  