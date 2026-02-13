const { Salt } = require('salt-sdk');
const { loadConfig, getSigner } = require('../utils/config');
const { getPidFilePath, savePid, isListenerRunning } = require('../utils/process');

async function listenCommand(options) {
  try {
    const environment = options.testnet ? 'TESTNET' : 'MAINNET';
    
    console.log('🧂 Salt Nudge Listener\n');
    console.log(`Environment: ${environment}`);
    console.log('');
    
    // Check if listener already running
    if (isListenerRunning(environment)) {
      console.log('⚠️  Listener already running');
      console.log('   Use `salt stop` to stop it first');
      process.exit(0);
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
    
    // Start nudge listener
    console.log('👂 Starting nudge listener...');
    const listener = await salt.listenToAccountNudges(signer);
    console.log('✅ Listener started!\n');
    
    // Save PID for stop command
    savePid(process.pid, environment);
    
    console.log('📊 Monitoring nudges (Press Ctrl+C to stop)...\n');
    
    // Monitor nudges
    const monitorInterval = setInterval(() => {
      const queue = listener.getNudgeQueue();
      const processing = listener.getIsProcessingNudge();
      const accounts = listener.getAccounts();
      
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] Queue: ${queue.length}, Processing: ${processing}, Accounts: ${accounts.length}`);
      
      if (queue.length > 0) {
        console.log('   📬 Pending nudges:', queue.map(n => n.accountId || 'unknown').join(', '));
      }
    }, 5000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Stopping listener...');
      clearInterval(monitorInterval);
      listener.disableNudgeListener();
      
      // Clean up PID file
      const fs = require('fs');
      const pidFile = getPidFilePath(environment);
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      
      console.log('✅ Listener stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n\n🛑 Stopping listener...');
      clearInterval(monitorInterval);
      listener.disableNudgeListener();
      
      const fs = require('fs');
      const pidFile = getPidFilePath(environment);
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      
      console.log('✅ Listener stopped');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { listenCommand };
