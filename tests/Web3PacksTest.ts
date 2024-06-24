import { expect } from "chai"; 
import { ethers, network, getNamedAccounts } from 'hardhat';
import {
  default as Charged,
  chargedStateAbi,
  chargedSettingsAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";
import { BigNumber, Contract, Signer } from "ethers";
import { USDC_USDT_SWAP } from "../uniswap/libs/constants";
import { amountOutMinimum, getNearestUsableTick, getPoolConstants, quote } from "../uniswap/quote";
import { getPoolContract } from "../uniswap/quote";
import globals from "./globals";

const ipfsMetadata = 'Qmao3Rmq9m38JVV8kuQjnL3hF84cneyt5VQETirTH1VUST';
const deadline = Math.floor(Date.now() / 1000) + (60 * 10);

describe('Web3Packs', async ()=> {
  // Define contracts
  let web3packs: Contract, USDc: Contract, TestNFT: Contract, Proton: Contract, Uni: Contract; 

  // Define signers
  let USDcWhaleSigner: Signer, ownerSigner: Signer, testSigner: Signer;

  let charged: Charged;

  beforeEach(async () => {
    // await deployments.fixture();
    // web3packs = await ethers.getContract('Web3Packs');
    // TestNFT = await ethers.getContract('ERC721Mintable');
  });

  beforeEach(async () => {
    const { protocolOwner } = await getNamedAccounts();

    web3packs = await ethers.getContract('Web3Packs');
    TestNFT = await ethers.getContract('ERC721Mintable');

    ownerSigner = await ethers.getSigner(protocolOwner);
    testSigner = ethers.Wallet.fromMnemonic(process.env.TESTNET_MNEMONIC ?? '');

    charged = new Charged({ providers: network.provider , signer: testSigner });

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
    
    Proton = new ethers.Contract(
      '0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC',
      protonBAbi,
      ownerSigner
    );
    // Whitelist custom NFT
    const ChargedSettingContract = new ethers.Contract(
      '0x07DdB208d52947320d07E0E4611a80Fb7eFD001D',
      chargedSettingsAbi,
      ownerSigner 
    );
  });

  describe('Web3Packs', async () => {
    it('Should have 3 USDc', async() => {
      const balance = await USDc.balanceOf(web3packs.address);
      expect(balance).to.equal('100000000');
    });

    it('Swap a single asset', async() => {
      // calculate expected amount
      const swapEstimation = await quote(USDC_USDT_SWAP);
      const swapPriceTolerance = amountOutMinimum(swapEstimation, 10) ;

      const ERC20SwapOrder = [{
        inputTokenAddress: globals.USDcContractAddress,
        outputTokenAddress: globals.USDtContractAddress,
        inputTokenAmount: ethers.utils.parseUnits('10', 6),
        uniSwapPoolFee: 3000,
        deadline: deadline,
        amountOutMinimum: swapPriceTolerance,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait()

      const USDt = new ethers.Contract(globals.USDtContractAddress, globals.erc20Abi, USDcWhaleSigner);
      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(9982205);
    });

    it('Swap one assets with matic', async() => {
      const inputTokenAmount = ethers.utils.parseEther('10');
      const ERC20SwapOrder = [{
        inputTokenAddress: globals.wrapMaticContractAddress,
        outputTokenAddress: globals.USDcContractAddress,
        uniSwapPoolFee: 500,
        inputTokenAmount,
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder, { value: inputTokenAmount });
      await swapTransaction.wait();

      const USDcBalanceAfterSwap = await USDc.connect(ethers.provider).balanceOf(web3packs.address);

      expect(USDcBalanceAfterSwap).to.equal(296938484);
    });

    it('Swap two assets with matic', async() => {
      // Balances before swap
      const usdcBeforeSwap = await USDc.balanceOf(web3packs.address);
      const uniBeforeSwap = await Uni.balanceOf(web3packs.address);

      const inputTokenAmount = ethers.utils.parseEther('10');
      const ERC20SwapOrder = [{
        inputTokenAddress: globals.wrapMaticContractAddress,
        outputTokenAddress: globals.USDcContractAddress,
        uniSwapPoolFee: 500,
        inputTokenAmount: inputTokenAmount.div(2),
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      },
      {
        inputTokenAddress: globals.wrapMaticContractAddress,
        outputTokenAddress: globals.UniContractAddress,
        uniSwapPoolFee: 3000,
        inputTokenAmount: inputTokenAmount.div(2),
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder, { value: inputTokenAmount });
      await swapTransaction.wait();

      const usdcAfterSwap = await USDc.balanceOf(web3packs.address);
      const uniAfterSwap = await Uni.balanceOf(web3packs.address);

      expect(usdcAfterSwap).to.be.gt(usdcBeforeSwap);
      expect(uniAfterSwap).to.be.gt(uniBeforeSwap);
    });

    it('Swaps multiple assets', async() => {
      const ERC20SwapOrder = [
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: USDtContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: UniContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait();

      const USDtBalanceAfterSwap = await USDc.balanceOf(web3packs.address);
      const UNIBalanceAfterSwap = await Uni.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(500407703);
      expect(UNIBalanceAfterSwap.toString()).to.equal('493373764498692278');
    });


    it('Bundles singled swap asset', async() => {
      const ERC20SwapOrder = [{
        inputTokenAddress: globals.USDcContractAddress,
        outputTokenAddress: globals.USDtContractAddress,
        inputTokenAmount: 10,
        uniSwapPoolFee: 3000,
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const ERC712MintOrder = [
        {
          erc721TokenAddress: Proton.address,
          tokenMetadataUri: 'QmVHsu8L3n9rVhwNKiCozaH9Dgy9KtHWFihrejjVTPvvN8',
          basketManagerId: 'generic.B'
        },
        {
          erc721TokenAddress: Proton.address,
          tokenMetadataUri: 'QmRgKrUcX2UUZeBGLxJBWvNxoeGqpHpA5mLPBx1EGQMaFc',
          basketManagerId: 'generic.B'
        },
      ];

      const newTokenId = await web3packs.callStatic.bundle(
        globals.testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ERC712MintOrder,
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );
      
      const bundleTransaction = await web3packs.bundle(
        globals.testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ERC712MintOrder,
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );
      
      await bundleTransaction.wait();
      const energizedProton = charged.NFT(Proton.address, newTokenId.toString());

      const protonBondBalance = await energizedProton.getBonds('generic.B'); 
      expect(protonBondBalance['137']?.value).to.eq(2);
    });

    it('Bundles token with two swaps and then unbundles the nft', async() => {
      const connectedWallet = testSigner.connect(ethers.provider);

      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.USDtContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        },
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.UniContractAddress,
          uniSwapPoolFee: 3000,
          inputTokenAmount: 10,
          deadline: deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];

      const ERC721MintOrder = [
        {
          erc721TokenAddress: Proton.address,
          basketManagerId: 'generic.B',
          tokenMetadataUri: 'QmRgKrUcX2UUZeBGLxJBWvNxoeGqpHpA5mLPBx1EGQMaFc'
        }
      ];
      
      const newTokenId = await web3packs.callStatic.bundle(
        globals.testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        [],
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );

      // User address has no amount before bundle 
      // expect(await ethers.provider.getBalance(testAddress)).to.be.eq('200000000000000000');

      const bundleTransaction = await web3packs.bundle(
        globals.testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ERC721MintOrder,
        ethers.utils.parseEther('.1'),
       { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();

      // // Bundle functions gives ethers to user
      expect(await ethers.provider.getBalance(globals.testAddress)).to.equal('9979042378600000000000');
      
      const bundToken = charged.NFT(Proton.address, newTokenId.toNumber());

      const USDtTokenMass = await bundToken.getMass(globals.USDtContractAddress, 'generic.B');
      expect(USDtTokenMass['137']?.value).to.equal(8);
      const UniTokenMass = await bundToken.getMass(globals.UniContractAddress, 'generic.B');
      expect(UniTokenMass['137']?.value).to.be.gt(1);
      const energizedNftsBeforeRelease = await bundToken.getBonds('generic.B'); 
      expect(energizedNftsBeforeRelease['137']?.value).to.eq(1);

      // Charged settings contract
      const chargedState = new Contract('0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b', chargedStateAbi, connectedWallet);

      // setBreakBondApproval
      await chargedState.setApprovalForAll(
        Proton.address,
        newTokenId.toNumber(),
        web3packs.address
      ).then((tx) => tx.wait());
        
      const unBundleTransaction = await web3packs.connect(connectedWallet).unbundle(
        globals.testAddress,
        Proton.address,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ globals.UniContractAddress, globals.USDtContractAddress],
          nfts: [{
            tokenAddress: Proton.address, // nested in the web3 pack token
            id: 527, // Id of token bonded in web3packs
          }],
        }
      );
      await unBundleTransaction.wait();

      const uniLeftInBundle = await bundToken.getMass(globals.UniContractAddress, 'generic.B');
      const USDLeftInBundle = await bundToken.getMass(globals.USDtContractAddress, 'generic.B');
      expect(uniLeftInBundle['137']?.value).to.eq(0);
      expect(USDLeftInBundle['137']?.value).to.eq(0);

      const energizedNftsAfterUnBundle = await bundToken.getBonds('generic.B'); 
      expect(energizedNftsAfterUnBundle['137']?.value).to.eq(0);

      const USDt = new ethers.Contract(globals.USDtContractAddress, globals.erc20Abi, USDcWhaleSigner); 
      const balanceOfUSDtAfterRelease = await USDt.balanceOf(globals.testAddress);

      expect(balanceOfUSDtAfterRelease).to.eq(8);

    });
  });

  describe ('Bonding', async() => {
    it ('Bonds a single assets', async() => {
      // User bond method to mint and bond proton token
      await web3packs.connect(ownerSigner).bond(
        Proton.address,
        1,
        'QmVHsu8L3n9rVhwNKiCozaH9Dgy9KtHWFihrejjVTPvvN8',
        'generic.B',
        Proton.address
      ).then(tx => tx.wait());

      // Check if proton token is bonded
      const energizedProton = charged.NFT(Proton.address, 1);
      const protonBondBalance = await energizedProton.getBonds('generic.B'); 

      expect(protonBondBalance['137']?.value).to.eq(1);
    });
  });

  describe('LP Liquidity', () => {
    const POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
    const TOKEN_0 = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
    const TOKEN_1 = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    const POOL_FEE = 500;
    const USDC_WETH_POOL = '0x45dda9cb7c25131df268515131f647d726f50608'

    it.only('Liquidity manager and pool exist', async() => {
      const positionManagerCode = await ethers.provider.getCode(POSITION_MANAGER_ADDRESS) 
      expect(positionManagerCode).to.be.not.empty
    });

    it.only('Calculates appropiate tick', async() => {
      const pool = await getPoolContract(USDC_WETH_POOL);
      const slot0 = await pool.slot0();
      const tickSpacing = parseInt(await pool.tickSpacing());
      const nearestTick = getNearestUsableTick(parseInt(slot0.tick),tickSpacing)

      const tickLow = nearestTick - tickSpacing * 2;
      const tickHigh = nearestTick + tickSpacing * 2;

      expect(tickLow % tickSpacing).to.be.eq(0);
      expect(tickHigh % tickSpacing).to.be.eq(0);
    });

    it.only('Provides liquidity on univ3', async() => {
      const amount0 = 10000000;
      const amount1 = 1000000000;

      // get dai
      const inputTokenAmount = ethers.utils.parseUnits('1', 6);
      const ERC20SwapOrder = [
        {
          inputTokenAddress: globals.USDcContractAddress,
          outputTokenAddress: globals.wrapMaticContractAddress,
          uniSwapPoolFee: 500,
          inputTokenAmount: inputTokenAmount,
          deadline: deadline,
          amountOutMinimum: 0,
          sqrtPriceLimitX96: 0,
        }
      ];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait();

      const tokenId = await web3packs.callStatic.depositLiquidity(
        TOKEN_0,
        TOKEN_1,
        amount0,
        amount1,
        POOL_FEE,
      );

      await web3packs.depositLiquidity(
        TOKEN_0,
        TOKEN_1,
        amount0,
        amount1,
        POOL_FEE,
      ).then(tx => tx.wait())

      const manager = new Contract(POSITION_MANAGER_ADDRESS, [
        "function balanceOf(address owner) view returns (uint balance)",
        "function ownerOf(uint256 tokenId) view returns (address owner)"
      ], ownerSigner);

      const ownerOfPosition = await manager.ownerOf(tokenId);
      expect(ownerOfPosition).to.be.eq(await web3packs.getAddress());

    });
  });
});