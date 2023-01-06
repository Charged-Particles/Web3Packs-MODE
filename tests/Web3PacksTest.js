const { expect } = require("chai"); 
const { getDeployData } = require('../js-helpers/deploy'); 
const { ethers, deployments, network } = require('hardhat');

describe('Web3Packs', function() {
  
  let web3packs;

  const erc20Abi = [
    "function transfer(address to, uint amount)",
    "function balanceOf(address account) public view virtual override returns (uint256)"
  ];

  const USDcContractAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
  const USDtContractAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
  const UniContractAddress = '0xb33EaAd8d922B1083446DC23f610c2567fB5180f';
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
        params: [ USDcWhale ],
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
  });
})