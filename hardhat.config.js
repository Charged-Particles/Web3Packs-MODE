require('dotenv').config();

require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-ethers');
require('hardhat-gas-reporter');
require('hardhat-abi-exporter');
require('solidity-coverage');
require('hardhat-deploy-ethers');
require('hardhat-deploy');
require("hardhat-watcher");

const {
  TASK_TEST,
  TASK_COMPILE_GET_COMPILER_INPUT
} = require('hardhat/builtin-tasks/task-names');

// Task to run deployment fixtures before tests without the need of "--deploy-fixture"
//  - Required to get fixtures deployed before running Coverage Reports
task(
  TASK_TEST,
  "Runs the coverage report",
  async (args, hre, runSuper) => {
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


module.exports = {
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
      137: '',
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
    // localhost: {
    //   chainId: 31337,
    //   gasPrice: 1e9,
    //   forking: {
    //     url: "https://polygon-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY,
    //     blockNumber: 7827722
    //   }
    // },
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
