/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Interface, type ContractRunner } from "ethers";
import type {
  IWeb3Packs,
  IWeb3PacksInterface,
} from "../../../contracts/interfaces/IWeb3Packs";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "chargedParticles",
        type: "address",
      },
    ],
    name: "ChargedParticlesSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "chargedState",
        type: "address",
      },
    ],
    name: "ChargedStateSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "PackBundled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "receiver",
        type: "address",
      },
    ],
    name: "PackUnbundled",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "proton",
        type: "address",
      },
    ],
    name: "ProtonSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "router",
        type: "address",
      },
    ],
    name: "UniswapRouterSet",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address payable",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "string",
        name: "tokenMetaUri",
        type: "string",
      },
      {
        components: [
          {
            internalType: "address",
            name: "inputTokenAddress",
            type: "address",
          },
          {
            internalType: "address",
            name: "outputTokenAddress",
            type: "address",
          },
          {
            internalType: "uint256",
            name: "inputTokenAmount",
            type: "uint256",
          },
          {
            internalType: "uint24",
            name: "uniSwapPoolFee",
            type: "uint24",
          },
          {
            internalType: "uint256",
            name: "deadline",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "amountOutMinimum",
            type: "uint256",
          },
          {
            internalType: "uint160",
            name: "sqrtPriceLimitX96",
            type: "uint160",
          },
        ],
        internalType: "struct IWeb3Packs.ERC20SwapOrder[]",
        name: "erc20SwapOrders",
        type: "tuple[]",
      },
      {
        components: [
          {
            internalType: "address",
            name: "erc721TokenAddress",
            type: "address",
          },
          {
            internalType: "string",
            name: "basketManagerId",
            type: "string",
          },
          {
            internalType: "string",
            name: "tokenMetadataUri",
            type: "string",
          },
        ],
        internalType: "struct IWeb3Packs.ERC721MintOrders[]",
        name: "erc721MintOrders",
        type: "tuple[]",
      },
      {
        internalType: "uint256",
        name: "unBundleGasAmount",
        type: "uint256",
      },
    ],
    name: "bundle",
    outputs: [
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "receiver",
        type: "address",
      },
      {
        internalType: "address",
        name: "contractAddress",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "tokenId",
        type: "uint256",
      },
      {
        components: [
          {
            internalType: "address[]",
            name: "erc20TokenAddresses",
            type: "address[]",
          },
          {
            components: [
              {
                internalType: "address",
                name: "tokenAddress",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "id",
                type: "uint256",
              },
            ],
            internalType: "struct IWeb3Packs.NFT[]",
            name: "nfts",
            type: "tuple[]",
          },
        ],
        internalType: "struct IWeb3Packs.Web3PackOrder",
        name: "web3PackOrder",
        type: "tuple",
      },
    ],
    name: "unbundle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export class IWeb3Packs__factory {
  static readonly abi = _abi;
  static createInterface(): IWeb3PacksInterface {
    return new Interface(_abi) as IWeb3PacksInterface;
  }
  static connect(address: string, runner?: ContractRunner | null): IWeb3Packs {
    return new Contract(address, _abi, runner) as unknown as IWeb3Packs;
  }
}