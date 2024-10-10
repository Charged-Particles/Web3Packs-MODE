  const {
    log,
    chainNameById,
    chainIdByName,
  } = require('../js-helpers/utils');

  module.exports = async (hre) => {
      const { getNamedAccounts, deployments } = hre;
      const { deploy } = deployments;

      const { deployer, treasury, user1 } = await getNamedAccounts();
      const network = await hre.network;

      const chainId = chainIdByName(network.name);

      log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
      log('Charged Particles - NFT test - Contract Deployment');
      log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

      log(`  Using Network: ${chainNameById(chainId)} (${network.name}:${chainId})`);
      log('  Using Accounts:');
      log('  - Deployer: ', deployer);
      log('  - Treasury: ', treasury);
      log('  - User1:    ', user1);
      log(' ');

      //
      // Deploy Contracts
      //
      log('Deploying Test NFT...');

      await deploy('ERC721Mintable', {
        from: deployer,
        args: [],
        log: true,
      });
  };

  module.exports.tags = ['ERC721Mintable']
