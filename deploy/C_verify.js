const util = require('util');
const exec = util.promisify(require('child_process').exec);
const _ = require('lodash');

const {
  log,
  chainTypeById,
  chainIdByName,
  chainNameById,
} = require('../js-helpers/utils');


const _verifyContract = async ({name, networkName, contractRef = null, addressOverride = null}) => {
  try {
    const deployment = (await deployments.get(name)) || {};
    const address = addressOverride || deployment.address;
    const constructorArgs = deployment.constructorArgs || [];
    log(`Verifying ${name} at address "${address}" ${constructorArgs ? `with ${constructorArgs.length} arg(s)` : ''}...`);

    const execArgs = constructorArgs.map(String).join(' ');
    const execCmd = [];
    execCmd.push('hardhat', 'verify', '--network', networkName);
    if (_.isString(contractRef) && contractRef.length > 0) {
      execCmd.push('--contract', `contracts/${contractRef}`);
    }
    execCmd.push(address, execArgs);

    log(`CMD: ${execCmd.join(' ')}`);
    await exec(execCmd.join(' '));
    log(`${name} verified!\n`);
  }
  catch (err) {
    if (/Contract source code already verified/.test(err.message || err)) {
      log(`${name} already verified\n`);
    } else {
      console.error(err);
    }
  }
}

module.exports = async (hre) => {
  const { ethers, getNamedAccounts } = hre;
  const { deployer, protocolOwner } = await getNamedAccounts();

  const chainId = await hre.network.config.chainId;

  const isHardhat = hre.network.name == 'hardhat';
  if (isHardhat) { return; }

  const networkName = hre.network.name === 'homestead' ? 'mainnet' : network.name;
  log(`Verifying contracts on network "${networkName} (${chainId})"...`);

  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  log('Charged Particles: Contract Verification');
  log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');

  log(`  Using Network: ${chainNameById(chainId)} (${chainId})`);
  log('  Using Accounts:');
  log('  - Deployer:    ', deployer);
  log('  - Owner:       ', protocolOwner);
  log(' ');

  await _verifyContract({name: 'Web3Packs', networkName});

  log('\n  Contract Verification Complete.');
  log('\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~\n');
};

module.exports.tags = ['verify']
