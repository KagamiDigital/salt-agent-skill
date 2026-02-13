#!/usr/bin/env node
/**
 * Check Salt account status, balances, and pending invitations
 * Usage: node check-status.js [environment]
 * Example: node check-status.js TESTNET
 */

const { Salt } = require('salt-sdk');
const { ethers } = require('ethers');
const fs = require('fs');

async function main() {
  const environment = process.argv[2] || 'TESTNET';
  
  // Load configuration
  const walletData = JSON.parse(fs.readFileSync('.agent-wallet.json', 'utf8'));
  const rpcConfig = JSON.parse(fs.readFileSync('.rpc-config.json', 'utf8'));
  
  const orchestrationChain = environment === 'TESTNET' ? 421614 : 42161;
  const rpcUrl = environment === 'TESTNET'
    ? rpcConfig.ARBITRUM_SEPOLIA.rpcUrl
    : rpcConfig.ARBITRUM_ONE.rpcUrl;
  
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(walletData.privateKey, provider);
  
  console.log('🧂 Salt Status Check\n');
  console.log('🔑 Agent Wallet:', walletData.address);
  
  // Check wallet balance
  const walletBalance = await provider.getBalance(walletData.address);
  console.log('💰 Wallet Balance:', ethers.utils.formatEther(walletBalance), 'ETH');
  console.log('');
  
  // Authenticate
  const salt = new Salt({ environment });
  await salt.authenticate(signer);
  console.log('✅ Authenticated with Salt', environment);
  console.log('');
  
  // Check invitations
  console.log('📬 Checking for organization invitations...');
  const { invitations } = await salt.getOrganisationsInvitations();
  if (invitations.length > 0) {
    console.log(`   Found ${invitations.length} pending invitation(s):`);
    invitations.forEach(inv => {
      console.log(`   - ${inv.organisationName || inv.organisationId} (ID: ${inv._id})`);
    });
  } else {
    console.log('   No pending invitations.');
  }
  console.log('');
  
  // Get organizations
  const orgs = await salt.getOrganisations();
  console.log(`🏢 My Organizations: ${orgs.length}\n`);
  
  // For each org, get accounts and balances
  for (const org of orgs) {
    console.log(`   📋 ${org.name || org._id}`);
    console.log(`      Org ID: ${org._id}`);
    
    const accounts = await salt.getAccounts(org._id);
    console.log(`      Accounts: ${accounts.length}\n`);
    
    for (const account of accounts) {
      console.log(`         🔑 Account ID: ${account.id}`);
      console.log(`            Vault Address: ${account.address}`);
      console.log(`            Public Key (receiving): ${account.publicKey}`);
      console.log(`            Signers: ${account.signers?.length || 'N/A'}`);
      
      // Check balance
      try {
        const balance = await provider.getBalance(account.publicKey);
        console.log(`            ETH Balance: ${ethers.utils.formatEther(balance)} ETH`);
      } catch (err) {
        console.log(`            ETH Balance: Error - ${err.message}`);
      }
      
      console.log('');
    }
  }
  
  console.log('─────────────────────────────────────────');
  console.log('✅ Salt status check complete!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
