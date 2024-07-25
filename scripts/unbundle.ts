import { Contract } from "ethers";
import globals from "../tests/globals";
import { Web3Packs } from "../typechain-types";
import { chargedStateAbi } from "@charged-particles/charged-js-sdk";
const hre = require("hardhat");

// npx hardhat run scripts/test.ts --network polygon
async function main() {
  const accounts = await hre.ethers.getSigners();
  const web3Packs: Web3Packs = await hre.ethers.getContract('Web3PacksMode');

  const protonTokenToUnbundle = 5;
  const LP_NFT = '0x2e8614625226D26180aDf6530C3b1677d3D7cf10';

  const chargedStateContractAddress = globals.chargedStateContractAddress;
  const chargedState = new Contract(chargedStateContractAddress, chargedStateAbi, accounts[0]);

  // setBreakBondApproval
  await chargedState.setApprovalForAll(
    globals.protonMode,
    protonTokenToUnbundle,
    web3Packs.address
  ).then((tx) => tx.wait());

  await web3Packs.unbundle(
    await accounts[0].getAddress(),
    globals.protonMode,
    protonTokenToUnbundle,
    {
      erc20TokenAddresses: [],
      nfts: [{
        tokenAddress: LP_NFT, // nested in the web3 pack token
        id: 50535
      }],
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});