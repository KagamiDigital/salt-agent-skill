const { getPidFilePath, isListenerRunning, stopListener } = require('../utils/process');

async function stopCommand(options) {
  try {
    const environment = options.testnet ? 'TESTNET' : 'MAINNET';
    
    console.log('🧂 Salt Stop Listener\n');
    console.log(`Environment: ${environment}`);
    console.log('');
    
    if (!isListenerRunning(environment)) {
      console.log('ℹ️  No listener running');
      process.exit(0);
    }
    
    console.log('🛑 Stopping listener...');
    const success = stopListener(environment);
    
    if (success) {
      console.log('✅ Listener stopped');
    } else {
      console.log('⚠️  Failed to stop listener (may have already exited)');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { stopCommand };
