import { expect } from 'chai';
import { ethers, network, getNamedAccounts } from 'hardhat';
import { Contract, Signer } from 'ethers';

import globals from '../js-helpers/globals';
import { _findNearestValidTick } from './utils';

import { Web3PacksMode } from '../typechain-types/contracts/Web3PacksMode.sol'
import IkimRouterABI from '../build/contracts/contracts/interfaces/IKimRouter.sol/IKimRouter.json'
import INonfungiblePositionManager from '../build/contracts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
// import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json';
// import { abi as RouterV2ABI } from '@uniswap/v2-periphery/build/UniswapV2Router02.json';
import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";

const RouterType = {
  UniswapV2: 0n,
  UniswapV3: 1n,
  Velodrome: 2n,
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

  let IVelodromeRouter;
  let velodromeRouter: Contract;

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

    IVelodromeRouter = new ethers.utils.Interface(globals.velodromeRouterAbi);
    velodromeRouter = new Contract(globals.velodromeRouter, IVelodromeRouter, deployerSigner);

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
    routerPath = [] as any[][],
    liquidityUuid = ethers.utils.formatBytes32String(''),
  }) => {
    let calldata;

    if (routerType === RouterType.UniswapV2 || routerType === RouterType.Velodrome) {
      calldata = await router.populateTransaction[routerFunction](
        tokenAmountIn,
        amountOutMinimum,
        routerPath,
        recipient,
        globals.deadline
      );
    } else { // UniswapV3
      const callDataParams = {
        tokenIn,
        tokenOut,
        recipient,
        amountIn: tokenAmountIn,
        amountOutMinimum,
        limitSqrtPrice: 0n,
        deadline: globals.deadline,
      };
      calldata = await router.populateTransaction[routerFunction](callDataParams);
    }

    const swapOrder = {
      callData: <string>calldata.data,
      router: router.address,
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
    let calldata;

    if (routerType === RouterType.UniswapV2) {
      calldata = await lpManager.populateTransaction[routerFunction](
        token0,
        token1,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline
      );
    }
    else if (routerType === RouterType.Velodrome) {
      calldata = await lpManager.populateTransaction[routerFunction](
        token0,
        token1,
        false,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline
      );
    } else { // UniswapV3
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
      };
      calldata = await lpManager.populateTransaction[routerFunction](calldataParams);
    }

    // craft call data
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
    it('Bundles a single asset', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;

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
        tokenAmountIn: packPriceEth,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Bundles multiple assets', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;

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

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Bundles a Liquidity Position', async() => {
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
      // TODO: Get A QUOTE on this Amount:
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

    it('Unbundles a Liquidity Position', async() => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();
      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;
      // TODO: Get A QUOTE on this Amount:
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
    it('Bundles a single asset (single path route)', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for ION
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.ionTokenAddress,
        tokenAmountIn: packPriceEth,
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [ [globals.wrapETHAddress, globals.ionTokenAddress, false] ],
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Bundles a single asset (multi-path route)', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for USDC
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.USDcContractAddress,
        tokenAmountIn: packPriceEth,
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [
          [globals.wrapETHAddress, globals.modeTokenAddress, false],
          [globals.modeTokenAddress, globals.USDcContractAddress, false],
        ],
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Bundles multiple assets', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for ION
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.ionTokenAddress,
        tokenAmountIn: wethAmount,
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [ [globals.wrapETHAddress, globals.ionTokenAddress, false] ],
      });

      // Swap WETH for USDC
      const swapOrder2 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.USDcContractAddress,
        tokenAmountIn: wethAmount,
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [ [globals.wrapETHAddress, globals.USDcContractAddress, false] ],
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = await ethers.provider.getBalance(deployer);

      // Bundle Pack
      const {gasCost} = await _callBundle({
        deployer,
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance.toBigInt() - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = await ethers.provider.getBalance(deployer);
      expect(postBalance.toBigInt()).to.eq(expectedBalance);
    });

    it('Bundles a Liquidity Position', async () => {
      const { deployer } = await getNamedAccounts();

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;
      // TODO: Get A QUOTE on this Amount:
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
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [ [globals.wrapETHAddress, globals.modeTokenAddress, false] ],
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        amount0Desired: wethAmount,
        amount1Desired: modeAmount.toBigInt(),
        liquidityUuidToken1,
        lpManager: velodromeRouter,
        router: globals.velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'addLiquidity',
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

    it('Unbundles a Liquidity Position', async () => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth / 2;
      // TODO: Get A QUOTE on this Amount:
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
        router: velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'swapExactTokensForTokens',
        routerPath: [ [globals.wrapETHAddress, globals.modeTokenAddress, false] ],
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        amount0Desired: wethAmount,
        amount1Desired: modeAmount.toBigInt(),
        liquidityUuidToken1,
        lpManager: velodromeRouter,
        router: globals.velodromeRouter,
        routerType: RouterType.Velodrome,
        routerFunction: 'addLiquidity',
      });

      // Bundle Pack
      const {tokenId} = await _callBundle({
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

    // Check Receiver for Mode Tokens
    const modeTokenBalance = await MODE.balanceOf(deployer);
    expect(modeTokenBalance).to.be.gte(modeTokenAmount);

    // Check Receiver for USDC Tokens
    const usdcTokenBalance = await USDC.balanceOf(deployer);
    expect(usdcTokenBalance).to.be.gte(usdcTokenAmount);

    // Check Receiver for USDT Tokens
    const usdtTokenBalance = await USDT.balanceOf(deployer);
    expect(usdtTokenBalance).to.be.gte(usdtTokenAmount);
  });

  it('Should not allow to break pack when locked: erc20s', async() => {
    const { deployer } = await getNamedAccounts();

    const packPriceEth = ethers.utils.parseUnits('0.001', 18);

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
      tokenAmountIn: packPriceEth,
    });

    const timeLock = await ethers.provider.getBlockNumber() + 100;

    // Bundle Pack
    const {tokenId} = await _callBundle({
      deployer,
      contractCalls: [ contractCall1 ],
      swapOrders: [ swapOrder1 ],
      lpOrders: [],
      timelocks: { ERC20Timelock: timeLock, ERC721Timelock: 0 },
      packPriceEth,
    });

    // Charged settings contract
    const chargedState = new Contract(globals.chargedStateContractAddress, chargedStateAbi, deployerSigner);

    // setBreakBondApproval
    await chargedState.setApprovalForAll(
      Proton.address,
      tokenId.toNumber(),
      web3packs.address
    ).then((tx) => tx.wait());

    expect(web3packs.unbundle(
      deployer,
      Proton.address,
      tokenId.toNumber(),
      {
        erc20TokenAddresses: [ globals.modeTokenAddress ],
        nfts: []
      },
    )).to.be.revertedWith('CP:E-302');
  });

  it('Should hold protocol fee in contract', async () => {
    const { deployer } = await getNamedAccounts();
    const provider = ownerSigner.provider!;
    const packPriceEth = ethers.utils.parseUnits('0.001', 18);
    const bundleFee = globals.protocolFee;

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
      tokenAmountIn: packPriceEth,
    });

    // Attempt Bundle without Fee
    expect(
      web3packs.bundle(
        deployer,
        globals.ipfsMetadata,
        [ contractCall1 ],
        [ swapOrder1 ],
        [],
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        packPriceEth.toBigInt(),
        { value: packPriceEth }
      )
    ).to.be.revertedWithCustomError(web3packs, 'InsufficientForFee()');

    // Bundle Pack
    await _callBundle({
      deployer,
      contractCalls: [ contractCall1 ],
      swapOrders: [ swapOrder1 ],
      lpOrders: [],
      packPriceEth,
    });

    const packBalance = await provider.getBalance(web3packs.address);
    expect(packBalance).to.be.gte(bundleFee.toNumber());
  });

  it('Fails to execute not allow listed router', async() => {
    const { deployer } = await getNamedAccounts();
    const packPriceEth = ethers.utils.parseUnits('0.001', 18);
    const bundleFee = globals.protocolFee;

    const IDummyRouter = new ethers.utils.Interface(IkimRouterABI.abi);
    const dummyRouter = new Contract(globals.protonMode, IDummyRouter, deployerSigner);

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
      tokenAmountIn: packPriceEth,
      router: dummyRouter,
      routerType: RouterType.UniswapV3,
    });

    // Attempt Bundle Pack
    expect(
      web3packs.bundle(
        deployer,
        globals.ipfsMetadata,
        [ contractCall1 ],
        [ swapOrder1 ],
        [],
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        packPriceEth.toBigInt(),
        { value: packPriceEth.add(bundleFee) }
      )
    ).to.be.revertedWithCustomError(web3packs, 'ContractNotAllowed()');
  });
});
