import { expect } from "chai"; 
import { ethers, network, getNamedAccounts } from 'hardhat';
import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";
import { Contract, providers, Signer } from "ethers";
import globals from "./globals";
import { Web3PacksMode } from '../typechain-types/contracts/Web3PacksMode.sol'

import IkimRouterABI from '../build/contracts/contracts/IKimRouter.sol/IKimRouter.json'


describe('Web3Packs', async ()=> {
  // Define contracts
  let web3packs: Web3PacksMode, Proton: Contract, TestNFT: Contract; 
  let charged: Charged;
  // Define signers
  let ownerSigner: Signer, testSigner: Signer, deployerSigner: Signer;

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

  describe('KIM', () => {
    it('Swap a single asset KIM', async() => {
      const amountIn = ethers.utils.parseUnits('10', 6);
  
      const callDataParams = {
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        recipient: web3packs.address,
        deadline: globals.deadline,
        amountIn: amountIn,
        amountOutMinimum: 0n,
        limitSqrtPrice: 0n 
      };
  
      const KimRouterInter = new ethers.utils.Interface(IkimRouterABI.abi);
      const kimContract = new Contract('0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8', KimRouterInter, deployerSigner);
      const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);
      
      const ERC20SwapOrder = {
        callData: <string>calldata.data,
        router: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
        tokenIn: globals.wrapETHAddress,
        amountIn: amountIn,
        tokenOut: globals.modeTokenAddress,
        forLiquidity: false,
      };
  
      const swapTransaction = await web3packs.swapGeneric(ERC20SwapOrder, { value: ethers.utils.parseUnits('20', 6) });
      await swapTransaction.wait();
  
      const token = new ethers.Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);
      expect(balanceAfterSwap).to.be.above(0);
    });
  });

  describe('Velodrome', async() => {
    it('Swaps to single path route', async() => {
      const amountIn = ethers.utils.parseUnits('10', 6);

      // swapExactETHForTokens(uint256 amountOutMin, (address,address,bool)[] routes, address to, uint256 deadline)
      const velodromeParams = {
        // amountIn: amountIn,
        amountOutMin: 0,
        routes: [ [globals.wrapETHAddress, '0x18470019bf0e94611f15852f7e93cf5d65bc34ca', false] ],
        to: web3packs.address,
        deadline: globals.deadline
      };

      const inter = new ethers.utils.Interface(['function swapExactETHForTokens(uint256 amountOutMin, (address,address,bool)[] routes, address to, uint256 deadline)']);
      const calldata = inter.encodeFunctionData('swapExactETHForTokens', Object.values(velodromeParams));

      const ERC20SwapOrder = {
        callData: <string>calldata,
        router: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
        tokenIn: globals.wrapETHAddress,
        amountIn: amountIn,
        tokenOut: '0x18470019bf0e94611f15852f7e93cf5d65bc34ca',
        forLiquidity: false, 
      }

      const swapTransaction = await web3packs.swapGeneric(ERC20SwapOrder, { value: amountIn });
      await swapTransaction.wait();

      const token = new ethers.Contract('0x18470019bf0e94611f15852f7e93cf5d65bc34ca', globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);
      expect(balanceAfterSwap).to.be.above(0);
    });

    it('Swaps multiple path route', async() => {
      const amountIn = ethers.utils.parseUnits('11', 6);
      const outToken = '0x95177295a394f2b9b04545fff58f4af0673e839d';

      // swapExactETHForTokens(uint256 amountOutMin, (address,address,bool)[] routes, address to, uint256 deadline)
      const velodromeParams = {
        // amountIn: amountIn,
        amountOutMin: 0,
        routes: [
          [globals.wrapETHAddress, globals.modeTokenAddress, false],
          [globals.modeTokenAddress, outToken, false],
        ],
        to: web3packs.address,
        deadline: globals.deadline
      };

      const inter = new ethers.utils.Interface(['function swapExactETHForTokens(uint256 amountOutMin, (address,address,bool)[] routes, address to, uint256 deadline)']);
      const calldata = inter.encodeFunctionData('swapExactETHForTokens', Object.values(velodromeParams));

      const ERC20SwapOrder = {
        callData: <string>calldata,
        router: '0x3a63171DD9BebF4D07BC782FECC7eb0b890C2A45',
        tokenIn: globals.wrapETHAddress,
        amountIn: amountIn,
        tokenOut: outToken,
        forLiquidity: false, 
      }

      const swapTransaction = await web3packs.swapGeneric(ERC20SwapOrder, { value: amountIn });
      await swapTransaction.wait();

      const token = new ethers.Contract(outToken, globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);
      expect(balanceAfterSwap).to.be.above(0);
    });
  });

  it('Bundles token with two swaps and then unbundles the nft', async() => {
    const amountIn = ethers.utils.parseUnits('10', 6);
    const fee = BigInt(0);

    const callDataParams = {
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.modeTokenAddress,
      recipient: web3packs.address,
      deadline: globals.deadline,
      amountIn: amountIn,
      amountOutMinimum: 0n,
      limitSqrtPrice: 0n 
    };

    const KimRouterInter = new ethers.utils.Interface(IkimRouterABI.abi);
    const kimContract = new Contract('0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8', KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
      tokenIn: globals.wrapETHAddress,
      amountIn: amountIn,
      tokenOut: globals.modeTokenAddress,
      forLiquidity: false,
    }];
    
    const newTokenId = await web3packs.callStatic.bundleMode(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      fee, 
      { value: amountIn }
    );

    const bundleTransaction = await web3packs.bundleMode(
      await deployerSigner.getAddress(),
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock: 0, ERC721Timelock: 0 },
      fee,
      { value: amountIn }
    );

    await bundleTransaction.wait();

    const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());
    const tkenMass = await bundToken.getMass(globals.modeTokenAddress, 'generic.B');
    expect(tkenMass[network.config.chainId ?? '']?.value).to.be.gt(1);

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

    const uniLeftInBundle = await bundToken.getMass(globals.modeTokenAddress, 'generic.B');
    expect(uniLeftInBundle[network.config.chainId ?? '']?.value).to.eq(0);

    const USDt = new ethers.Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner); 
    const balanceOfUSDtAfterRelease = await USDt.balanceOf(await deployerSigner.getAddress());

    expect(balanceOfUSDtAfterRelease.toNumber()).to.be.closeTo(2622550041690, 1311275020845);
  });

  it('Should not allow to break pack when locked: erc20s', async() => {
    const amountIn = ethers.utils.parseUnits('10', 6);
    const fee = BigInt(0);

    const callDataParams = {
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.modeTokenAddress,
      recipient: web3packs.address,
      deadline: globals.deadline,
      amountIn: amountIn,
      amountOutMinimum: 0n,
      limitSqrtPrice: 0n 
    };

    const KimRouterInter = new ethers.utils.Interface(IkimRouterABI.abi);
    const kimContract = new Contract('0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8', KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
      tokenIn: globals.wrapETHAddress,
      amountIn: amountIn,
      tokenOut: globals.modeTokenAddress,
      forLiquidity: false,
    }];

    const currentBlock = await ethers.provider.getBlockNumber() + 1000000; // todo: do not hardcode
    const timeLock = await ethers.provider.getBlockNumber() + 100;
    
    const newTokenId = await web3packs.callStatic.bundleMode(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      fee,
      { value: amountIn }
    );

    const bundleTransaction = await web3packs.bundleMode(
      await deployerSigner.getAddress(),
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock: timeLock, ERC721Timelock: 0 },
      fee,
      { value: amountIn }
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

  it('Check _returnPositiveSlippageNative', async() => {
    const web3packsAddress = web3packs.address;
    const provider = deployerSigner.provider!;
    const fee = BigInt(0);

    const packsContractBalanceBeforeSwap = await provider.getBalance(web3packsAddress);
    expect(packsContractBalanceBeforeSwap).to.be.eq(0n);

    const signerBalanceBeforeSwap = await deployerSigner.getBalance();

    // swap
    const amountInSwap = ethers.utils.parseUnits('10', 6);
    const amountInContract = ethers.utils.parseUnits('20', 6);
    const returnedAmount = amountInContract - amountInSwap;

    const callDataParams = {
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.modeTokenAddress,
      recipient: web3packs.address,
      deadline: globals.deadline,
      amountIn: amountInSwap,
      amountOutMinimum: 0n,
      limitSqrtPrice: 0n 
    };

    const KimRouterInter = new ethers.utils.Interface(IkimRouterABI.abi);
    const kimContract = new Contract('0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8', KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
      tokenIn: globals.wrapETHAddress,
      amountIn: amountInSwap,
      tokenOut: globals.modeTokenAddress,
      forLiquidity: false,
    }];
    const newTokenId = await web3packs.callStatic.bundleMode(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      fee,
      { value: amountInContract }
    );

    const bundleTransaction = await web3packs.bundleMode(
      await deployerSigner.getAddress(),
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock: 0, ERC721Timelock: 0 },
      fee,
      { value: amountInContract }
    ).then(tx => tx.wait());

    const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());
    const tkenMass = await bundToken.getMass(globals.modeTokenAddress, 'generic.B');
    expect(tkenMass[network.config.chainId ?? '']?.value).to.be.gt(1);

    const packsContractBalanceAfterSwap = await provider.getBalance(web3packsAddress);
    expect(packsContractBalanceAfterSwap).to.be.eq(0n);

    const signerBalanceAfterSwap = await deployerSigner.getBalance();
    const gasUsed = bundleTransaction.gasUsed; // Amount of gas used
    const gasPrice = bundleTransaction.effectiveGasPrice; // Price per unit of gas
    const totalCost = gasUsed.mul(gasPrice);

    const difference = signerBalanceAfterSwap.add(amountInSwap).add(totalCost);
    expect(signerBalanceBeforeSwap).to.be.eq(difference);
  });

  it('Test fee', async () => {
    const provider = ownerSigner.provider!;
    const amountInSwap = ethers.utils.parseUnits('1', 8);
    const amountInContract = ethers.utils.parseUnits('11', 8);
    const fee = BigInt(100);

    const callDataParams = {
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.modeTokenAddress,
      recipient: web3packs.address,
      deadline: globals.deadline,
      amountIn: amountInSwap,
      amountOutMinimum: 0n,
      limitSqrtPrice: 0n 
    };

    const KimRouterInter = new ethers.utils.Interface(IkimRouterABI.abi);
    const kimContract = new Contract('0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8', KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router: '0xAc48FcF1049668B285f3dC72483DF5Ae2162f7e8',
      tokenIn: globals.wrapETHAddress,
      amountIn: amountInSwap,
      tokenOut: globals.modeTokenAddress,
      forLiquidity: false,
    }];

    await expect(web3packs.callStatic.bundleMode(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      BigInt(10000000000),
      { value: amountInContract }
    )).to.revertedWith('InsufficientForFee');

    await web3packs.bundleMode(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      fee,
      { value: amountInContract }
    ).then(tx => tx.wait());

    const packBalance = await provider.getBalance(web3packs.address);
    expect(packBalance).to.be.eq(fee);
  });

  it ('Fails to execute not allow listed router', async() => {
    const ERC20SwapOrder = {
      callData: '0x',
      router: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
      tokenIn: globals.wrapETHAddress,
      amountIn: 1n,
      tokenOut: globals.modeTokenAddress,
      forLiquidity: false,
    };

    expect(web3packs.swapGeneric(ERC20SwapOrder, { value: ethers.utils.parseUnits('20', 6) })).to.throw;
  });

});