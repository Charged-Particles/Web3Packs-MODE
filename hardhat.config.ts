import * as dotenv from 'dotenv'
dotenv.config()

import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-abi-exporter'
import 'solidity-coverage'
import 'hardhat-deploy-ethers'
import 'hardhat-deploy'
import 'hardhat-watcher'
import { HardhatUserConfig, task } from "hardhat/config";
import { TASK_TEST } from 'hardhat/builtin-tasks/task-names';

// Task to run deployment fixtures before tests without the need of "--deploy-fixture"
//  - Required to get fixtures deployed before running Coverage Reports
task(
  TASK_TEST,
  "Runs the coverage report",
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

const optimizerDisabled = process.env.OPTIMIZER_DISABLED


const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
      },
      {
        version: "0.8.17",
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
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: './build/contracts',
      deploy: './deploy',
      deployments: './deployments'
  },
  networks: {
    hardhat: {
      chainId: 137,
      gasPrice: 100e9,
      forking: {
        url: "https://polygon-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
        blockNumber: 30784049
      }
    },
    mumbai: {
        // url: `https://matic-mumbai.chainstacklabs.com/`,
        url: 'https://rpc-mumbai.maticvigil.com',
        gasPrice: 10e9,
        accounts: {
            mnemonic: mnemonic.testnet,
            initialIndex: 0,
            count: 10,
        },
        chainId: 80001
    },
    polygon: {
        url: `https://matic-mainnet.chainstacklabs.com/`,
        gasPrice: 62e9,
        accounts: {
            mnemonic: mnemonic.mainnet,
            initialIndex: 0,
            count: 3,
        },
        chainId: 137
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_APIKEY,
      polygonMumbai: process.env.POLYGONSCAN_APIKEY,
    }
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
    only: [ 'Web3Packs', 'Sample20', 'Sample721', 'Sample1155' ],
  },
};

export default config;
