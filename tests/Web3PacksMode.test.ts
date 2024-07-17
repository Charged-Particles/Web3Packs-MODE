import { expect } from "chai"; 
import { ethers, network, getNamedAccounts } from 'hardhat';
import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";
import { Contract, Signer } from "ethers";
import { USDC_USDT_SWAP } from "../uniswap/libs/constants";
import { amountOutMinimum, getNearestUsableTick, quote } from "../uniswap/quote";
import { getPoolContract } from "../uniswap/quote";
import globals from "./globals";

describe('Web3Packs', async ()=> {
  // Define contracts
  let web3packs: Contract, USDc: Contract, TestNFT: Contract, Proton: Contract, Uni: Contract; 
  let charged: Charged;
  // Define signers
  let USDcWhaleSigner: Signer, ownerSigner: Signer, testSigner: Signer, deployerSigner: Signer;

  beforeEach(async () => {
    const { protocolOwner, deployer } = await getNamedAccounts();

    web3packs = await ethers.getContract('Web3PacksMode');
    TestNFT = await ethers.getContract('ERC721Mintable');

    ownerSigner = await ethers.getSigner(protocolOwner);
    deployerSigner = await ethers.getSigner(deployer);
    testSigner = ethers.Wallet.fromMnemonic(process.env.TESTNET_MNEMONIC ?? '');

    charged = new Charged({ providers: network.provider , signer: testSigner });

    Proton = new ethers.Contract(
      '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
      protonBAbi,
      ownerSigner
    );
  });

  beforeEach(async() => {
    const { protocolOwner } = await getNamedAccounts();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ globals.USDcWhale ]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [protocolOwner],
    });

    // Deposit usdc into web3pack contract
    USDcWhaleSigner = await ethers.getSigner(globals.USDcWhale);
    USDc = new ethers.Contract(globals.USDcContractAddress, globals.erc20Abi, USDcWhaleSigner);
    Uni = new ethers.Contract(globals.UniContractAddress, globals.erc20Abi, ethers.provider);

    const foundWeb3PacksTransaction = await USDc.transfer(web3packs.address, ethers.utils.parseUnits('100', 6));
    await foundWeb3PacksTransaction.wait();
  });

  describe('Web3Packs', async () => {
    it('Should have 3 USDc', async() => {
      const balance = await USDc.balanceOf(web3packs.address);
      expect(balance).to.equal('100000000');
    });

    it('Swap a single asset', async() => {
      // calculate expected amount
      const swapEstimation = await quote(USDC_USDT_SWAP);
      const swapPriceTolerance = amountOutMinimum(swapEstimation, 10);

      const ERC20SwapOrder = [{
        inputTokenAddress: globals.USDcContractAddress,
        outputTokenAddress: globals.USDtContractAddress,
        inputTokenAmount: ethers.utils.parseUnits('10', 6),
        uniSwapPoolFee: 3000,
        deadline: globals.deadline,
        amountOutMinimum: swapPriceTolerance,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait()

      const USDt = new ethers.Contract(globals.USDtContractAddress, globals.erc20Abi, USDcWhaleSigner);
      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(9982205);
    });
});