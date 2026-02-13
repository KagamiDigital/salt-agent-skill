#!/usr/bin/env node
/**
 * Create a new wallet for Salt CLI usage
 * Usage: node create-wallet.js [output-path]
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

function createWallet(outputPath) {
  console.log('🔑 Creating new wallet...\n');
  
  // Generate random wallet
  const wallet = ethers.Wallet.createRandom();
  
  const config = {
    privateKey: wallet.privateKey,
    address: wallet.address,
    mnemonic: wallet.mnemonic.phrase
  };
  
  // Determine output path
  const walletPath = outputPath || path.join(
    process.env.HOME,
    '.openclaw',
    'workspace',
    '.agent-wallet.json'
  );
  
  // Ensure directory exists
  const dir = path.dirname(walletPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save wallet
  fs.writeFileSync(walletPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  
  console.log('✅ Wallet created successfully!\n');
  console.log('📍 Location:', walletPath);
  console.log('📬 Address:', wallet.address);
  console.log('');
  console.log('⚠️  IMPORTANT: Save your mnemonic securely!');
  console.log('');
  console.log('🔐 Mnemonic (seed phrase):');
  console.log('   ', wallet.mnemonic.phrase);
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Fund your wallet with ETH for gas fees');
  console.log('   2. Testnet faucet: https://faucet.quicknode.com/arbitrum/sepolia');
  console.log('   3. Run: salt init -t');
  console.log('');
  console.log('🔒 Security notes:');
  console.log('   - Never share your private key or mnemonic');
  console.log('   - Backup your mnemonic in a secure location');
  console.log('   - This wallet is for agent use only');
  console.log('');
}

// Run
const outputPath = process.argv[2];
createWallet(outputPath);
