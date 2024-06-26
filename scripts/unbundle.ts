import { Contract } from "ethers";
import globals from "../tests/globals";
import { Web3Packs } from "../typechain-types";
import { chargedStateAbi } from "@charged-particles/charged-js-sdk";
const hre = require("hardhat");

// npx hardhat run scripts/test.ts --network polygon
async function main() {
  const accounts = await hre.ethers.getSigners();
  const web3Packs: Web3Packs = await hre.ethers.getContract('Web3Packs');

  const protonTokenToUnbundle = 638;
  const uniV3NFT = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

  const chargedStateContractAddress = '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b';
  const chargedState = new Contract(chargedStateContractAddress, chargedStateAbi, accounts[0]);

  // setBreakBondApproval
  await chargedState.setApprovalForAll(
    globals.protonPolygon,
    protonTokenToUnbundle,
    web3Packs.address
  ).then((tx) => tx.wait());

  await web3Packs.unbundle(
    await accounts[0].getAddress(),
    globals.protonPolygon,
    protonTokenToUnbundle,
    {
      erc20TokenAddresses: [],
      nfts: [{
        tokenAddress: uniV3NFT, // nested in the web3 pack token
        id: 1893906
      }],
    }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});