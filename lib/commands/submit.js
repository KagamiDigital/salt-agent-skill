const { Salt } = require('salt-sdk');
const { loadConfig, getSigner } = require('../utils/config');
const { formatBalance } = require('../utils/format');

async function submitCommand(options) {
  try {
    // Determine environment
    const environment = options.testnet ? 'TESTNET' : 'MAINNET';
    const orchestrationChain = environment === 'TESTNET' ? 421614 : 42161;
    
    console.log('🧂 Salt Submit\n');
    console.log(`Environment: ${environment}`);
    
    // Validate inputs
    if (!options.to && !options.deploy) {
      console.error('❌ Error: Must specify --to <address> or use --deploy for contract deployment');
      process.exit(1);
    }
    
    // Load config and authenticate
    const config = loadConfig();
    const signer = getSigner(environment, config);
    const walletAddress = await signer.getAddress();
    
    console.log('🔑 Wallet:', walletAddress);
    console.log('');
    
    const salt = new Salt({ environment });
    await salt.authenticate(signer);
    console.log('✅ Authenticated\n');
    
    // Get account
    const orgs = await salt.getOrganisations();
    if (orgs.length === 0) throw new Error('No organizations found');
    
    const accounts = await salt.getAccounts(orgs[0]._id);
    if (accounts.length === 0) throw new Error('No accounts found');
    
    // Select account (use specified or first)
    let account;
    if (options.account) {
      account = accounts.find(acc => acc.id === options.account);
      if (!account) throw new Error(`Account ${options.account} not found`);
    } else {
      account = accounts[0];
    }
    
    console.log(`📋 Using account: ${account.name || account.id}`);
    console.log(`   Address: ${account.publicKey}`);
    console.log('');
    
    // Determine destination chain
    const chainId = options.chain ? parseInt(options.chain) : orchestrationChain;
    
    // Prepare transaction params
    const to = options.deploy ? null : options.to;
    const value = options.value || '0';
    const data = options.data || '0x';
    
    console.log('📤 Transaction Details:');
    console.log(`   To: ${to || 'null (contract deployment)'}`);
    console.log(`   Value: ${value}`);
    console.log(`   Data: ${data.slice(0, 66)}${data.length > 66 ? '...' : ''}`);
    console.log(`   Chain: ${chainId}`);
    console.log('');
    
    // Submit transaction
    console.log('⏳ Submitting transaction...');
    const tx = await salt.submitTx({
      accountId: account.id,
      to,
      value,
      chainId,
      data,
      signer
    });
    
    console.log('⏳ Waiting for MPC signing and broadcast...\n');
    const result = await tx.wait();
    
    // Extract results
    const txHash = result.broadcastReceipt?.transactionHash || result.txHash;
    
    console.log('🎉 Transaction Complete!\n');
    console.log('State:', result.state);
    console.log('TX Hash:', txHash);
    
    if (result.state === 'success') {
      console.log('\n✅ SUCCESS!');
      
      // For deployments, show contract address
      if (options.deploy && result.broadcastReceipt?.contractAddress) {
        console.log('📍 Contract Address:', result.broadcastReceipt.contractAddress);
      }
      
      // Show explorer link
      const explorerBase = environment === 'TESTNET'
        ? 'https://sepolia.arbiscan.io/tx/'
        : 'https://arbiscan.io/tx/';
      console.log('🔗 Explorer:', explorerBase + txHash);
    } else {
      console.log('\n❌ Transaction failed:', result.state);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { submitCommand };
