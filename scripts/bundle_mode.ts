import { Signer, Wallet } from "ethers";
import globals from "../tests/globals";
import { Web3PacksMode } from "../typechain-types";
const hre = require("hardhat");

// npx hardhat run scripts/test.ts --network polygon
async function main() {
  const [ deployer ] = await hre.ethers.getSigners();
  const web3Packs: Web3PacksMode = await hre.ethers.getContract('Web3PacksMode');

  // pool https://explorer.mode.network/address/0x8cfE2A02dfBAbC56aE7e573170E35f88A38BeA55?tab=read_contract
  const TOKEN_0 = '0x4200000000000000000000000000000000000006';
  const TOKEN_1 = '0xDfc7C877a950e49D2610114102175A06C2e3167a';
  const POOL_FEE = 5900;
  const amount0 = 10000000;
  const amount1 = 0;
  const tickSpace = 60;

  const ERC20SwapOrder = [
    {
      inputTokenAddress: TOKEN_0,
      outputTokenAddress: TOKEN_1,
      uniSwapPoolFee: POOL_FEE,
      inputTokenAmount: amount0,
      deadline: globals.deadline,
      amountOutMinimum: 0,
      sqrtPriceLimitX96: 0,
      forLiquidity: true
    }
  ];

  const liquidityMintOrder = [
    {
      token0: TOKEN_0,
      token1: TOKEN_1,
      amount0ToMint: amount0,
      amount1ToMint: amount1,
      amount0Min: 0,
      amount1Min: 0,
      tickSpace: tickSpace,
      poolFee: POOL_FEE
    }
  ];

  // const wallet = Wallet.fromMnemonic(process.env.MAINNET_MNEMONIC ?? '');
  // const pk = wallet.privateKey
  const tokenId = await web3Packs.callStatic.bundleMode(
    await deployer.getAddress(),
    globals.ipfsMetadata,
    ERC20SwapOrder,
    liquidityMintOrder,
    { ERC20Timelock: 0, ERC721Timelock: 0 },
    { value: hre.ethers.utils.parseEther('0.00000000002') }
  );
  
  console.log(tokenId.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});