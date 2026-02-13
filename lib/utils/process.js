const fs = require('fs');
const path = require('path');
const os = require('os');

function getPidFilePath(environment) {
  const tmpDir = os.tmpdir();
  const filename = environment === 'TESTNET' 
    ? 'salt-listener-testnet.pid'
    : 'salt-listener-mainnet.pid';
  return path.join(tmpDir, filename);
}

function savePid(pid, environment) {
  const pidFile = getPidFilePath(environment);
  fs.writeFileSync(pidFile, pid.toString());
}

function isListenerRunning(environment) {
  const pidFile = getPidFilePath(environment);
  
  if (!fs.existsSync(pidFile)) {
    return false;
  }
  
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    
    // Check if process is actually running
    try {
      process.kill(pid, 0); // Signal 0 checks existence without killing
      return true;
    } catch (err) {
      // Process not running, clean up stale PID file
      fs.unlinkSync(pidFile);
      return false;
    }
  } catch (err) {
    return false;
  }
}

function stopListener(environment) {
  const pidFile = getPidFilePath(environment);
  
  if (!fs.existsSync(pidFile)) {
    return false;
  }
  
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
    
    // Send SIGTERM to gracefully stop
    process.kill(pid, 'SIGTERM');
    
    // Wait a bit and check if stopped
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        // Still running, force kill
        process.kill(pid, 'SIGKILL');
      } catch (err) {
        // Already stopped, good
      }
    }, 2000);
    
    // Clean up PID file
    fs.unlinkSync(pidFile);
    return true;
    
  } catch (err) {
    // Clean up PID file anyway
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
    return false;
  }
}

module.exports = {
  getPidFilePath,
  savePid,
  isListenerRunning,
  stopListener
};
