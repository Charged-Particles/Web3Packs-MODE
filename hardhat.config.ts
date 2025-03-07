import * as dotenv from 'dotenv'
dotenv.config()

import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'hardhat-abi-exporter';
import 'solidity-coverage';

import 'hardhat-deploy-ethers';
import 'hardhat-deploy';
import 'hardhat-watcher';

import { HardhatUserConfig, task } from 'hardhat/config';
import { TASK_TEST } from 'hardhat/builtin-tasks/task-names';

// Task to run deployment fixtures before tests without the need of '--deploy-fixture'
//  - Required to get fixtures deployed before running Coverage Reports
task(
  TASK_TEST,
  'Runs the coverage report',
  async (args: Object, hre, runSuper) => {
    await hre.run('compile');
    await hre.deployments.fixture();
    return runSuper({...args, noCompile: true});
  }
);

const mnemonic = {
  testnet: `${process.env.TESTNET_MNEMONIC}`.replace(/_/g, ' '),
  mainnet: `${process.env.MAINNET_MNEMONIC}`.replace(/_/g, ' '),
};

const optimizerDisabled = process.env.OPTIMIZER_DISABLED;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.7.6',
      },
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: !optimizerDisabled,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
      // mode: process.env.MAINNET_PKEY as string,
    },
    treasury: {
      default: 1,
      // Treasury:
      'mode': '0x74D599ddC5c015C45D8033670404C7C23d932C77', // https://safe.optimism.io/address-book?safe=mode:0x74D599ddC5c015C45D8033670404C7C23d932C77
    },
    user1: {
      default: 2,
    },
    user2: {
      default: 3,
    },
    user3: {
      default: 4,
    },
  },
  paths: {
      sources: './contracts',
      tests: './test',
      cache: './cache',
      artifacts: './build/contracts',
      deploy: './deploy',
      deployments: './deployments'
  },
  networks: {
    hardhat: {
      chainId: 34443,
      gasPrice: 100e9,
      forking: {
        // url: 'https://polygon-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_ETH_APIKEY,
        // blockNumber: 30784049
        url: 'https://mainnet.mode.network',
        blockNumber: 15004000
      },
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ETH_APIKEY}`,
      gasPrice: 'auto',
      // blockGasLimit: 12487794,
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_ETH_APIKEY}`,
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.testnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 11155111,
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_POLYGON_APIKEY}`,
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.mainnet,
        // initialIndex: 0,
        count: 8,
      },
      chainId: 137,
    },
    mumbai: {
      url: `https://polygon-mumbai.g.alchemy.io/v2/${process.env.ALCHEMY_POLYGON_APIKEY}`,
      gasPrice: 10e9,
      accounts: {
        mnemonic: mnemonic.testnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 80001,
    },
    mode: {
      url: 'https://mainnet.mode.network',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 34443,
    },
    modeSepolia: {
      url: 'https://sepolia.mode.network',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.testnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 919,
    },
    base: {
      url: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_BASE_APIKEY}`,
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 8453,
    },
    baseSepolia: {
      url: `https://base-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_BASE_SEPOLIA_APIKEY}`,
      gasPrice: 1000000000,
      accounts: {
        mnemonic: mnemonic.testnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 84532,
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_OP_APIKEY}`,
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
      chainId: 10,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_APIKEY ?? '',
      sepolia: process.env.ETHERSCAN_APIKEY ?? '',
      mode: process.env.ETHERSCAN_APIKEY ?? '',
      modeSepolia: 'MODE-NETWORK-TESTNET',
      optimism: process.env.ALCHEMY_OP_APIKEY ?? '',
    },
    customChains: [
      {
        network: 'optimism',
        chainId: 10,
        urls: {
          apiURL: 'https://api-optimistic.etherscan.io/api',
          browserURL: 'https://optimistic.etherscan.io',
        },
      },
      {
        network: 'mode',
        chainId: 34443,
        urls: {
          // apiURL: 'https://api.routescan.io/v2/network/mainnet/evm/34443/etherscan',
          // browserURL: 'https://modescan.io',
          apiURL: 'https://explorer.mode.network/api',
          browserURL: 'https://explorer.mode.network:443',
        },
      },
      {
        network: 'modeSepolia',
        chainId: 919,
        urls: {
          apiURL: 'https://sepolia.mode.network/api',
          browserURL: 'https://sepolia.explorer.mode.network',
        },
      },
    ],
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 1,
    enabled: process.env.REPORT_GAS ? true : false,
  },
  abiExporter: {
    path: './abis',
    runOnCompile: true,
    clear: true,
    flat: true,
    only: ['Web3Packs', 'ERC20Mintable'],
    except: ['IWeb3Packs', 'Web3PacksRouterBase'],
  },
  sourcify: { enabled: true },
};

export default config;
