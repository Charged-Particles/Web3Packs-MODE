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
    NonfungiblePositionManager: '0x91ae842A5Ffd8d12023116943e72A606179294f3',
  },
  // mode
  34443: {
    Weth: '0x4200000000000000000000000000000000000006',
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x2691B4f4251408bA4b8bf9530B6961b9D0C1231F',
    Proton: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
    NonfungiblePositionManager: '0x2e8614625226D26180aDf6530C3b1677d3D7cf10',
    KimRouter: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
    VelodromeRouter: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
    BalancerRouter: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    SwapModeRouter: '0xc1e624C810D297FD70eF53B0E08F44FABE468591',
  },
};

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre;
  const { deploy } = deployments;
  const { deployer, treasury, user1 } = await getNamedAccounts();
  const network = await hre.network;
  const chainId = chainIdByName(network.name);
  let constructorArgs;

  const isHardhat = () => {
    const isForked = network?.config?.forking?.enabled ?? false;
    return isForked || network?.name === 'hardhat';
  };

  const useExistingWeb3PacksContract = isHardhat() ? '' : '0x750663B16Bd6404D06Ddc21Ea9A2A0148Ac968B6';
  const useExistingManagerContract = isHardhat() ? '' : '0x3c38A05998443555793366BDB9F68cA31F098519';
  const useExistingExchangeContract = isHardhat() ? '' : '0xB3781bbB4799C47C7f803979e308f686B79A5997';
  const migrateFromOldManager = {
    address: '', // '0xdBE000aDe32AcC1d81C38B01765902de6d698e5c',
    tokenRange: [765, 766], //[187, 530],
  };

  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  log('Charged Particles - Web3 Packs MODE - Contract Deployment');
  log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  log(`  Using Network: ${chainNameById(chainId)} (${network.name}:${chainId})`);
  log('  Using Accounts:');
  log('  - Deployer: ', deployer);
  log('  - Treaury:  ', treasury);
  log('  - User1:    ', user1);
  log(' ');

  // Deploy & Verify Web3PacksMode
  if (useExistingWeb3PacksContract.length === 0) {
    log('  Deploying Web3PacksMode...');
    constructorArgs = [
      _ADDRESS[chainId].Weth,
      _ADDRESS[chainId].Proton,
      _ADDRESS[chainId].ChargedParticles,
      _ADDRESS[chainId].ChargedState
    ];
    await deploy('Web3PacksMode', {
      from: deployer,
      args: constructorArgs,
      log: true,
    });

    if (!isHardhat()) {
      await verifyContract('Web3PacksMode', await ethers.getContract('Web3PacksMode'), constructorArgs);
    }
  }

  // Deploy & Verify Web3PacksManager
  if (useExistingManagerContract.length === 0) {
    log('  Deploying Web3PacksManager...');
    await deploy('Web3PacksManager', {
      from: deployer,
      args: [],
      log: true,
    });

    if (!isHardhat()) {
      await verifyContract('Web3PacksManager', await ethers.getContract('Web3PacksManager'), []);
    }
  }

  // Deploy & Verify Web3PacksExchangeManager
  if (useExistingExchangeContract.length === 0) {
    log('  Deploying Web3PacksExchangeManager...');
    constructorArgs = [
      _ADDRESS[chainId].Weth,
    ];
    await deploy('Web3PacksExchangeManager', {
      from: deployer,
      args: constructorArgs,
      log: true,
    });

    if (!isHardhat()) {
      await verifyContract('Web3PacksExchangeManager', await ethers.getContract('Web3PacksExchangeManager'), constructorArgs);
    }
  }

  // Get Deployed Web3PacksMode
  let web3packs;
  if (useExistingWeb3PacksContract.length === 0) {
    web3packs = await ethers.getContract('Web3PacksMode');
  } else {
    web3packs = await ethers.getContractAt('Web3PacksMode', useExistingWeb3PacksContract);
  }

  // Get Deployed Web3PacksManager
  let web3packsManager;
  if (useExistingManagerContract.length === 0) {
    web3packsManager = await ethers.getContract('Web3PacksManager');
  } else {
    web3packsManager = await ethers.getContractAt('Web3PacksManager', useExistingManagerContract);
  }

  // Get Deployed Web3PacksExchangeManager
  let web3packsExchangeManager;
  if (useExistingExchangeContract.length === 0) {
    web3packsExchangeManager = await ethers.getContract('Web3PacksExchangeManager');
  } else {
    web3packsExchangeManager = await ethers.getContractAt('Web3PacksExchangeManager', useExistingExchangeContract);
  }

  // Configure Newly Deployed Web3PacksMode
  if (useExistingWeb3PacksContract.length === 0) {
    log(`  Setting Web3PacksManager Address in Web3Packs: ${web3packsManager.address}`);
    await web3packs.setWeb3PacksManager(web3packsManager.address).then(tx => tx.wait());

    log(`  Setting Web3PacksExchangeManager Address in Web3Packs: ${web3packsExchangeManager.address}`);
    await web3packs.setWeb3PacksExchangeManager(web3packsExchangeManager.address).then(tx => tx.wait());

    log(`  Setting Protocol Fee in Web3Packs: ${globals.protocolFee}`);
    await web3packs.setProtocolFee(globals.protocolFee).then(tx => tx.wait());

    log(`  Setting Protocol Treasury in Web3Packs: ${treasury}`);
    await web3packs.setTreasury(treasury).then(tx => tx.wait());

    log(`  Setting Web3Packs Address in Web3PacksManager: ${web3packs.address}`);
    await web3packsManager.setWeb3PacksContract(web3packs.address, true).then(tx => tx.wait());
  }

  // Configure Newly Deployed Web3PacksManager
  if (useExistingManagerContract.length === 0) {
    log(`  Setting Allowlisted Contract (WETH) in Web3PacksManager: ${_ADDRESS[chainId].Weth}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].Weth, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (Proton) in Web3PacksManager: ${_ADDRESS[chainId].Proton}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].Proton, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (ChargedParticles) in Web3PacksManager: ${_ADDRESS[chainId].ChargedParticles}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].ChargedParticles, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (ChargedState) in Web3PacksManager: ${_ADDRESS[chainId].ChargedState}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].ChargedState, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (KimRouter) in Web3PacksManager: ${_ADDRESS[chainId].KimRouter}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].KimRouter, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (Kim-LpMgr) in Web3PacksManager: ${_ADDRESS[chainId].NonfungiblePositionManager}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].NonfungiblePositionManager, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (VelodromeRouter) in Web3PacksManager: ${_ADDRESS[chainId].VelodromeRouter}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].VelodromeRouter, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (Balancer) in Web3PacksManager: ${_ADDRESS[chainId].BalancerRouter}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].BalancerRouter, true).then(tx => tx.wait());

    log(`  Setting Allowlisted Contract (SwapMode) in Web3PacksManager: ${_ADDRESS[chainId].SwapModeRouter}`);
    await web3packsManager.setContractAllowlist(_ADDRESS[chainId].SwapModeRouter, true).then(tx => tx.wait());

    log(`  Setting Web3PacksManager Address in Web3Packs: ${web3packsManager.address}`);
    await web3packs.setWeb3PacksManager(web3packsManager.address).then(tx => tx.wait());

    log(`  Setting Web3PacksManager in Web3PacksExchangeManager: ${web3packsManager.address}`);
    await web3packsExchangeManager.setWeb3PacksManager(web3packsManager.address).then(tx => tx.wait());
  }

  // Configure Newly Deployed Web3PacksExchangeManager
  if (useExistingExchangeContract.length === 0) {
    log(`  Setting Web3Packs Address in Web3PacksExchangeManager: ${web3packs.address}`);
    await web3packsExchangeManager.setWeb3Packs(web3packs.address).then(tx => tx.wait());

    log(`  Setting Web3PacksManager in Web3PacksExchangeManager: ${web3packsManager.address}`);
    await web3packsExchangeManager.setWeb3PacksManager(web3packsManager.address).then(tx => tx.wait());

    log(`  Setting Web3PacksExchangeManager Address in Web3PacksManager: ${web3packsExchangeManager.address}`);
    await web3packsManager.setWeb3PacksContract(web3packsExchangeManager.address, true).then(tx => tx.wait());
  }

  // Migrate Newly Deployed Web3PacksManager
  if (!isHardhat() && migrateFromOldManager.address.length) {
    for (let i = migrateFromOldManager.tokenRange[0]; i < migrateFromOldManager.tokenRange[1]; i++) {
      log(`  Migrating Token ${i} from Old Manager at ${migrateFromOldManager.address}..`);
      await web3packsManager.migrateFromOldManager(migrateFromOldManager.address, i, _ADDRESS[chainId].NonfungiblePositionManager);
    }
  }
};

module.exports.tags = ['mode_packs']
