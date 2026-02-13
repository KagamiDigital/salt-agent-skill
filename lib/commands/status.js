const { Salt } = require('salt-sdk');
const { ethers } = require('ethers');
const { loadConfig, getSigner } = require('../utils/config');
const { formatBalance, formatAddress } = require('../utils/format');

async function statusCommand(options) {
  try {
    // Determine environment (default: mainnet)
    let environment = 'MAINNET';
    if (options.testnet) {
      environment = 'TESTNET';
    } else if (options.mainnet) {
      environment = 'MAINNET';
    }
    
    const chainId = environment === 'TESTNET' ? 421614 : 42161;
    const chainName = environment === 'TESTNET' ? 'Arbitrum Sepolia' : 'Arbitrum One';
    
    console.log('🧂 Salt Status\n');
    console.log(`Environment: ${environment} (${chainName})`);
    console.log('');
    
    // Load configuration
    const config = loadConfig();
    const signer = getSigner(environment, config);
    const walletAddress = await signer.getAddress();
    
    console.log('🔑 Wallet:', walletAddress);
    
    // Check wallet balance
    const provider = signer.provider;
    const walletBalance = await provider.getBalance(walletAddress);
    console.log('💰 Wallet Balance:', formatBalance(walletBalance), 'ETH');
    console.log('');
    
    // Authenticate with Salt
    const salt = new Salt({ environment });
    await salt.authenticate(signer);
    console.log('✅ Authenticated with Salt');
    console.log('');
    
    // Check for pending invitations
    console.log('📬 Pending Invitations:');
    const { invitations } = await salt.getOrganisationsInvitations();
    
    if (invitations.length === 0) {
      console.log('   None');
    } else {
      console.log(`   Found ${invitations.length} invitation(s):\n`);
      invitations.forEach((inv, index) => {
        console.log(`   ${index + 1}. ${inv.organisationName || 'Unnamed Org'}`);
        console.log(`      Org ID: ${inv.organisationId}`);
        console.log(`      Invitation ID: ${inv._id}`);
        console.log('');
      });
    }
    console.log('');
    
    // List organizations and accounts
    console.log('🏢 Organizations & Accounts:\n');
    const orgs = await salt.getOrganisations();
    
    if (orgs.length === 0) {
      console.log('   No organizations found');
    } else {
      for (const org of orgs) {
        console.log(`   📋 ${org.name || 'Unnamed Organization'}`);
        console.log(`      Org ID: ${org._id}`);
        
        const accounts = await salt.getAccounts(org._id);
        console.log(`      Accounts: ${accounts.length}\n`);
        
        if (accounts.length === 0) {
          console.log('         No accounts');
        } else {
          for (const [index, account] of accounts.entries()) {
            const accountName = account.name || `Account ${index + 1}`;
            
            console.log(`         ${index + 1}. ${accountName}`);
            console.log(`            ID: ${account.id}`);
            console.log(`            Public Address: ${account.publicKey}`);
            console.log(`            Signers: ${account.signers?.length || 'N/A'}`);
            
            // Get balance
            try {
              const balance = await provider.getBalance(account.publicKey);
              console.log(`            Balance: ${formatBalance(balance)} ETH`);
            } catch (err) {
              console.log(`            Balance: Error - ${err.message}`);
            }
            
            console.log('');
          }
        }
      }
    }
    
    console.log('─────────────────────────────────────────');
    console.log('✅ Status check complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { statusCommand };
