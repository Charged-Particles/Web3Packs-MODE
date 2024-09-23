import { run } from "hardhat";

export const verifyContract = async (contractName: string, contract: any, constructorArguments: any = [], qualifiedName: string = '') => {
  try {
    const contractAddress = contract.address; // await contract.getAddress();
    const fullyQualifiedContractName: any = {};
    if (qualifiedName.length) {
      fullyQualifiedContractName.contract = qualifiedName;
    }

    console.log(`  - Verifying contract "${contractName}" at address: ${contractAddress}`);
    await run('verify:verify', { address: contractAddress, constructorArguments, ...fullyQualifiedContractName });
    console.log(`   -- ${contractName} Verification Complete!\n`);
  } catch ( err ) {
    console.log(`[ERROR] Failed to Verify ${contractName}`);
    console.log(err);
  }
};
