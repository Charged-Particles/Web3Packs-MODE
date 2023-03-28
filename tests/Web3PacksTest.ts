import { expect } from "chai"; 
import { ethers, network, deployments, getNamedAccounts } from 'hardhat';
import {
  default as Charged,
  chargedStateAbi,
  chargedSettingsAbi,
  protonBAbi
} from "@charged-particles/charged-js-sdk";
import { Contract, Signer } from "ethers";
import { USDC_USDT_SWAP } from "../uniswap/libs/constants";
import { amountOutMinimum, quote } from "../uniswap/quote";


// Globals constants
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

describe('Web3Packs', async ()=> {
  // Define contracts
  let web3packs: Contract, USDc: Contract, TestNFT: Contract, Proton: Contract, Uni: Contract; 

  // Define signers
  let USDcWhaleSigner: Signer, ownerSigner: Signer, testSigner: Signer;

  let charged: Charged;

  // beforeEach(async () => {
  //   await deployments.fixture();
  //   web3packs = await ethers.getContract('Web3Packs');
  //   TestNFT = await ethers.getContract('ERC721Mintable');
  // });

  beforeEach(async () => {
    const { protocolOwner } = await getNamedAccounts();

    web3packs = await ethers.getContract('Web3Packs');
    TestNFT = await ethers.getContract('ERC721Mintable');

    ownerSigner = await ethers.getSigner(protocolOwner);
    testSigner = ethers.Wallet.fromMnemonic(process.env.TESTNET_MNEMONIC ?? '');

    charged = new Charged({ providers: ethers.provider, signer: testSigner });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [ USDcWhale ]
    });
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [protocolOwner],
    });

    // Deposit usdc into web3pack contract
    USDcWhaleSigner = await ethers.getSigner(USDcWhale);
    USDc = new ethers.Contract(USDcContractAddress, erc20Abi, USDcWhaleSigner);
    Uni = new ethers.Contract(UniContractAddress, erc20Abi, ethers.provider);

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

    const whiteListTx = await ChargedSettingContract.enableNftContracts([TestNFT.address]);
    await whiteListTx.wait();

    await ChargedSettingContract.enableNftContracts([TestNFT.address]).then((tx: any) => tx.wait());
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

      expect(USDcBalanceAfterSwap).to.equal(296938484);
    });

    it('Swap two assets with matic', async() => {

      // Balances before swap
      const usdcBeforeSwap = await USDc.balanceOf(web3packs.address);
      const uniBeforeSwap = await Uni.balanceOf(web3packs.address);

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
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress,
        inputTokenAmount: 10,
        uniSwapPoolFee: 3000,
        deadline: deadline,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }];

      const ERC712MintOrder = [
        {
          erc721TokenAddress: TestNFT.address,
          basketManagerId: 'generic.B'
        },
        {
          erc721TokenAddress: TestNFT.address,
          basketManagerId: 'generic.B'
        },
      ];

      const newTokenId = await web3packs.callStatic.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        [],
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );

      const bundleTransaction = await web3packs.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        ERC712MintOrder,
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();
      const energizedProton = charged.NFT('0x1CeFb0E1EC36c7971bed1D64291fc16a145F35DC', newTokenId);

      const protonBondBalance = await energizedProton.getBonds('generic.B'); 
      expect(protonBondBalance['137']?.value).to.eq(2);
    });

    it('Bundles token with two swaps and then unbundles the nft', async() => {
      const connectedWallet = testSigner.connect(ethers.provider);

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
        [],
        ethers.utils.parseEther('.1'),
        { value: ethers.utils.parseEther('.2') }
      );

      // User address has no amount before bundle 
      // expect(await ethers.provider.getBalance(testAddress)).to.be.eq('200000000000000000');

      const bundleTransaction = await web3packs.bundle(
        testAddress,
        ipfsMetadata,
        ERC20SwapOrder,
        [],
        ethers.utils.parseEther('.1'),
       { value: ethers.utils.parseEther('.2') }
      );
      await bundleTransaction.wait();

      // Bundle functions gives ethers to user
      expect(await ethers.provider.getBalance(testAddress)).to.equal(ethers.utils.parseEther('.2'));
      
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
        bundToken.contractAddress,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ UniContractAddress, USDtContractAddress],
          nfts: [],
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

  describe ('Bonding', async() => {
    it ('Bonds a single assets', async() => {
      // User bond method to mint and bond proton token
      await web3packs.connect(ownerSigner).bond(
        Proton.address,
        1,
        'generic.B',
        TestNFT.address
      ).then(tx => tx.wait());

      // Check if proton token is bonded
      const energizedProton = charged.NFT(Proton.address, 1);
      
      const protonBondBalance = await energizedProton.getBonds('generic.B'); 

      expect(protonBondBalance['137']?.value).to.eq(1);
    });
  });
});