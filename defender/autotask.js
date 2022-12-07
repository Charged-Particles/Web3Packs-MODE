const { ethers } = require("ethers");
const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

// const CHAIN_ID = 137;   // Polygon Mainnet
const CHAIN_ID = 80001; // Mumbai Testnet


const USDC_ABI = [{anonymous:false,inputs:[{indexed:true,internalType:"address",name:"owner",type:"address"},{indexed:true,internalType:"address",name:"spender",type:"address"},{indexed:false,internalType:"uint256",name:"value",type:"uint256"}],name:"Approval",type:"event"},{anonymous:false,inputs:[{indexed:true,internalType:"address",name:"from",type:"address"},{indexed:true,internalType:"address",name:"to",type:"address"},{indexed:false,internalType:"uint256",name:"value",type:"uint256"}],name:"Transfer",type:"event"},{inputs:[{internalType:"address",name:"owner",type:"address"},{internalType:"address",name:"spender",type:"address"}],name:"allowance",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"},{inputs:[{internalType:"address",name:"spender",type:"address"},{internalType:"uint256",name:"amount",type:"uint256"}],name:"approve",outputs:[{internalType:"bool",name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"},{inputs:[{internalType:"address",name:"account",type:"address"}],name:"balanceOf",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"},{inputs:[],name:"totalSupply",outputs:[{internalType:"uint256",name:"",type:"uint256"}],stateMutability:"view",type:"function"},{inputs:[{internalType:"address",name:"recipient",type:"address"},{internalType:"uint256",name:"amount",type:"uint256"}],name:"transfer",outputs:[{internalType:"bool",name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"},{inputs:[{internalType:"address",name:"sender",type:"address"},{internalType:"address",name:"recipient",type:"address"},{internalType:"uint256",name:"amount",type:"uint256"}],name:"transferFrom",outputs:[{internalType:"bool",name:"",type:"bool"}],stateMutability:"nonpayable",type:"function"}];
const USDC_ADDRESS = {
  137   : '',
  80001 : '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
};

const WEB3_PACKS_ABI = [];
const WEB3_PACKS_ADDRESS = {
  137   : '',
  80001 : '0x5592ec0cfb4dbc12d3ab100b257153436a1f0fea',
};

// Params Object Format:
// {
//   swapOrders: [
//     {
//       inputTokenAddress: 'usdc',
//       outputTokenAddress: 'abc1',
//       inputTokenAmount: '20',
//       outputTokenMinAmount: '123',
//     },
//     {
//       inputTokenAddress: 'usdc',
//       outputTokenAddress: 'abc2',
//       inputTokenAmount: '40',
//       outputTokenMinAmount: '456',
//     },
//   ],
//   packOrder: {
//     erc20TokenAddresses: [ 'abc1', 'abc2' ],
//     erc20TokenAmounts: [ '123', '456' ],      // TODO: SHOULD CONFIRM & SEND ACTUAL BALANCE RECEIVED
//     erc721TokenAddresses: [ 'nft1', 'nft2' ],
//     erc721TokenIds: [ '1', '7' ],
//   },
// }
exports.main = async function(provider, signer, params) {
  const web3packs = new ethers.Contract(WEB3_PACKS_ADDRESS[CHAIN_ID], WEB3_PACKS_ABI, signer);
  const usdc = new ethers.Contract(USDC_ADDRESS[CHAIN_ID], USDC_ABI, signer);

  console.log(`Web3 Packs = ${WEB3_PACKS_ADDRESS[CHAIN_ID]}`);
  console.log(`USDC = ${USDC_ADDRESS[CHAIN_ID]}`);

  // Check relayer balance via the Defender network provider
  const relayer = await signer.getAddress();
  const balance = await usdc.balanceOf(relayer);

  // Creaft Transaction
  const { swapOrders, packOrder } = params;
  console.log(`Swap Orders = ${JSON.stringify(swapOrders)}`);
  console.log(`Pack Order = ${JSON.stringify(packOrder)}`);

  const blockNumber = await provider.getBlockNumber();
  const deadline = blockNumber + 2;

  if (balance.gt(0)) {
    const tx = await web3packs.swapAndBundle(deadline, swapOrders, packOrder);
    return tx;
  } else {
    console.log(`Insufficient USDC balance to Execute Swap & Bundle`);
  }
}

// Entrypoint for the Autotask
exports.handler = async function(event) {
  const { queryParameters } = event;
  const provider = new DefenderRelayProvider(event);
  const signer = new DefenderRelaySigner(event, provider, { speed: 'fast' });
  return exports.main(provider, signer, queryParameters);
}

// To run locally
if (require.main === module) {
  require('dotenv').config();
  const { DEFENDER_API_KEY: apiKey, DEFENDER_API_SECRET: apiSecret } = process.env;
  exports.handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}
