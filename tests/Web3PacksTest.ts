import { expect } from "chai"; 
import { ethers, network } from 'hardhat';
import { default as Charged, chargedStateAbi } from "@charged-particles/charged-js-sdk";
import { BigNumber, Contract, FixedNumber, Signer } from "ethers";
import { USDC_USDT_SWAP } from "../uniswap/libs/constants";
// @ts-ignore
import { getDeployData } from '../js-helpers/deploy'; 
import { amountOutMinimum, quote } from "../uniswap/quote";

describe('Web3Packs', async ()=> {
  let web3packs: Contract, USDc: Contract; 
  let USDcWhaleSigner: Signer;

  const erc20Abi = [
    "function transfer(address to, uint amount)",
    "function balanceOf(address account) public view virtual override returns (uint256)"
  ];

  const USDcContractAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDtContractAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const UniContractAddress = '0xb33EaAd8d922B1083446DC23f610c2567fB5180f';
  const wrapMaticContractAddress = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";

  const testAddress = '0x277BFc4a8dc79a9F194AD4a83468484046FAFD3A';
  const USDcWhale = '0xfa0b641678f5115ad8a8de5752016bd1359681b9';

  const ipfsMetadata = 'Qmao3Rmq9m38JVV8kuQjnL3hF84cneyt5VQETirTH1VUST';
  const deadline = Math.floor(Date.now() / 1000) + (60 * 10);

  const deployWeb3Pack = async () => {
    const ddWeb3Packs = getDeployData('Web3Packs');
    const Web3Packs = await ethers.getContractFactory('Web3Packs');
    web3packs = await Web3Packs.attach(ddWeb3Packs.address);    
  };

  before(async () => {
    await deployWeb3Pack();
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ USDcWhale ]
    });

    // Deposit usdc into web3pack contract
    USDcWhaleSigner = await ethers.getSigner(USDcWhale);
    USDc = new ethers.Contract(USDcContractAddress, erc20Abi, USDcWhaleSigner);

    const foundWeb3PacksTransaction = await USDc.transfer(web3packs.address, ethers.utils.parseUnits('100', 6));
    await foundWeb3PacksTransaction.wait();
  });

  beforeEach(async () => {
    await deployWeb3Pack();
  });

  describe('Web3Packs', async () => {
    it ('Swap a single asset', async() => {
      const balanceBeforeSwap = await USDc.balanceOf(web3packs.address);
      expect(balanceBeforeSwap).to.equal(100000000);

      // calculate expected amount
      const swapEstimation = await quote(USDC_USDT_SWAP);
      const swapPriceTolerance = amountOutMinimum(swapEstimation, 10) ;

      const ERC20SwapOrder = [{
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress,
        inputTokenAmount: ethers.utils.parseUnits('10', 6),
        uniSwapPoolFee: 3000,
        deadline: deadline,
        amountOutMinimum: swapPriceTolerance,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait()

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, USDcWhaleSigner);
      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(9982205);
      // const balanceBeforeSwap1 = await USDc.balanceOf(web3packs.address);
    });

    it('Swap one assets with matic', async() => {
      const inputTokenAmount = ethers.utils.parseEther('10');
      const ERC20SwapOrder = [{
        inputTokenAddress: wrapMaticContractAddress,
        outputTokenAddress: USDcContractAddress,
        uniSwapPoolFee: 500,
        inputTokenAmount,
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder, { value: inputTokenAmount });
      await swapTransaction.wait();

      const USDcBalanceAfterSwap = await USDc.connect(ethers.provider).balanceOf(web3packs.address);
      // const balanceWhale = await ethers.provider.getBalance(USDcWhale);

      expect(USDcBalanceAfterSwap).to.equal(96938484);
    });

    it('Swap two assets with matic', async() => {
      const inputTokenAmount = ethers.utils.parseEther('10');
      const ERC20SwapOrder = [{
        inputTokenAddress: wrapMaticContractAddress,
        outputTokenAddress: USDcContractAddress,
        uniSwapPoolFee: 500,
        inputTokenAmount: inputTokenAmount.div(2),
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      },
      {
        inputTokenAddress: wrapMaticContractAddress,
        outputTokenAddress: UniContractAddress,
        uniSwapPoolFee: 3000,
        inputTokenAmount: inputTokenAmount.div(2),
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder, { value: inputTokenAmount });
      const swapTransactionReceipt = await swapTransaction.wait();

      // TODO: CHECK CORRECT BALANCE SWAP !!
      // console.log(swapTransactionReceipt);
    });

    it('Swaps multiple assets', async() => {      // grant maUSD to the Web3Packs contract.
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

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, USDcWhaleSigner);
      const UNI = new ethers.Contract(UniContractAddress, erc20Abi, USDcWhaleSigner);

      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);
      const UNIBalanceAfterSwap = await UNI.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(9982213);
      expect(UNIBalanceAfterSwap.toString()).to.equal('493373764498692278');
    });

    it ('Bundles singled swap asset', async() => {
      const ERC20SwapOrder = [{
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress,
        inputTokenAmount: 10,
        uniSwapPoolFee: 3000,
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const bundleTransaction = await web3packs.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();
    });

    it('Bundles token with two swaps and then unbundles the nft', async() => {
      const walletMnemonic = ethers.Wallet.fromMnemonic(process.env.TESTNET_MNEMONIC ?? '')
      const connectedWallet = walletMnemonic.connect(ethers.provider);

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
      
      const newTokenId = await web3packs.callStatic.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );

      // User address has no amount before bundle 
      expect(await ethers.provider.getBalance(testAddress)).to.equal(ethers.utils.parseEther('.1'));

      const bundleTransaction = await web3packs.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ethers.utils.parseEther('.1'),
       { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();

      // Bundle functions gives ethers to user
      expect(await ethers.provider.getBalance(testAddress)).to.equal(ethers.utils.parseEther('.2'));
      
      const charged = new Charged({ providers: ethers.provider, signer: walletMnemonic });
      const bundToken = charged.NFT('0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC', newTokenId.toNumber());

      const USDtTokenMass = await bundToken.getMass(USDtContractAddress, 'generic.B');
      expect(USDtTokenMass['137']?.value).to.equal(8);
      const UniTokenMass = await bundToken.getMass(UniContractAddress, 'generic.B');
      expect(UniTokenMass['137']?.value).to.be.gt(1);

      // Charged settings contract
      const chargedState = new Contract('0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b', chargedStateAbi, connectedWallet);
      const approveWeb3PackReleaseTx = await chargedState.setReleaseApproval(
        bundToken.contractAddress,
        bundToken.tokenId,
        web3packs.address 
      );
      await approveWeb3PackReleaseTx.wait();
        
      const unbundleTransaction = await web3packs.connect(connectedWallet).unbundle(
        testAddress,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ UniContractAddress, USDtContractAddress]
        }
      );

      const unbundleTransactionReceipt = await unbundleTransaction.wait();
      // console.log(ethers.utils.formatUnits(unbundleTransactionReceipt.gasUsed))

      const uniLeftInBoundle = await bundToken.getMass(UniContractAddress, 'generic.B');
      const USDLeftInBoundle = await bundToken.getMass(USDtContractAddress, 'generic.B');
      expect(uniLeftInBoundle['137']?.value).to.eq(0);
      expect(USDLeftInBoundle['137']?.value).to.eq(0);

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, USDcWhaleSigner); 
      const balanceOfUSDtAfterRelease = await USDt.balanceOf(testAddress);

      expect(balanceOfUSDtAfterRelease).to.eq(8);
    });
  });
});