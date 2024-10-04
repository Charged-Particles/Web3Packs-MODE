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
            runs: 200
          }
        },
      },
    ],
  },
  namedAccounts: {
    // er: 0,
    // tokenOwner: 1,
    deployer: {
      default: 0,
    },
    protocolOwner: {
      default: 1,
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
        // url: 'https://polygon-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
        // blockNumber: 30784049
        url: 'https://mainnet.mode.network',
        blockNumber: 13904000
      },
      accounts: {
        mnemonic: mnemonic.mainnet,
        initialIndex: 0,
        count: 10,
      },
    },
    mainnet: {
        url: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        gasPrice: 'auto',
        // blockGasLimit: 12487794,
        accounts: {
            mnemonic: mnemonic.mainnet,
            initialIndex: 0,
            count: 10,
        }
    },
    polygon: {
        url: 'https://polygon-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
        gasPrice: 'auto',
        accounts: {
            mnemonic: mnemonic.mainnet,
            // initialIndex: 0,
            count: 8,
        },
        chainId: 137
    },
    modeSepolia: {
      url: "https://sepolia.mode.network",
      gasPrice: 'auto',
      accounts: {
          mnemonic: mnemonic.testnet,
          initialIndex: 0,
          count: 10,
      },
      chainId: 919,
    },
    mode: {
      url: "https://mainnet.mode.network",
      gasPrice: 'auto',
      accounts: {
          mnemonic: mnemonic.mainnet,
          initialIndex: 0,
          count: 10,
      },
      chainId: 34443,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY ?? '',
      mode: process.env.ETHERSCAN_APIKEY ?? '',
      modeSepolia: 'MODE-NETWORK-TESTNET',
    },
    customChains: [
      {
        network: 'mode',
        chainId: 34443,
        urls: {
          apiURL: 'https://explorer.mode.network/api\?',
          browserURL: 'https://explorer.mode.network',
        },
      },
      {
        network: 'modeSepolia',
        chainId: 919,
        urls: {
          apiURL: 'https://sepolia.explorer.mode.network/api',
          browserURL: 'https://sepolia.explorer.mode.network'
        }
      }
    ],
  },
  gasReporter: {
      currency: 'USD',
      gasPrice: 1,
      enabled: (process.env.REPORT_GAS) ? true : false
  },
  abiExporter: {
    path: './abis',
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [ 'Web3Packs' ],
  },
  sourcify: { enabled: true },
};

export default config;
