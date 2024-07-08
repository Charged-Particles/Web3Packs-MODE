import globals from "../tests/globals";
import { Web3Packs } from "../typechain-types";
const hre = require("hardhat");

// npx hardhat run scripts/test.ts --network polygon
async function main() {
  const accounts = await hre.ethers.getSigners();
  const web3Packs: Web3Packs = await hre.ethers.getContract('Web3Packs');

  const TOKEN_0 = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const TOKEN_1 = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const POOL_FEE = 500;
  const amount0 = 10000000;
  const amount1 = 1000000000;
  const tickSpace = 10;

  const ERC20SwapOrder = [
    {
        inputTokenAddress: globals.wrapMaticContractAddress,
        outputTokenAddress: globals.USDcContractAddress,
        uniSwapPoolFee: 500,
        inputTokenAmount: 100000,
        deadline: globals.deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
        forLiquidity: true,
    }
  ];

  const liquidityMintOrder = [
    {
        token0: TOKEN_0,
        token1: TOKEN_1,
        amount0ToMint: amount0,
        amount1ToMint: amount1,
        tickSpace: tickSpace,
        poolFee: POOL_FEE
    }
  ];

  const tokenId = await web3Packs.callStatic.bundle(
    await accounts[0].getAddress(),
    globals.ipfsMetadata,
    ERC20SwapOrder,
    [],
    liquidityMintOrder,
    hre.ethers.utils.parseEther('.1'),
    { value: hre.ethers.utils.parseEther('.2') }
  );
  
  console.log(tokenId.toString());

  await web3Packs.bundle(
    await accounts[0].getAddress(),
    globals.ipfsMetadata,
    ERC20SwapOrder,
    [],
    liquidityMintOrder,
    hre.ethers.utils.parseEther('.1'),
    { value: hre.ethers.utils.parseEther('.2') }
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});