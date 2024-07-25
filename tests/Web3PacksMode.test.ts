import { expect } from "chai"; 
import { ethers, network, getNamedAccounts } from 'hardhat';
import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";
import { Contract, Signer } from "ethers";
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
      globals.protonMode,
      protonBAbi,
      ownerSigner
    );
  });

  beforeEach(async() => {
    const { protocolOwner } = await getNamedAccounts();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [protocolOwner],
    });
  });

  describe('Web3Packs MODE', async () => {
    it.skip('Swap a single asset', async() => {
      const ERC20SwapOrder = [{
        inputTokenAddress: globals.wrapETHAddress,
        outputTokenAddress: globals.modeTokenAddress,
        inputTokenAmount: ethers.utils.parseEther('0.00000001'),
        uniSwapPoolFee: 3000,
        deadline: globals.deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder, { value: ethers.utils.parseEther('0.00000000002') });
      await swapTransaction.wait()

      const token = new ethers.Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);

      console.log(balanceAfterSwap.toString());

      expect(balanceAfterSwap).to.be.above(0);
    });

    it('Bundles token with two swaps and then unbundles the nft', async() => {
      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.wrapETHAddress,
          outputTokenAddress: globals.modeTokenAddress,
          inputTokenAmount: ethers.utils.parseUnits('10', 6),
          uniSwapPoolFee: 3000,
          deadline: globals.deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];
      
      const newTokenId = await web3packs.callStatic.bundleMode(
        globals.testAddress,
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock:0 , ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('0.00000000002') }
      );

      const bundleTransaction = await web3packs.bundleMode(
        await deployerSigner.getAddress(),
        globals.ipfsMetadata,
        ERC20SwapOrder,
        [],
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('0.00000000002') }
      );

      await bundleTransaction.wait();

      const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());
      const UniTokenMass = await bundToken.getMass(globals.modeTokenAddress, 'generic.B');
      console.log(UniTokenMass)
      // expect(UniTokenMass[network.config.chainId ?? '']?.value).to.be.gt(1);

      // Charged settings contract
      const chargedState = new Contract(globals.chargedStateContractAddress, chargedStateAbi, deployerSigner);

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
          erc20TokenAddresses: [ globals.modeTokenAddress ],
          nfts: []
        },
      );
      await unBundleTransaction.wait();

      // const uniLeftInBundle = await bundToken.getMass(globals.UniContractAddress, 'generic.B');
      // expect(uniLeftInBundle['137']?.value).to.eq(0);
      // const USDt = new ethers.Contract(globals.USDtContractAddress, globals.erc20Abi, USDcWhaleSigner); 
      // const balanceOfUSDtAfterRelease = await USDt.balanceOf(await deployerSigner.getAddress());
      // expect(balanceOfUSDtAfterRelease.toNumber()).to.be.closeTo(9,1);
    });

    it('Should not allow to break pack when locked: erc20s', async() => {
      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.wrapETHAddress,
          outputTokenAddress: globals.modeTokenAddress,
          inputTokenAmount: ethers.utils.parseUnits('10', 6),
          uniSwapPoolFee: 3000,
          deadline: globals.deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];

      const currentBlock = 10491344; // todo: do not hardcode
      const timeLock = currentBlock + 10000;
      
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
        { value: ethers.utils.parseEther('0.00000000002') }
      );
      await bundleTransaction.wait();

      // Charged settings contract
      const chargedState = new Contract(globals.chargedStateContractAddress, chargedStateAbi, deployerSigner);

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
          erc20TokenAddresses: [ globals.modeTokenAddress ],
          nfts: []
        },
      )).to.revertedWith('CP:E-302');
    });

    it('Provides liquidity ', async ()=> {
      const amount1 = ethers.utils.parseEther('0.00000002');
      const amount0 = ethers.utils.parseEther('0.00000001');
      const amount2 = ethers.utils.parseEther('0.000000000001');

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
          forLiquidity: true
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
          poolFee: 0 
        }
      ];

      const tokenId = await web3packs.callStatic.bundleMode(
        await deployerSigner.getAddress(),
        globals.ipfsMetadata,
        ERC20SwapOrder,
        liquidityMintOrder,
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        { value: ethers.utils.parseEther('0.00000000004') }
      );

      // const transaction = await web3packs.populateTransaction.bundleMode(
      //   await deployerSigner.getAddress(),
      //   globals.ipfsMetadata,
      //   ERC20SwapOrder,
      //   liquidityMintOrder,
      //   { ERC20Timelock: 0, ERC721Timelock: 0 },
      //   { value: ethers.utils.parseEther('0.0000000004') }
      // );

      console.log(tokenId)
      
    })
  })
});