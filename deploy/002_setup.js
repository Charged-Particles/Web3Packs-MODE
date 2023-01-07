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
  },
  31337: {
    ChargedParticles: '0x0288280Df6221E7e9f23c1BB398c820ae0Aa6c10',
    ChargedState: '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b',
    ChargedSettings: '0xdc29C7014d104432B15eD2334e654fCBf3d5E528',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  },
  80001: {
    ChargedParticles: '0x51f845af34c60499a1056FCDf47BcBC681A0fA39',
    ChargedState: '0x581c57b86fC8c2D639f88276478324cE1380979D',
    ChargedSettings: '0x60428D3e580907C74Ee8690E4E192317864aAE1d',
    UniswapRouter: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
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
    const Web3Packs = await ethers.getContractFactory('Web3Packs');
    const web3Packs = await Web3Packs.attach(ddWeb3Packs.address);

    // new ethers.Contract( address , abi , signerOrProvider )

    const ddChargedSettings = { address: _ADDRESS[chainId].ChargedSettings };
    log('  Loading ChargedSettings from: ', ddChargedSettings.address);
    
    const chargedSettings = new ethers.Contract(ddChargedSettings.address , chargedSettingsAbi);

    let testTokenA1;
    let testTokenA2;
    let testTokenA3;
    let testTokenA4;
    let sample721;
    let sample1155;
    if (chainId === 80001 || chainId === 31337) {
      // TestTokenA1`
      const ddTestTokenA1 = getDeployData('TestTokenA1', chainId);
      log('  Loading TestTokenA1 from:   ', ddTestTokenA1.address);
      const TestTokenA1 = await ethers.getContractFactory('Sample20');
      testTokenA1 = await TestTokenA1.attach(ddTestTokenA1.address);

      // TestTokenA2
      const ddTestTokenA2 = getDeployData('TestTokenA2', chainId);
      log('  Loading TestTokenA2 from:   ', ddTestTokenA2.address);
      const TestTokenA2 = await ethers.getContractFactory('Sample20');
      testTokenA2 = await TestTokenA2.attach(ddTestTokenA2.address);

      // TestTokenA3
      const ddTestTokenA3 = getDeployData('TestTokenA3', chainId);
      log('  Loading TestTokenA3 from:   ', ddTestTokenA3.address);
      const TestTokenA3 = await ethers.getContractFactory('Sample20');
      testTokenA3 = await TestTokenA3.attach(ddTestTokenA3.address);

      // TestTokenA4
      const ddTestTokenA4 = getDeployData('TestTokenA4', chainId);
      log('  Loading TestTokenA4 from:   ', ddTestTokenA4.address);
      const TestTokenA4 = await ethers.getContractFactory('Sample20');
      testTokenA4 = await TestTokenA4.attach(ddTestTokenA4.address);

      // Sample721
      const ddSample721 = getDeployData('Sample721', chainId);
      log('  Loading Sample721 from:     ', ddSample721.address);
      const Sample721 = await ethers.getContractFactory('Sample721');
      sample721 = await Sample721.attach(ddSample721.address);

      // Sample1155
      const ddSample1155 = getDeployData('Sample1155', chainId);
      log('  Loading Sample1155 from:    ', ddSample1155.address);
      const Sample1155 = await ethers.getContractFactory('Sample1155');
      sample1155 = await Sample1155.attach(ddSample1155.address);

      const testTokenAmount = 10000;
      const max721s = 5;
      const max1155s = 10;

      const enable = [ddSample721.address, ddSample1155.address];
      await executeTx('1-e', `ChargedSettings: Enabling ${enable.length} Contracts for Chain ID: ${chainId}`, async () =>
        await chargedSettings.enableNftContracts(enable)
      );

      await executeTx('2-a', `TestTokenA1: Minting ${testTokenAmount} Tokens to user2`, async () => {
        return await testTokenA1.mint(user2, toWei(`${testTokenAmount}`));
      });

      await executeTx('2-b', `TestTokenA2: Minting ${testTokenAmount} Tokens to user2`, async () =>
        await testTokenA2.mint(user2, toWei(`${testTokenAmount}`))
      );

      await executeTx('2-c', `TestTokenA3: Minting ${testTokenAmount} Tokens to user2`, async () =>
        await testTokenA3.mint(user2, toWei(`${testTokenAmount}`))
      );

      await executeTx('2-d', `TestTokenA4: Minting ${testTokenAmount} Tokens to user2`, async () =>
        await testTokenA4.mint(user2, toWei(`${testTokenAmount}`))
      );

      for (let i = 0; i < max721s; i++) {
        await executeTx(`3-a-${i+1}`, `Sample721: Minting ${i + 1} of ${max721s} NFTs to user2`, async () =>
          await sample721.safeMint(user2)
        );
      }

      const ids = _.map(_.range(1, max1155s+1), _.toString);
      const amounts = _.range(1, max1155s+1, 0);
      await executeTx('4-a', `Sample1155: Batch-Minting ${max1155s} NFTs to user2`, async () =>
        await sample1155.mintBatch(user2, ids, amounts, '0x')
      );
    }

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

    await executeTx('1-d', 'Web3Packs: Transfer Contract Ownership', async () =>
      await web3Packs.transferOwnership(protocolOwner)
    );

    log('\n  Contract Deployment Data saved to "deployments" directory.');
    log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['Web3packs']
