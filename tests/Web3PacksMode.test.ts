import { expect } from 'chai';
import { ethers, network, getNamedAccounts } from 'hardhat';
import { Contract, Signer } from 'ethers';

import globals from '../js-helpers/globals';
import { _findNearestValidTick } from './utils';

import { Web3PacksMode } from '../typechain-types/contracts/Web3PacksMode.sol'
import IkimRouterABI from '../build/contracts/contracts/interfaces/IKimRouter.sol/IKimRouter.json'
import INonfungiblePositionManager from '../build/contracts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
// import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json';
import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";

const RouterType = {
  UniswapV2: 0n,
  UniswapV3: 1n,
};

describe('Web3Packs', async ()=> {
  // Define contracts
  let web3packs: Web3PacksMode;
  let Proton: Contract;
  let TestNFT: Contract;
  let charged: Charged;
  let wETH: Contract;

  // Define signers
  let ownerSigner: Signer;
  let testSigner: Signer;
  let deployerSigner: Signer;

  let IKimRouter;
  let kimRouter: Contract;

  let IKimManager;
  let kimManager: Contract;

  beforeEach(async () => {
    const { protocolOwner, deployer } = await getNamedAccounts();

    web3packs = await ethers.getContract('Web3PacksMode') as Web3PacksMode;
    TestNFT = await ethers.getContract('ERC721Mintable');

    ownerSigner = await ethers.getSigner(protocolOwner);
    deployerSigner = await ethers.getSigner(deployer);
    testSigner = ethers.Wallet.fromMnemonic(`${process.env.TESTNET_MNEMONIC}`.replace(/_/g, ' '));
    charged = new Charged({ providers: network.provider , signer: testSigner });

    wETH = new Contract(globals.wrapETHAddress, globals.wethAbi, deployerSigner);

    IKimRouter = new ethers.utils.Interface(IkimRouterABI.abi);
    kimRouter = new Contract(globals.kimRouterMode, IKimRouter, deployerSigner);

    IKimManager = new ethers.utils.Interface(INonfungiblePositionManager.abi);
    kimManager = new Contract(globals.KimNonfungibleTokenPosition, IKimManager, deployerSigner);

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

  const _createSwapOrder = async ({
    tokenIn,
    tokenOut,
    tokenAmountIn,
    payableAmountIn = 0n,
    amountOutMinimum = 0n,
    recipient = web3packs.address,
    router = kimRouter,
    routerType = RouterType.UniswapV3,
    routerFunction = 'exactInputSingle',
    liquidityUuid = ethers.utils.formatBytes32String(''),
  }) => {
    const callDataParams = {
      tokenIn,
      tokenOut,
      recipient,
      amountIn: tokenAmountIn,
      amountOutMinimum,
      limitSqrtPrice: 0n,
      deadline: globals.deadline,
    };

    const calldata = await router.populateTransaction[routerFunction](callDataParams);
    const routerAddress = router.address;

    const swapOrder = {
      callData: <string>calldata.data,
      router: routerAddress,
      tokenIn,
      tokenOut,
      tokenAmountIn,
      payableAmountIn,
      routerType,
      liquidityUuid,
    };
    return swapOrder;
  };

  const _createLiquidityOrder = async ({
    token0,
    token1,
    amount0Desired,
    amount1Desired,
    amount0Min = 0n,
    amount1Min = 0n,
    payableAmountIn = 0n,
    liquidityUuidToken0 = ethers.utils.formatBytes32String(''),
    liquidityUuidToken1 = ethers.utils.formatBytes32String(''),
    tickLower = BigInt(_findNearestValidTick(60, true)),
    tickUpper = BigInt(_findNearestValidTick(60, false)),
    recipient = web3packs.address,
    deadline = globals.deadline,
    lpManager = kimManager,
    router = globals.KimNonfungibleTokenPosition,
    routerType = RouterType.UniswapV3,
    routerFunction = 'mint',
  }) => {
    const calldataParams = {
      token0,
      token1,
      tickLower,
      tickUpper,
      amount0Desired,
      amount1Desired,
      amount0Min,
      amount1Min,
      recipient,
      deadline,
  }

    // craft call data
    const calldata = await lpManager.populateTransaction[routerFunction](calldataParams);
    const lpOrder = {
      callData: calldata.data,
      router,
      token0,
      token1,
      amount0ToMint: amount0Desired,
      amount1ToMint: amount1Desired,
      payableAmountIn,
      liquidityUuidToken0,
      liquidityUuidToken1,
      routerType,
    }
    return lpOrder;
  };

  const _callBundle = async ({
    deployer,
    contractCalls,
    swapOrders,
    lpOrders,
    packPriceEth,
    timelocks = { ERC20Timelock: 0, ERC721Timelock: 0 },
  }) => {
    const bundleFee = globals.protocolFee;

    const tokenId = await web3packs.callStatic.bundle(
      deployer,
      globals.ipfsMetadata,
      contractCalls ?? [],
      swapOrders ?? [],
      lpOrders ?? [],
      timelocks,
      packPriceEth.toBigInt(),
      { value: packPriceEth.add(bundleFee) }
    );

    const mintTx = await web3packs.bundle(
      deployer,
      globals.ipfsMetadata,
      contractCalls ?? [],
      swapOrders ?? [],
      lpOrders ?? [],
      timelocks,
      packPriceEth.toBigInt(),
      { value: packPriceEth.add(bundleFee) }
    );
    const txReceipt = await mintTx.wait();
    const gasCost = ethers.BigNumber.from(txReceipt.cumulativeGasUsed.toBigInt() * txReceipt.effectiveGasPrice.toBigInt());

    return {tokenId, gasCost};
  };

  const _callUnbundle = async ({
    deployer,
    tokenId,
    erc20TokenAddresses,
    nfts,
  }) => {
    // Approve Web3Packs to Unbundle our Charged Particle
    const chargedState = new Contract(globals.chargedStateContractAddress, chargedStateAbi, deployerSigner);
    await chargedState.setApprovalForAll(Proton.address, tokenId.toNumber(), web3packs.address).then(tx => tx.wait());

    // Unbundle Pack
    const unbundleTx = await web3packs.unbundle(
      deployer,
      Proton.address,
      tokenId.toNumber(),
      { erc20TokenAddresses, nfts },
    );
    const txReceipt = await unbundleTx.wait();
    const gasCost = ethers.BigNumber.from(txReceipt.cumulativeGasUsed.toBigInt() * txReceipt.effectiveGasPrice.toBigInt());

    return {gasCost};
  };

  describe('KIM', () => {
    it('Provides liquidity', async() => {
      const { deployer } = await getNamedAccounts();

      // TODO:
      //  Calculate amount of ETH for LP (ex: 20% of ETH for a Position in TokenA/TokenB pair)
      //  1. Calculate amount of TokenA required to balance with TokenB:
      //     - 10% of ETH buys X amount of TokenA
      //     - 10% of ETH buys X amount of TokenB
      //  2. Prepare in the Swap Order with "Assumed Amounts"
      //  3. Prepare the Liquidity order with a 3% reduction in the "Assumed Amounts" to ensure enough tokens for the Position
      //  4. Refund any extra balance of TokenA and TokenB when the LP Fees are claimed.

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;
      const modeAmount = ethers.utils.parseUnits('95.0', 18);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for Mode
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: wethAmount,
        liquidityUuid: liquidityUuidToken1,
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        amount0Desired: wethAmount,
        amount1Desired: modeAmount.toBigInt(),
        liquidityUuidToken1,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [ lpOrder1 ],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Removes liquidity', async() => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();
      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;
      const modeAmount = ethers.utils.parseUnits('95.0', 18);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for Mode
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: wethAmount,
        liquidityUuid: liquidityUuidToken1,
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        amount0Desired: wethAmount,
        amount1Desired: modeAmount.toBigInt(),
        liquidityUuidToken1,
      });

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [ lpOrder1 ],
        packPriceEth,
      });

      const web3pack = charged.NFT(Proton.address, tokenId.toNumber());

      // Check Pack for Mode Tokens
      let tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
      expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

      // TODO: Test for LP NFT in Pack

      // Unbundle Pack
      await _callUnbundle({
        deployer,
        tokenId,
        erc20TokenAddresses: [],
        nfts: []
      });

      // Check Pack for Mode Tokens
      tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
      expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

      // Check Receiver for Mode Tokens
      const modeTokenBalance = await MODE.balanceOf(deployer);
      expect(modeTokenBalance).to.be.gt(0);

      // Check Receiver for WETH tokens
      const wethTokenBalance = await WETH.balanceOf(deployer);
      expect(wethTokenBalance).to.be.gt(0);
    });
  });

  describe('Velodrome', async() => {
    xit('Swaps to single path route', async() => {
      const amountIn = ethers.utils.parseUnits('10', 6);

      const velodromeParams = {
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
        routerType: RouterType.UniswapV2,
      }

      const swapTransaction = await web3packs.swapGeneric(ERC20SwapOrder, { value: amountIn });
      await swapTransaction.wait();

      const token = new ethers.Contract('0x18470019bf0e94611f15852f7e93cf5d65bc34ca', globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);
      expect(balanceAfterSwap).to.be.above(0);
    });

    xit('Swaps multiple path route', async() => {
      const amountIn = ethers.utils.parseUnits('11', 6);
      const outToken = '0x95177295a394f2b9b04545fff58f4af0673e839d';

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
        routerType: RouterType.UniswapV2,
      }

      const swapTransaction = await web3packs.swapGeneric(ERC20SwapOrder, { value: amountIn });
      await swapTransaction.wait();

      const token = new ethers.Contract(outToken, globals.erc20Abi, deployerSigner);
      const balanceAfterSwap = await token.balanceOf(web3packs.address);
      expect(balanceAfterSwap).to.be.above(0);
    });
  });

  it('Bundles with three swaps and then unbundles the nft', async() => {
    const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
    const USDC = new Contract(globals.USDcContractAddress, globals.erc20Abi, deployerSigner);
    const USDT = new Contract(globals.USDtContractAddress, globals.erc20Abi, deployerSigner);

    const { deployer } = await getNamedAccounts();
    const packPriceEth = ethers.utils.parseUnits('0.001', 18);
    const wethAmount = ethers.utils.parseUnits('0.000333333333333333', 18);

    // Wrap ETH for WETH
    const wethCalldata = await wETH.populateTransaction.deposit();
    const contractCall1 = {
      callData: wethCalldata.data,
      contractAddress: globals.wrapETHAddress,
      amountIn: packPriceEth.toBigInt(),
    };

    // Swap WETH for Mode
    const swapOrder1 = await _createSwapOrder({
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.modeTokenAddress,
      tokenAmountIn: wethAmount,
    });

    // Swap WETH for USDC
    const swapOrder2 = await _createSwapOrder({
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.USDcContractAddress,
      tokenAmountIn: wethAmount,
    });

    // Swap WETH for USDT
    const swapOrder3 = await _createSwapOrder({
      tokenIn: globals.wrapETHAddress,
      tokenOut: globals.USDtContractAddress,
      tokenAmountIn: wethAmount,
    });

    // Bundle Pack
    const {tokenId} = await _callBundle({
      deployer,
      contractCalls: [ contractCall1 ],
      swapOrders: [ swapOrder1, swapOrder2, swapOrder3 ],
      lpOrders: [],
      packPriceEth,
    });

    const web3pack = charged.NFT(Proton.address, tokenId.toNumber());

    // Check Pack for Mode Tokens
    let tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
    const modeTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
    expect(modeTokenAmount).to.be.gt(1);

    // Check Pack for USDC Tokens
    tokenMass = await web3pack.getMass(globals.USDcContractAddress, 'generic.B');
    const usdcTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
    expect(usdcTokenAmount).to.be.gt(1);

    // Check Pack for USDT Tokens
    tokenMass = await web3pack.getMass(globals.USDtContractAddress, 'generic.B');
    const usdtTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
    expect(usdtTokenAmount).to.be.gt(1);

    // Unbundle Pack
    await _callUnbundle({
      deployer,
      tokenId,
      erc20TokenAddresses: [
        globals.modeTokenAddress,
        globals.USDcContractAddress,
        globals.USDtContractAddress,
      ],
      nfts: []
    });

    // Check Pack for Mode Tokens
    tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
    expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

    // Check Pack for USDC Tokens
    tokenMass = await web3pack.getMass(globals.USDcContractAddress, 'generic.B');
    expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

    // Check Pack for USDT Tokens
    tokenMass = await web3pack.getMass(globals.USDtContractAddress, 'generic.B');
    expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

    // Check Receiver for Pack Tokens
    const modeTokenBalance = await MODE.balanceOf(deployer);
    expect(modeTokenBalance).to.be.gte(modeTokenAmount);

    const usdcTokenBalance = await USDC.balanceOf(deployer);
    expect(usdcTokenBalance).to.be.gte(usdcTokenAmount);

    const usdtTokenBalance = await USDT.balanceOf(deployer);
    expect(usdtTokenBalance).to.be.gte(usdtTokenAmount);
  });

  xit('Should not allow to break pack when locked: erc20s', async() => {
    const amountIn = ethers.utils.parseUnits('0.001', 18);

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
    const kimContract = new Contract(globals.kimRouterMode, KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router:globals.kimRouterMode,
      tokenIn: globals.wrapETHAddress,
      amountIn: amountIn,
      tokenOut: globals.modeTokenAddress,
      routerType: RouterType.UniswapV3,
    }];

    const currentBlock = await ethers.provider.getBlockNumber() + 1000000; // todo: do not hardcode
    const timeLock = await ethers.provider.getBlockNumber() + 100;

    const newTokenId = await web3packs.callStatic.bundle(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      [],
      { ERC20Timelock: timeLock, ERC721Timelock: 0 },
      { value: globals.protocolFee.add(amountIn) }
    );

    const bundleTransaction = await web3packs.bundle(
      await deployerSigner.getAddress(),
      globals.ipfsMetadata,
      ERC20SwapOrder,
      [],
      { ERC20Timelock: timeLock, ERC721Timelock: 0 },
      { value: globals.protocolFee.add(amountIn) }
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

  xit('Test fee', async () => {
    const provider = ownerSigner.provider!;
    const amountInSwap = ethers.utils.parseUnits('1', 8);
    const amountInContract = ethers.utils.parseUnits('11', 8);

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
    const kimContract = new Contract(globals.kimRouterMode, KimRouterInter, deployerSigner);
    const calldata = await kimContract.populateTransaction.exactInputSingle(callDataParams);

    const ERC20SwapOrder = [{
      callData: <string>calldata.data,
      router:globals.kimRouterMode,
      tokenIn: globals.wrapETHAddress,
      amountIn: amountInSwap,
      tokenOut: globals.modeTokenAddress,
      routerType: RouterType.UniswapV3,
    }];

    await expect(web3packs.callStatic.bundle(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      [],
      { ERC20Timelock: 0 , ERC721Timelock: 0 },
      { value: amountInSwap }
    )).to.revertedWith('InsufficientForFee');

    await web3packs.bundle(
      globals.testAddress,
      globals.ipfsMetadata,
      ERC20SwapOrder,
      [],
      { ERC20Timelock:0 , ERC721Timelock: 0 },
      { value: globals.protocolFee.add(amountInSwap) }
    ).then(tx => tx.wait());

    const packBalance = await provider.getBalance(web3packs.address);
    expect(packBalance).to.be.eq(globals.protocolFee);
  });

  xit ('Fails to execute not allow listed router', async() => {
    const ERC20SwapOrder = {
      callData: '0x',
      router: '0x76a5df1c6F53A4B80c8c8177edf52FBbC368E825',
      tokenIn: globals.wrapETHAddress,
      amountIn: 1n,
      tokenOut: globals.modeTokenAddress,
      routerType: RouterType.UniswapV2,
    };

    expect(web3packs.swapGeneric(ERC20SwapOrder, { value: ethers.utils.parseUnits('20', 6) })).to.throw;
  });

});
