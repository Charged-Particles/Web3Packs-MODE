import { ethers } from "ethers";
import { Web3PacksMode } from "../typechain-types";
const hre = require("hardhat");

// npx hardhat run scripts/collectProtocolFees.ts --network mode
async function main() {
  const accounts = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;

  let web3Packs: Web3PacksMode;
  let balance;

  const web3PacksAddress = [
    '0x33122B3a88eDCafF57bB9FFfE9573F88ad703931',
    // '0x4dd3037B52f12B6dD593020A7f9d1e254fe6894D',
    // '0xEC2e2772cB202c9532a37cE25204fC0d163B3ddA',
    // '0x3Cd2410EAa9c2dCE50aF6CCAb72Dc93879a09c1F',
    // '0x9BE343F44fD97c59b7728480A61AEed03D38804f',
    // '0xe83705B74b6f35767579D6c27790f5Da6EA00260',
    // '0x3AD29d01928AcEa6C8Eeb936615EE5aF5B35a074',
    // '0x7f6C98CAa8A74679A9dCa1c2A3089239f20A4ec6',
    // '0xD2B40D8B72Da6B74959474F88f04CB8d2F763A90',
    // '0x41679CC4143aC2C8455039E2A0cCf6D0960db399',
    // '0x2c1Ef27186AE0d306c195b40C8907EEF7586f388', // Santi owns this one
  ];

  for (let i = 0; i < web3PacksAddress.length; i++) {
    web3Packs = await hre.ethers.getContractAt('Web3PacksMode', web3PacksAddress[i]);
    balance = await provider.getBalance(web3PacksAddress[i]);

    if (balance > 0) {
      console.log(`Withdrawing ETH from ${web3PacksAddress[i]}`);
      const tx = await web3Packs.withdrawEther(await accounts[0].getAddress(), balance);
      const receipt = await tx.wait();
      console.log(` - Withdraw complete: ${receipt.transactionHash}`);
    } else {
      console.log(`Skipping contract ${web3PacksAddress[i]} - No ETH Balance`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});