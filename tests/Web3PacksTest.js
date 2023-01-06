const { expect } = require("chai"); 
const { getDeployData } = require('../js-helpers/deploy'); 
const { ethers, deployments, network } = require('hardhat');

describe('Web3Packs', function() {
  
  let web3packs;
  
  beforeEach(async () => {
    const ddWeb3Packs = getDeployData('Web3Packs');
    const Web3Packs = await ethers.getContractFactory('Web3Packs');
    web3packs = await Web3Packs.attach(ddWeb3Packs.address);
  });

  describe('ERC721', async () => {
    it ('Gets deployed token name', async() => {
      const name = await web3packs.name();
      expect(name).to.equal('Web3Packs');
    });

    it ('Swap a single asset', async() => {

      // grant maUSD to the Web3Packs contract.
      const USDcContractAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
      const USDtContractAddress = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
      const maUSDWhale = '0xfa0b641678f5115ad8a8de5752016bd1359681b9';
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ maUSDWhale ],
      });

      const whaleSigner = await ethers.getSigner(maUSDWhale);
      const erc20Abi = [
        "function transfer(address to, uint amount)",
        "function balanceOf(address account) public view virtual override returns (uint256)"
      ];
    
      const USDc = new ethers.Contract(USDcContractAddress, erc20Abi, whaleSigner);

      const foundWeb3PacksTransaction = await USDc.transfer(web3packs.address, 100);
      await foundWeb3PacksTransaction.wait();

      // const balanceOfAddress = await USDc.balanceOf(web3packs.address);

      // swap
      const blockNumber = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumber);
      // const timestampBefore = blockBefore.timestamp + 10000;

      const ERC20SwapOrder = [{
        inputTokenAddress: USDcContractAddress,
        outputTokenAddress: USDtContractAddress, //  (PoS) Tether USD
        // fee: 3000,
        // receiver: '0x2e4f5cf824370a47C4DBD86281d3875036A30534', // test wallet
        // timestampBefore,
        inputTokenAmount: 1,
      }];

      const swapTransaction = await web3packs._singleSwap(
        USDcContractAddress,
        USDtContractAddress,
        10
      );

      const receiptSingleSwap = await swapTransaction.wait();
      // console.log(receiptSingleSwap)

      const USDt = new ethers.Contract(USDtContractAddress, erc20Abi, whaleSigner);
      const USDtBalance = await USDt.balanceOf(web3packs.address);

      console.log(USDtBalance.toString());
    });
  });
})