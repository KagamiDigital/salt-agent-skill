#!/usr/bin/env node
/**
 * Send native tokens via Salt SDK
 * Usage: node send-transaction.js <to> <amount> [chainId]
 * Example: node send-transaction.js 0x123... 0.001 421614
 */

const { Salt } = require('salt-sdk');
const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node send-transaction.js <to> <amount> [chainId]');
    console.error('Example: node send-transaction.js 0x123... 0.001 421614');
    process.exit(1);
  }
  
  const [to, amount, chainId = '421614'] = args;
  const chain = parseInt(chainId);
  
  // Load configuration
  const walletData = JSON.parse(fs.readFileSync('.agent-wallet.json', 'utf8'));
  const rpcConfig = JSON.parse(fs.readFileSync('.rpc-config.json', 'utf8'));
  
  // Determine environment and RPC
  const environment = chain === 421614 ? 'TESTNET' : 'MAINNET';
  const orchestrationChain = chain === 421614 ? 421614 : 42161;
  const rpcUrl = chain === 421614 
    ? rpcConfig.ARBITRUM_SEPOLIA.rpcUrl
    : rpcConfig.ARBITRUM_ONE.rpcUrl;
  
  // Setup provider and signer
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(walletData.privateKey, provider);
  
  console.log('🚀 Salt Transaction\n');
  console.log('From wallet:', walletData.address);
  console.log('To:', to);
  console.log('Amount:', amount);
  console.log('Chain:', chain);
  console.log('Environment:', environment);
  console.log('');
  
  // Authenticate with Salt
  const salt = new Salt({ environment });
  await salt.authenticate(signer);
  console.log('✅ Authenticated\n');
  
  // Get account
  const orgs = await salt.getOrganisations();
  if (orgs.length === 0) throw new Error('No organizations found');
  
  const accounts = await salt.getAccounts(orgs[0]._id);
  if (accounts.length === 0) throw new Error('No accounts found');
  
  const account = accounts[0];
  console.log('📋 Using account:', account.publicKey);
  console.log('');
  
  // Submit transaction
  console.log('📤 Submitting transaction...');
  const tx = await salt.submitTx({
    accountId: account.id,
    to,
    value: amount,
    chainId: chain,
    data: '0x',
    signer
  });
  
  console.log('⏳ Waiting for completion...\n');
  const result = await tx.wait();
  
  const txHash = result.broadcastReceipt?.transactionHash || result.txHash;
  
  console.log('🎉 Complete!\n');
  console.log('State:', result.state);
  console.log('TX Hash:', txHash);
  
  if (result.state === 'success') {
    console.log('\n✅ SUCCESS!');
    const explorerBase = chain === 421614 
      ? 'https://sepolia.arbiscan.io/tx/'
      : 'https://arbiscan.io/tx/';
    console.log('🔗', explorerBase + txHash);
  } else {
    console.log('\n❌ FAILED:', result.state);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
