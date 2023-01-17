import { log, toEth, toBN } from './utils';

import { get } from 'lodash';

let __accumulatedGasCost = toBN('0');

const accumulatedGasCost = (tx) => {
  let gasCost = toBN('0');
  if (get(tx, 'gasUsed', false) && get(tx, 'effectiveGasPrice', false)) {
    gasCost = tx.gasUsed.mul(tx.effectiveGasPrice);
  } else if (get(tx, 'gasPrice', false) && get(tx, 'gasLimit', false)) {
    gasCost = tx.gasLimit.mul(tx.gasPrice);
  }
  __accumulatedGasCost = __accumulatedGasCost.add(gasCost);
};

const getAccumulatedGasCost = () => {
  if (__accumulatedGasCost === 0) {
    return ['0 ETH', '0 ETH', '0 ETH'];
  }
  const gwei1   = `${toEth(__accumulatedGasCost.div(10))} ETH`;
  const gwei10  = `${toEth(__accumulatedGasCost)} ETH`;
  const gwei100 = `${toEth(__accumulatedGasCost.mul(10))} ETH`;
  const gwei150 = `${toEth(__accumulatedGasCost.mul(15))} ETH`;
  __accumulatedGasCost = toBN('0');
  return [gwei1, gwei10, gwei100, gwei150];
};

const resetAccumulatedGasCost = () => {
  __accumulatedGasCost = toBN('0');
};

const executeTx = async (txId, txDesc, callback, retryAttempts = 3) => {
  try {
    if (txId === '1-a') {
      log(`\n`);
    }
    log(`  - [TX-${txId}] ${txDesc}`);
    const tx = await callback();
    const txResult = await tx.wait();
    accumulatedGasCost(txResult);
  }
  catch (err) {
    log(`  - Transaction ${txId} Failed: ${err}`);
    if (retryAttempts > 0) {
      log(`  - Retrying;`);
      await executeTx(txId, txDesc, callback, retryAttempts-1);
    }
  }
}


export default {
  executeTx,
  accumulatedGasCost,
  getAccumulatedGasCost,
  resetAccumulatedGasCost,
};
