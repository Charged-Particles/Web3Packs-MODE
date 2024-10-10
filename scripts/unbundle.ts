import { Contract } from "ethers";
import globals from "../js-helpers/globals";
import { Web3PacksMode } from "../typechain-types";
import { chargedStateAbi } from "@charged-particles/charged-js-sdk";
const hre = require("hardhat");

// npx hardhat run scripts/unbundle.ts --network mode
async function main() {
  const accounts = await hre.ethers.getSigners();
  const web3Packs: Web3PacksMode = await hre.ethers.getContract('Web3PacksMode');
  const unbundleFee = globals.protocolFee;

  const protonTokenToUnbundle = 165;

  const chargedStateContractAddress = globals.chargedStateContractAddress;
  const chargedState = new Contract(chargedStateContractAddress, chargedStateAbi, accounts[0]);

  const erc20s = [
    // '0xDfc7C877a950e49D2610114102175A06C2e3167a',
    // '0x8b2EeA0999876AAB1E7955fe01A5D261b570452C',
    // '0x77E7bcfeE826b12cD498Faa9831d7055b7478272',
    // '0x6863fb62Ed27A9DdF458105B507C15b5d741d62e',
    // '0x95177295A394f2b9B04545FFf58f4aF0673E839d',
    // '0x18470019bF0E94611f15852F7e93cf5D65BC34CA',
    // '0x66eEd5FF1701E6ed8470DC391F05e27B1d0657eb',
    // '0xb9dF4BD9d3103cF1FB184BF5e6b54Cf55de81747',
    // '0xcDa802a5BFFaa02b842651266969A5Bba0c66D3e',
  ];
  const nfts = [];
  const lps = [
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
    {
      token0: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
      token1: { token: '0x0000000000000000000000000000000000000000', amount: 0 },
    },
  ];

  // setBreakBondApproval
  await chargedState.setApprovalForAll(
    globals.protonMode,
    protonTokenToUnbundle,
    web3Packs.address
  ).then((tx) => tx.wait());

  const tx = await web3Packs.unbundle(
    await accounts[0].getAddress(),
    globals.protonMode,
    protonTokenToUnbundle,
    erc20s,
    nfts,
    lps,
    { value: unbundleFee },
  );
  console.log(tx);
  const receipt = await tx.wait();
  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});