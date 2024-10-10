import { expect } from 'chai';
import { ethers, network, getNamedAccounts } from 'hardhat';
import { Contract, Signer } from 'ethers';

import globals from '../js-helpers/globals';
import { _findNearestValidTick } from './utils';

import { Web3PacksMode } from '../typechain-types/contracts/Web3PacksMode.sol'
import IkimRouterABI from '../build/contracts/contracts/interfaces/IKimRouter.sol/IKimRouter.json'
import INonfungiblePositionManager from '../build/contracts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json';
import IBalancerVaultABI from '../build/contracts/contracts/interfaces/IBalancerV2Vault.sol/IBalancerV2Vault.json';

import {
  default as Charged,
  chargedStateAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";

const RouterType = {
  UniswapV2: 0n,
  UniswapV3: 1n,
  Velodrome: 2n,
  Balancer: 3n,
};

const toBytes32 = (text) => ethers.utils.formatBytes32String(text);
const WETH_BYTES32 = toBytes32('WETH');

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

  let IBalancerV2Vault;
  let balancerVault: Contract;

  let IKimManager;
  let kimManager: Contract;

  beforeEach(async () => {
    const { treasury, deployer } = await getNamedAccounts();

    web3packs = await ethers.getContract('Web3PacksMode') as Web3PacksMode;
    TestNFT = await ethers.getContract('ERC721Mintable');

    ownerSigner = await ethers.getSigner(treasury);
    deployerSigner = await ethers.getSigner(deployer);
    testSigner = ethers.Wallet.fromMnemonic(`${process.env.TESTNET_MNEMONIC}`.replace(/_/g, ' '));
    charged = new Charged({ providers: network.provider , signer: testSigner });

    wETH = new Contract(globals.wrapETHAddress, globals.wethAbi, deployerSigner);

    IVelodromeRouter = new ethers.utils.Interface(globals.velodromeRouterAbi);
    velodromeRouter = new Contract(globals.velodromeRouter, IVelodromeRouter, deployerSigner);

    IKimRouter = new ethers.utils.Interface(IkimRouterABI.abi);
    kimRouter = new Contract(globals.kimRouterMode, IKimRouter, deployerSigner);

    IBalancerV2Vault = new ethers.utils.Interface(IBalancerVaultABI.abi);
    balancerVault = new Contract(globals.balancerVault, IBalancerV2Vault, deployerSigner);

    IKimManager = new ethers.utils.Interface(INonfungiblePositionManager.abi);
    kimManager = new Contract(globals.KimNonfungibleTokenPosition, IKimManager, deployerSigner);

    Proton = new ethers.Contract(
      globals.protonMode,
      protonBAbi,
      ownerSigner
    );
  });

  beforeEach(async() => {
    const { treasury } = await getNamedAccounts();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [treasury],
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
    liquidityUuid = toBytes32(''),
    poolId = ethers.constants.HashZero,
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
    } else if (routerType === RouterType.UniswapV3) {
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
    } else { // Balancer
      calldata = { data: toBytes32('') };
    }

    const swapOrder = {
      callData: <string>calldata.data,
      router: router.address,
      tokenIn,
      tokenOut,
      tokenAmountIn,
      tokenAmountOutMin: amountOutMinimum,
      payableAmountIn,
      routerType,
      poolId,
      liquidityUuid,
    };

    return swapOrder;
  };

  const _createLiquidityOrder = async ({
    token0,
    token1,
    stable = false,
    liquidityUuidToken0 = toBytes32(''),
    liquidityUuidToken1 = toBytes32(''),
    percentToken0 = 10000n, // 100%
    percentToken1 = 10000n, // 100%
    slippage = 300n, // 3%
    minimumLpTokens = 0n,
    tickLower = BigInt(_findNearestValidTick(60, true)),
    tickUpper = BigInt(_findNearestValidTick(60, false)),
    poolId = ethers.constants.HashZero,
    router = globals.KimNonfungibleTokenPosition,
    routerType = RouterType.UniswapV3,
  }) => {
    // craft call data
    const lpOrder = {
      router,
      token0,
      token1,
      stable,
      liquidityUuidToken0,
      liquidityUuidToken1,
      percentToken0,
      percentToken1,
      minimumLpTokens,
      slippage,
      tickLower,
      tickUpper,
      poolId,
      routerType,
    }
    return lpOrder;
  };

  const _callBundle = async ({
    contractCalls,
    swapOrders,
    lpOrders,
    packPriceEth,
    timelocks = { ERC20Timelock: 0, ERC721Timelock: 0 },
  }) => {
    const bundleFee = globals.protocolFee;

    const tokenId = await web3packs.callStatic.bundle(
      globals.ipfsMetadata,
      contractCalls ?? [],
      swapOrders ?? [],
      lpOrders ?? [],
      timelocks,
      packPriceEth.toBigInt(),
      { value: packPriceEth.add(bundleFee) }
    );

    const mintTx = await web3packs.bundle(
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
    lps,
  }) => {
    // Approve Web3Packs to Unbundle our Charged Particle
    const chargedState = new Contract(globals.chargedStateContractAddress, chargedStateAbi, deployerSigner);
    await chargedState.setApprovalForAll(Proton.address, tokenId.toNumber(), web3packs.address).then(tx => tx.wait());

    // Unbundle Pack
    const unbundleFee = globals.protocolFee;
    const unbundleTx = await web3packs.unbundle(
      deployer,
      Proton.address,
      tokenId.toNumber(),
      erc20TokenAddresses,
      nfts,
      lps,
      { value: unbundleFee },
    );
    const txReceipt = await unbundleTx.wait();
    const gasCost = ethers.BigNumber.from(txReceipt.cumulativeGasUsed.toBigInt() * txReceipt.effectiveGasPrice.toBigInt());

    return {gasCost};
  };

  describe('Balancer', async() => {
    it('Bundles a single asset', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.00001', 18);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for MODE using Balancer
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: packPriceEth,
        router: balancerVault,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      const web3pack = charged.NFT(Proton.address, tokenId.toNumber());

      // Check Pack for Mode Tokens
      let tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
      const modeTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
      expect(modeTokenAmount).to.be.gt(100);

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Bundles multiple assets', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.00001', 18);
      const wethForIonx = packPriceEth.div(2);
      const wethForMode = packPriceEth.div(2);
      // const wethForLP = packPriceEth.div(4);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for MODE using Balancer
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: wethForMode,
        router: balancerVault,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Swap WETH for IONX
      const swapOrder2 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.ionxTokenAddress,
        tokenAmountIn: wethForIonx,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [],
        packPriceEth,
      });

      const web3pack = charged.NFT(Proton.address, tokenId.toNumber());

      // Check Pack for Mode Tokens
      let tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
      const modeTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
      expect(modeTokenAmount).to.be.gt(100);

      // Check Pack for IONX Tokens
      tokenMass = await web3pack.getMass(globals.ionxTokenAddress, 'generic.B');
      const ionxTokenAmount = tokenMass[network.config.chainId ?? '']?.value;
      expect(ionxTokenAmount).to.be.gt(1);

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Bundles a Liquidity Position', async() => {
      const { deployer } = await getNamedAccounts();

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('weth-mode-1');

      const packPriceEth = ethers.utils.parseUnits('0.00001', 18);
      const wethForIonx = packPriceEth.mul(300).div(10000); // 3%
      const wethForMode = packPriceEth.mul(4850).div(10000); // 48.5%
      const remainingWeth = packPriceEth.sub(wethForIonx).sub(wethForMode); // 48.5%
      const wethForModeLP = remainingWeth.div(5);

      // Wrap ETH for WETH
      const wethCalldata = await wETH.populateTransaction.deposit();
      const contractCall1 = {
        callData: wethCalldata.data,
        contractAddress: globals.wrapETHAddress,
        amountIn: packPriceEth.toBigInt(),
      };

      // Swap WETH for MODE using Balancer
      const swapOrder1 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: wethForMode,
        router: balancerVault,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Swap WETH for IONX
      const swapOrder2 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.ionxTokenAddress,
        tokenAmountIn: wethForIonx,
      });

      // Swap WETH for MODE using Balancer
      const swapOrder3 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.modeTokenAddress,
        tokenAmountIn: wethForModeLP.mul(4), // 80% of remaining WETH
        liquidityUuid: liquidityUuidToken1,
        router: balancerVault,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Create LP Position using WETH/Mode
      // NOTE: Order of tokens must be in numerical order with the lowest token address (as int) comes first.
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
        minimumLpTokens: 1n,
        router: balancerVault.address,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2, swapOrder3 ],
        lpOrders: [ lpOrder1 ],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Unbundles a Liquidity Position', async() => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();
      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.00001', 18);
      const wethAmount = packPriceEth.div(5).mul(4);

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
        router: balancerVault,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
        minimumLpTokens: 1n,
        router: balancerVault.address,
        routerType: RouterType.Balancer,
        poolId: globals.balancerPoolId,
      });

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
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
        nfts: [],
        lps: [
          {
            token0: { token: globals.wrapETHAddress, amount: 0 },
            token1: { token: globals.modeTokenAddress, amount: 0 },
          }
        ]
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

  describe('KIM', () => {
    it('Bundles a single asset', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

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
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Bundles multiple assets', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

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
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
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
      const wethAmount = packPriceEth.div(2);

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
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [ lpOrder1 ],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Unbundles a Liquidity Position', async() => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();
      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

      const preModeTokenBalance = await MODE.balanceOf(deployer);
      const preWethTokenBalance = await WETH.balanceOf(deployer);

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
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
      });

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
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
        nfts: [],
        lps: [
          {
            token0: { token: globals.wrapETHAddress, amount: 0 },
            token1: { token: globals.modeTokenAddress, amount: 0 },
          }
        ]
      });

      // Check Pack for Mode Tokens
      tokenMass = await web3pack.getMass(globals.modeTokenAddress, 'generic.B');
      expect(tokenMass[network.config.chainId ?? '']?.value).to.eq(0);

      // Check Receiver for Mode Tokens
      const modeTokenBalance = await MODE.balanceOf(deployer);
      expect(modeTokenBalance).to.be.gt(preModeTokenBalance);

      // Check Receiver for WETH tokens
      const wethTokenBalance = await WETH.balanceOf(deployer);
      expect(wethTokenBalance).to.be.gt(preWethTokenBalance);
    });

    it('Bundles a Complex Liquidity Position', async() => {
      const { deployer } = await getNamedAccounts();

      const liquidityUuidMode = ethers.utils.formatBytes32String('swap-order-1');
      const liquidityUuidUsdc = ethers.utils.formatBytes32String('swap-order-2');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(4);

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
        liquidityUuid: liquidityUuidMode,
      });

      // Swap WETH for USDC
      const swapOrder2 = await _createSwapOrder({
        tokenIn: globals.wrapETHAddress,
        tokenOut: globals.ionxTokenAddress,
        tokenAmountIn: wethAmount,
        liquidityUuid: liquidityUuidUsdc,
      });

      // Create LP Position using WETH/Mode
      const lpOrder1 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.modeTokenAddress,
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1: liquidityUuidMode,
        percentToken0: 5000n,  // 50%
        percentToken1: 10000n, // 100%
      });

      // Create LP Position using WETH/USDC
      const lpOrder2 = await _createLiquidityOrder({
        token0: globals.wrapETHAddress,
        token1: globals.ionxTokenAddress,
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1: liquidityUuidUsdc,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
        slippage: 7500n, // extremely high slippage for this to pass
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [ lpOrder1, lpOrder2 ],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
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
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
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
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Bundles multiple assets', async() => {
      const { deployer } = await getNamedAccounts();

      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

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
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1, swapOrder2 ],
        lpOrders: [],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Bundles a Liquidity Position', async () => {
      const { deployer } = await getNamedAccounts();

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

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
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
        router: globals.velodromeRouter,
        routerType: RouterType.Velodrome,
      });

      // Get Balance before Transaction for Test Confirmation
      const preBalance = (await ethers.provider.getBalance(deployer)).toBigInt();

      // Bundle Pack
      const {tokenId, gasCost} = await _callBundle({
        contractCalls: [ contractCall1 ],
        swapOrders: [ swapOrder1 ],
        lpOrders: [ lpOrder1 ],
        packPriceEth,
      });

      // Expect REFUND on Excessive Fees
      const expectedBalance = preBalance - packPriceEth.toBigInt() - globals.protocolFee.toBigInt() - gasCost.toBigInt();
      const postBalance = (await ethers.provider.getBalance(deployer)).toBigInt();
      expect(postBalance).to.eq(expectedBalance);
    });

    it('Unbundles a Liquidity Position', async () => {
      const MODE = new Contract(globals.modeTokenAddress, globals.erc20Abi, deployerSigner);
      const WETH = new Contract(globals.wrapETHAddress, globals.erc20Abi, deployerSigner);

      const { deployer } = await getNamedAccounts();

      const liquidityUuidToken1 = ethers.utils.formatBytes32String('swap-order-1');
      const packPriceEth = ethers.utils.parseUnits('0.001', 18);
      const wethAmount = packPriceEth.div(2);

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
        liquidityUuidToken0: WETH_BYTES32,
        liquidityUuidToken1,
        percentToken0: 10000n, // 100%
        percentToken1: 10000n, // 100%
        router: globals.velodromeRouter,
        routerType: RouterType.Velodrome,
      });

      // Bundle Pack
      const {tokenId} = await _callBundle({
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
        nfts: [],
        lps: [
          {
            token0: { token: globals.wrapETHAddress, amount: 0 },
            token1: { token: globals.modeTokenAddress, amount: 0 },
          }
        ]
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
      nfts: [],
      lps: []
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

  it('Should send protocol fees to treasury', async () => {
    const { treasury } = await getNamedAccounts();
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
        globals.ipfsMetadata,
        [ contractCall1 ],
        [ swapOrder1 ],
        [],
        { ERC20Timelock: 0, ERC721Timelock: 0 },
        packPriceEth.toBigInt(),
        { value: packPriceEth }
      )
    ).to.be.revertedWithCustomError(web3packs, 'InsufficientForFee');

    // Bundle Pack
    await _callBundle({
      contractCalls: [ contractCall1 ],
      swapOrders: [ swapOrder1 ],
      lpOrders: [],
      packPriceEth,
    });

    const treasuryBalance = await provider.getBalance(treasury);
    expect(treasuryBalance).to.be.gte(bundleFee.toNumber());
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
