import { Signer, Wallet } from "ethers";
import globals from "../js-helpers/globals";
import { Web3PacksMode } from "../typechain-types";
const hre = require("hardhat");

// npx hardhat run scripts/test.ts --network polygon
async function main() {
  const [ deployer ] = await hre.ethers.getSigners();
  const web3Packs: Web3PacksMode = await hre.ethers.getContract('Web3PacksMode');

  const RouterType = {
    UniswapV2: 0n,
    UniswapV3: 1n,
  };

  // pool https://explorer.mode.network/address/0x8cfE2A02dfBAbC56aE7e573170E35f88A38BeA55?tab=read_contract
  const amount2 = hre.ethers.utils.parseEther('0.000000000001');

  const tickSpace = 60;

  const ERC20SwapOrder = [
    {
      inputTokenAddress: globals.wrapETHAddress,
      outputTokenAddress: globals.modeTokenAddress,
      uniSwapPoolFee: 0,
      inputTokenAmount: amount2,
      deadline: globals.deadline,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
      routerType: RouterType.UniswapV2,
    },
    {
      inputTokenAddress: globals.wrapETHAddress,
      outputTokenAddress: globals.modeTokenAddress,
      uniSwapPoolFee: 0,
      inputTokenAmount: amount2,
      deadline: globals.deadline,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
      routerType: RouterType.UniswapV2,
    },
  ];

  const liquidityMintOrder = [
    {
      token0: globals.wrapETHAddress,
      token1: globals.modeTokenAddress,
      amount0ToMint: 1000000,
      amount1ToMint: 1000000,
      amount0Min: 0,
      amount1Min: 0,
      tickSpace: tickSpace,
      poolFee: 0,
      routerType: RouterType.UniswapV3,
    }
  ];

  const tokenId = await web3Packs.callStatic.bundle(
    await deployer.getAddress(),
    globals.ipfsMetadata,
    ERC20SwapOrder,
    liquidityMintOrder,
    { ERC20Timelock: 0, ERC721Timelock: 0 },
    { value: hre.ethers.utils.parseEther('0.0000000004') }
  );
  console.log(tokenId);

  //  await web3Packs.bundle(
  //   await deployer.getAddress(),
  //   globals.ipfsMetadata,
  //   ERC20SwapOrder,
  //   liquidityMintOrder,
  //   { ERC20Timelock: 0, ERC721Timelock: 0 },
  //   { value: hre.ethers.utils.parseEther('0.0000000004') }
  // );
  // console.log(tokenId.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});