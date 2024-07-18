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

  describe('Web3Packs MODE', async () => {
    it('Should have 3 USDc', async() => {
      const balance = await USDc.balanceOf(web3packs.address);
      expect(balance).to.equal('100000000');
    });

    it.only('Swap a single asset', async() => {
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

    
    it('Bundles token with two swaps and then unbundles the nft', async() => {
      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.USDtContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: globals.deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.UniContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: globals.deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];

      // const currentBlock = ethers.provider.blockNumber;
      // const timeLock = currentBlock + 100;
      
      const newTokenId = await web3packs.callStatic.bundleMode(
        globals.testAddress,
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock:0 , ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('.2') }
      );

      const bundleTransaction = await web3packs.bundleMode(
        await deployerSigner.getAddress(),
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();

      const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());

      // const USDtTokenMass = await bundToken.getMass(globals.USDtContractAddress, 'generic.B');
      const UniTokenMass = await bundToken.getMass(globals.UniContractAddress, 'generic.B');
      expect(UniTokenMass['137']?.value).to.be.gt(1);

      // Charged settings contract
      const chargedStateContractAddress = '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b';
      const chargedState = new Contract(chargedStateContractAddress, chargedStateAbi, deployerSigner);

      // setBreakBondApproval
      await chargedState.setApprovalForAll(
        Proton.address,
        newTokenId.toNumber(),
        web3packs.address
      ).then((tx) => tx.wait());
        
      const unBundleTransaction = await web3packs.unbundle(
        await deployerSigner.getAddress(),
        Proton.address,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ globals.UniContractAddress, globals.USDtContractAddress],
          nfts: []
        },
      );
      await unBundleTransaction.wait();

      const uniLeftInBundle = await bundToken.getMass(globals.UniContractAddress, 'generic.B');
      const USDLeftInBundle = await bundToken.getMass(globals.USDtContractAddress, 'generic.B');
      expect(uniLeftInBundle['137']?.value).to.eq(0);
      expect(USDLeftInBundle['137']?.value).to.eq(0);


      const USDt = new ethers.Contract(globals.USDtContractAddress, globals.erc20Abi, USDcWhaleSigner); 
      const balanceOfUSDtAfterRelease = await USDt.balanceOf(await deployerSigner.getAddress());

      expect(balanceOfUSDtAfterRelease.toNumber()).to.be.closeTo(9,1);
    });

    it('Should not allow to break pack when locked: erc20s', async() => {
      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.USDtContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: globals.deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
      ];

      const currentBlock = ethers.provider.blockNumber;
      const timeLock = currentBlock + 100;
      
      const newTokenId = await web3packs.callStatic.bundleMode(
        globals.testAddress,
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock:0 , ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('.2') }
      );

      const bundleTransaction = await web3packs.bundleMode(
        await deployerSigner.getAddress(),
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock: timeLock, ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();

      const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());

      // Charged settings contract
      const chargedStateContractAddress = '0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b';
      const chargedState = new Contract(chargedStateContractAddress, chargedStateAbi, deployerSigner);

      // setBreakBondApproval
      await chargedState.setApprovalForAll(
        Proton.address,
        newTokenId.toNumber(),
        web3packs.address
      ).then((tx) => tx.wait());
        
      await expect(web3packs.unbundle(
        await deployerSigner.getAddress(),
        Proton.address,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ globals.USDtContractAddress],
          nfts: []
        },
      )).to.revertedWith('CP:E-302');
    });
  })
});