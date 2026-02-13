const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

function loadConfig() {
  // Try multiple config locations
  const configPaths = [
    path.join(process.cwd(), '.agent-wallet.json'),
    path.join(process.env.HOME, '.openclaw', 'workspace', '.agent-wallet.json'),
    path.join(process.env.HOME, '.salt-cli.json')
  ];
  
  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  }
  
  throw new Error('No wallet configuration found. Expected .agent-wallet.json or .salt-cli.json');
}

function loadRpcConfig() {
  const rpcPaths = [
    path.join(process.cwd(), '.rpc-config.json'),
    path.join(process.env.HOME, '.openclaw', 'workspace', '.rpc-config.json'),
    path.join(process.env.HOME, '.salt-rpc.json')
  ];
  
  for (const rpcPath of rpcPaths) {
    if (fs.existsSync(rpcPath)) {
      return JSON.parse(fs.readFileSync(rpcPath, 'utf8'));
    }
  }
  
  // Default RPC config
  return {
    ARBITRUM_SEPOLIA: {
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc'
    },
    ARBITRUM_ONE: {
      rpcUrl: 'https://arb1.arbitrum.io/rpc'
    }
  };
}

function getSigner(environment, walletConfig) {
  const rpcConfig = loadRpcConfig();
  
  const rpcUrl = environment === 'TESTNET'
    ? rpcConfig.ARBITRUM_SEPOLIA.rpcUrl
    : rpcConfig.ARBITRUM_ONE.rpcUrl;
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // Support both privateKey and mnemonic
  if (walletConfig.privateKey) {
    return new ethers.Wallet(walletConfig.privateKey, provider);
  } else if (walletConfig.mnemonic) {
    return ethers.Wallet.fromMnemonic(walletConfig.mnemonic).connect(provider);
  } else {
    throw new Error('Wallet config must contain privateKey or mnemonic');
  }
}

module.exports = {
  loadConfig,
  loadRpcConfig,
  getSigner
};
