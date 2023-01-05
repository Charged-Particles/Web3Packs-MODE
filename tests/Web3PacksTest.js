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

    it.skip ('Swap a single asset', async() => {

      // grant maUSD to the Web3Packs contract.
      const USDcContractAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
      const maUSDWhale = '0xd6216fc19db775df9774a6e33526131da7d19a2c';
      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [ maUSDWhale ],
      });

      // const whaleSigner = await ethers.getSigner(maUSDWhale);
      const erc20Abi = [
        "function transfer(address to, uint amount)"
      ];
    
      const USDc = new ethers.Contract(USDcContractAddress, erc20Abi, whaleSigner);

      const foundWeb3PacksTransaction = await USDc.transfer(web3packs.address, 100);
      await foundWeb3PacksTransaction.wait();

      const balanceOfAddress = await USDc.balanceOf(web3packs.address);
      console.log('>>>>> >>>>> >>>>> ' ,balanceOfAddress);

      // swap
      // const blockNumber = await ethers.provider.getBlockNumber();
      // const deadline = blockNumber + 2;
      // const ERC20SwapOrder = [{
      //   tokenIn: USDcContractAddress,
      //   tokenOut: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', //  (PoS) Tether USD
      //   fee: 3000,
      //   recipient: '0x2e4f5cf824370a47C4DBD86281d3875036A30534', // test wallet
      //   deadline,
      //   amountIn: 1,
      //   amountOutMinimum: 0,
      //   sqrtPriceLimitX96: 0
      // }];

      // const swapTransaction = await web3packs.swap(deadline, ERC20SwapOrder);
      // await swapTransaction.wait();
    });
  });
})