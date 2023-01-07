const { expect } = require("chai"); 
const { getDeployData } = require('../js-helpers/deploy'); 
const { ethers, network } = require('hardhat');
const { default: Charged, chargedStateAbi } = require("@charged-particles/charged-js-sdk");
const { Contract } = require("ethers");

describe('Web3Packs', function() {
  
  let web3packs;

  const erc20Abi = [
    "function transfer(address to, uint amount)",
    "function balanceOf(address account) public view virtual override returns (uint256)"
  ];

  const USDcContractAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDtContractAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const UniContractAddress = '0xb33EaAd8d922B1083446DC23f610c2567fB5180f';
  const testAddress = '0x277BFc4a8dc79a9F194AD4a83468484046FAFD3A';
  const USDcWhale = '0xfa0b641678f5115ad8a8de5752016bd1359681b9';
   
  beforeEach(async () => {
    const ddWeb3Packs = getDeployData('Web3Packs');
    const Web3Packs = await ethers.getContractFactory('Web3Packs');
    web3packs = await Web3Packs.attach(ddWeb3Packs.address);
  });

  describe('Web3Packs', async () => {
    it ('Gets deployed token name', async() => {
      const name = await web3packs.name();
      expect(name).to.equal('Web3Packs');
    });

    it ('Swap a single asset', async() => {
      // grant maUSD to the Web3Packs contract.
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ USDcWhale ]
      });

      // Deposit usdc into web3pack contract
      const whaleSigner = await ethers.getSigner(USDcWhale);
      const USDc = new ethers.Contract(USDcContractAddress, erc20Abi, whaleSigner);
      const foundWeb3PacksTransaction = await USDc.transfer(web3packs.address, 100);
      await foundWeb3PacksTransaction.wait();

      const balanceBeforeSwap = await USDc.balanceOf(web3packs.address);
      expect(balanceBeforeSwap).to.equal(100);

      const ERC20SwapOrder = [{
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress,
        inputTokenAmount: 10 
      }];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait();

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, whaleSigner);
      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(9);

      const balanceBeforeSwap1 = await USDc.balanceOf(web3packs.address);
      console.log(balanceBeforeSwap1.toString());
    });

    it ('Swaps multiple assets', async() => {      // grant maUSD to the Web3Packs contract.
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ USDcWhale ],
      });

      // Deposit usdc into web3pack contract
      const USDcWhaleSigner = await ethers.getSigner(USDcWhale);
      const USDc = new ethers.Contract(USDcContractAddress, erc20Abi, USDcWhaleSigner);
      const foundUSDcWeb3PacksTransaction = await USDc.transfer(web3packs.address, 100);
      await foundUSDcWeb3PacksTransaction.wait();

      const ERC20SwapOrder = [
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: USDtContractAddress,
          inputTokenAmount: 10 
        },
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: UniContractAddress,
          inputTokenAmount: 10 
        }
      ];

      const swapTransaction = await web3packs.swap(ERC20SwapOrder);
      await swapTransaction.wait();

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, USDcWhaleSigner);
      const UNI = new ethers.Contract(UniContractAddress, erc20Abi, USDcWhaleSigner);

      const USDtBalanceAfterSwap = await USDt.balanceOf(web3packs.address);
      const UNIBalanceAfterSwap = await UNI.balanceOf(web3packs.address);

      expect(USDtBalanceAfterSwap).to.equal(18);
      expect(UNIBalanceAfterSwap).to.equal(1659805226163);
    });

    it ('Bundles singled swap asset', async() => {
      const ERC20SwapOrder = [{
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress,
        inputTokenAmount: 10 
      }];

      const newTokenId = await web3packs.callStatic.bundle(testAddress ,ERC20SwapOrder);

      const bundleTransaction = await web3packs.bundle(testAddress ,ERC20SwapOrder);
      await bundleTransaction.wait();
      
      const charged = new Charged({ providers: ethers.provider });
      const bundToken = charged.NFT('0x1cefb0e1ec36c7971bed1d64291fc16a145f35dc', newTokenId.toNumber());

      const bundTokenMass = await bundToken.getMass(USDtContractAddress, 'generic.B');
      expect(bundTokenMass['137']?.value).to.equal(9);
    });

    it.only ('Bound token with two swaps and nbundle', async() => {
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ USDcWhale ],
      });

      const USDcWhaleSigner = await ethers.getSigner(USDcWhale);
      const walletMnemonic = ethers.Wallet.fromMnemonic(process.env.TESTNET_MNEMONIC)
      const connectedWallet = walletMnemonic.connect(ethers.provider);

      const foundTestWalletTx = await USDcWhaleSigner.sendTransaction({value: ethers.utils.parseEther('1'), to: testAddress});
      await foundTestWalletTx.wait();

      // // Deposit usdc into web3pack contract
      const USDc = new ethers.Contract(USDcContractAddress, erc20Abi, USDcWhaleSigner);
      const foundUSDcWeb3PacksTransaction = await USDc.transfer(web3packs.address, 100);
      await foundUSDcWeb3PacksTransaction.wait();

      const ERC20SwapOrder = [
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: USDtContractAddress,
          inputTokenAmount: 10
        },
        {
          inputTokenAddress: USDcContractAddress,
          outputTokenAddress: UniContractAddress,
          inputTokenAmount: 10
        }
      ];

      const newTokenId = await web3packs.callStatic.bundle(testAddress ,ERC20SwapOrder);
      const bundleTransaction = await web3packs.bundle(testAddress ,ERC20SwapOrder);
      await bundleTransaction.wait();
      
      const charged = new Charged({ providers: ethers.provider, signer: walletMnemonic });
      const bundToken = charged.NFT('0x1cefb0e1ec36c7971bed1d64291fc16a145f35dc', newTokenId.toNumber());

      const USDtTokenMass = await bundToken.getMass(USDtContractAddress, 'generic.B');
      expect(USDtTokenMass['137']?.value).to.equal(9);
      const UniTokenMass = await bundToken.getMass(UniContractAddress, 'generic.B');
      expect(UniTokenMass['137']?.value).to.be.gt(1);

      // console.log(newTokenId, newTokenId.toNumber());
      // console.log(await bundToken.ownerOf());

      const approveWeb3PacksToUseBundleTokenTx = await bundToken.approveAll(web3packs.address, true);
      await approveWeb3PacksToUseBundleTokenTx.wait();

      // Charged settings contract
      const chargedState = new Contract('0x9c00b8CF03f58c0420CDb6DE72E27Bf11964025b', chargedStateAbi, connectedWallet);
      const approveWeb3PackReleaseTx = await chargedState.setReleaseApproval(
        bundToken.contractAddress,
        bundToken.tokenId,
        web3packs.address 
      );

      await approveWeb3PackReleaseTx.wait();

      const unbundleTransaction = await web3packs.unbundle(
        testAddress,
        newTokenId.toNumber(),
        {
          erc20TokenAddresses: [ UniContractAddress, USDtContractAddress]
        }
      );

      await unbundleTransaction.wait();
      const uniLeftInBoundle = await bundToken.getMass(UniContractAddress, 'generic.B');
      const USDLeftInBoundle = await bundToken.getMass(USDtContractAddress, 'generic.B');
      expect(uniLeftInBoundle['137']?.value).to.eq(0);
      expect(USDLeftInBoundle['137']?.value).to.eq(0);
    });
  });
})