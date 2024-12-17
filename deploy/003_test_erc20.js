const { log } = require('../js-helpers/utils');

const { verifyContract } = require('../js-helpers/verifyContract');

module.exports = async (hre) => {
    const { getNamedAccounts, deployments } = hre;
    const { deploy } = deployments;

    const { deployer, treasury, user1 } = await getNamedAccounts();
    const network = await hre.network;

    const isHardhat = () => {
      const isForked = network?.config?.forking?.enabled ?? false;
      return isForked || network?.name === 'hardhat';
    };

    //
    // Deploy Contracts
    //
    log('Deploying Test ERC20...');

    const constructorArgs = [ 'Web3Packs Mode Epoch 1 Rewards', 'W3P-E1' ];
    await deploy('ERC20Mintable', {
      from: deployer,
      args: constructorArgs,
      log: true,
    });
    const erc20 = await ethers.getContract('ERC20Mintable');

    if (!isHardhat()) {
      await verifyContract('ERC20Mintable', erc20, constructorArgs);
    }

    const amount = ethers.utils.parseUnits('5000', 18);
    log(`  Minting ${amount} Tokens to Deployer: ${deployer}`);
    await erc20.mint(deployer, amount);

    log('Done!');
};

module.exports.tags = ['ERC20Mintable']
