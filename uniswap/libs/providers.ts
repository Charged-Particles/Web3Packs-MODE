import { ethers, providers } from 'ethers';

// Provider Functions

export function getProvider(): providers.Provider {
  return new ethers.providers.JsonRpcProvider("https://polygon-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_API_KEY);
}
