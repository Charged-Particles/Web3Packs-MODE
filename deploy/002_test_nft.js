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
