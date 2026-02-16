#!/usr/bin/env node
/**
 * Token Sweeper Strategy for Salt SDK
 * 
 * A generalized automation script that monitors a Salt account for token deposits
 * and automatically sweeps them into a specified DeFi protocol (Aave, Compound, etc.)
 * or contract interaction.
 * 
 * Fully configurable - works with any ERC20 token, any protocol, any EVM chain.
 */

const { Salt } = require('../../node_modules/salt-sdk');
const { ethers } = require('../../node_modules/ethers');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration Loading
// ═══════════════════════════════════════════════════════════════════════════════

function loadConfig() {
  const configPath = process.env.SWEEPER_CONFIG || path.join(__dirname, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}\nCreate one using: node sweeper.js --init`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadWallet() {
  const walletPaths = [
    process.env.WALLET_CONFIG,
    path.join(process.cwd(), '.agent-wallet.json'),
    path.join(process.env.HOME, '.openclaw', 'workspace', '.agent-wallet.json'),
    path.join(process.env.HOME, '.salt-cli.json'),
  ].filter(Boolean);

  for (const walletPath of walletPaths) {
    if (fs.existsSync(walletPath)) {
      return JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    }
  }
  throw new Error('No wallet found. Expected .agent-wallet.json or ~/.salt-cli.json');
}

function saveState(config, state) {
  const stateFile = path.join(__dirname, `.${config.name}-state.json`);
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function loadState(config) {
  const stateFile = path.join(__dirname, `.${config.name}-state.json`);
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return {
      totalSwept: '0',
      sweepCount: 0,
      lastSweep: null,
      lastTxHash: null,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function log(msg, config) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: true });
  const prefix = config?.name ? `[${config.name}]` : '';
  console.log(`[${ts}] ${prefix} ${msg}`);
}

function isActive(config) {
  const flagFile = path.join(__dirname, `.${config.name}-active`);
  return fs.existsSync(flagFile);
}

function createFlagFile(config) {
  const flagFile = path.join(__dirname, `.${config.name}-active`);
  fs.writeFileSync(flagFile, new Date().toISOString());
}

function removeFlagFile(config) {
  const flagFile = path.join(__dirname, `.${config.name}-active`);
  if (fs.existsSync(flagFile)) fs.unlinkSync(flagFile);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Notifications
// ═══════════════════════════════════════════════════════════════════════════════

function sendNotification(config, message) {
  if (!config.notifications?.enabled) return;

  const { channel, target } = config.notifications;

  try {
    const msgFile = path.join(__dirname, '.notify-tmp');
    fs.writeFileSync(msgFile, message);
    
    execSync(
      `openclaw message send --channel ${channel} --target ${target} --message "$(cat ${msgFile})"`,
      { shell: '/bin/bash', timeout: 10000, stdio: 'ignore' }
    );
    
    fs.unlinkSync(msgFile);
    log(`📬 Notification sent to ${channel}`, config);
  } catch (err) {
    log(`⚠️ Failed to send notification: ${err.message}`, config);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Transaction Execution
// ═══════════════════════════════════════════════════════════════════════════════

async function executeApproval(salt, config, signer, amount) {
  const { token, protocol, account, chain } = config;
  
  log(`📝 Approving ${protocol.name} to spend ${token.symbol}...`, config);
  
  const iface = new ethers.utils.Interface(['function approve(address spender, uint256 amount) returns (bool)']);
  const data = iface.encodeFunctionData('approve', [protocol.address, amount]);

  const tx = await salt.submitTx({
    accountId: account.id,
    to: token.address,
    value: '0',
    chainId: chain.id,
    data: data,
    signer: signer,
  });

  const result = await tx.wait();
  if (result.state !== 'success') {
    throw new Error(`Approval failed: ${result.state}`);
  }

  return result.broadcastReceipt?.transactionHash;
}

async function executeProtocolAction(salt, config, signer, amount) {
  const { protocol, account, chain } = config;
  
  log(`📝 Executing ${protocol.action} on ${protocol.name}...`, config);
  
  // Build calldata from protocol config
  const iface = new ethers.utils.Interface([protocol.actionAbi]);
  const params = protocol.actionParams.map(param => {
    // Replace template variables
    if (param === '${amount}') return amount;
    if (param === '${account.publicKey}') return account.publicKey;
    if (param === '${token.address}') return config.token.address;
    return param;
  });
  
  const data = iface.encodeFunctionData(protocol.action, params);

  const tx = await salt.submitTx({
    accountId: account.id,
    to: protocol.address,
    value: '0',
    chainId: chain.id,
    data: data,
    signer: signer,
  });

  const result = await tx.wait();
  if (result.state !== 'success') {
    throw new Error(`${protocol.action} failed: ${result.state}`);
  }

  return result.broadcastReceipt?.transactionHash;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Monitor Loop
// ═══════════════════════════════════════════════════════════════════════════════

async function monitor(config, wallet) {
  const provider = new ethers.providers.JsonRpcProvider(config.chain.rpcUrl);
  const signer = new ethers.Wallet(wallet.privateKey, provider);

  // Authenticate with Salt
  const environment = config.chain.id === 421614 ? 'TESTNET' : 'MAINNET';
  log(`🧂 Authenticating with Salt (${environment})...`, config);
  const salt = new Salt({ environment });
  await salt.authenticate(signer);
  log('✅ Authenticated', config);

  // Setup contracts (read-only)
  const tokenAbi = ['function balanceOf(address owner) view returns (uint256)', 'function decimals() view returns (uint8)'];
  const token = new ethers.Contract(config.token.address, tokenAbi, provider);

  // Create flag file
  createFlagFile(config);
  log(`🚀 Sweeper started (polling every ${config.polling.intervalSeconds}s)`, config);
  log(`📍 Watching account: ${config.account.publicKey}`, config);
  log(`💰 Token: ${config.token.symbol} (${config.token.address})`, config);
  log(`🎯 Target: ${config.protocol.name} (${config.protocol.address})`, config);

  const state = loadState(config);
  let lastKnownBalance = null;

  async function tick() {
    if (!isActive(config)) {
      log('🛑 Flag file removed — stopping.', config);
      process.exit(0);
    }

    try {
      // Check token balance
      const balance = await token.balanceOf(config.account.publicKey);
      const balanceFormatted = ethers.utils.formatUnits(balance, config.token.decimals);

      if (lastKnownBalance === null) {
        log(`💰 Current ${config.token.symbol} balance: ${balanceFormatted}`, config);
        lastKnownBalance = balance;
      }

      // Check if sweep threshold met
      const threshold = ethers.utils.parseUnits(
        config.polling.sweepThreshold.toString(),
        config.token.decimals
      );

      if (balance.gte(threshold)) {
        log(`💸 Detected ${balanceFormatted} ${config.token.symbol} — sweeping...`, config);

        // Step 1: Approve protocol
        const approveTxHash = await executeApproval(salt, config, signer, balance);
        log(`✅ Approval confirmed: ${approveTxHash}`, config);

        // Step 2: Execute protocol action
        const actionTxHash = await executeProtocolAction(salt, config, signer, balance);
        log(`✅ Action confirmed: ${actionTxHash}`, config);

        const explorerUrl = `${config.chain.explorer}/tx/${actionTxHash}`;
        log(`🔗 TX: ${explorerUrl}`, config);

        // Update state
        state.totalSwept = ethers.utils.formatUnits(
          ethers.utils.parseUnits(state.totalSwept, config.token.decimals).add(balance),
          config.token.decimals
        );
        state.sweepCount++;
        state.lastSweep = new Date().toISOString();
        state.lastTxHash = actionTxHash;
        saveState(config, state);

        // Send notification
        const notifyMsg = `🧂 Swept ${balanceFormatted} ${config.token.symbol} into ${config.protocol.name}!\n\nTX: ${explorerUrl}\nTotal sweeps: ${state.sweepCount}`;
        sendNotification(config, notifyMsg);

        lastKnownBalance = ethers.BigNumber.from(0);
      } else {
        if (balance.isZero()) {
          // silent
        } else {
          log(`💤 Balance ${balanceFormatted} ${config.token.symbol} (below threshold)`, config);
        }
        lastKnownBalance = balance;
      }
    } catch (err) {
      log(`⚠️ Error: ${err?.message || JSON.stringify(err)}`, config);
    }
  }

  // Initial tick
  await tick();

  // Poll loop
  setInterval(tick, config.polling.intervalSeconds * 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Report Mode
// ═══════════════════════════════════════════════════════════════════════════════

async function report(config, wallet) {
  const provider = new ethers.providers.JsonRpcProvider(config.chain.rpcUrl);
  const tokenAbi = ['function balanceOf(address owner) view returns (uint256)'];
  const token = new ethers.Contract(config.token.address, tokenAbi, provider);
  
  const balance = await token.balanceOf(config.account.publicKey);
  const balanceFormatted = ethers.utils.formatUnits(balance, config.token.decimals);
  
  const state = loadState(config);

  console.log(JSON.stringify({
    name: config.name,
    account: config.account.publicKey,
    chain: config.chain.name,
    token: config.token.symbol,
    balance: balanceFormatted,
    protocol: config.protocol.name,
    sweepCount: state.sweepCount,
    totalSwept: state.totalSwept,
    lastSweep: state.lastSweep,
    lastTxHash: state.lastTxHash,
    explorerLink: state.lastTxHash ? `${config.chain.explorer}/tx/${state.lastTxHash}` : null,
  }, null, 2));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Init Mode - Create Config Template
// ═══════════════════════════════════════════════════════════════════════════════

function initConfig() {
  const configPath = path.join(process.cwd(), 'sweeper-config.json');
  if (fs.existsSync(configPath)) {
    console.error(`❌ Config already exists: ${configPath}`);
    process.exit(1);
  }

  const template = {
    name: 'my-sweeper',
    chain: {
      id: 421614,
      name: 'Arbitrum Sepolia',
      rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
      explorer: 'https://sepolia.arbiscan.io',
    },
    token: {
      address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      symbol: 'USDC',
      decimals: 6,
    },
    account: {
      id: 'YOUR_SALT_ACCOUNT_ID',
      publicKey: 'YOUR_SALT_ACCOUNT_PUBLIC_KEY',
    },
    protocol: {
      name: 'Aave V3',
      address: '0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff',
      action: 'supply',
      actionAbi: 'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
      actionParams: ['${token.address}', '${amount}', '${account.publicKey}', 0],
    },
    polling: {
      intervalSeconds: 60,
      sweepThreshold: 0.01,
    },
    notifications: {
      enabled: true,
      channel: 'telegram',
      target: 'YOUR_TELEGRAM_USER_ID',
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(template, null, 2));
  console.log(`✅ Config template created: ${configPath}`);
  console.log('\n📝 Next steps:');
  console.log('1. Edit the config file with your details');
  console.log('2. See protocols/ folder for protocol-specific examples');
  console.log('3. Run: node sweeper.js');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  if (process.argv.includes('--init')) {
    initConfig();
    return;
  }

  if (process.argv.includes('--stop')) {
    const config = loadConfig();
    removeFlagFile(config);
    console.log(`🛑 Stop signal sent for ${config.name}`);
    return;
  }

  const config = loadConfig();
  const wallet = loadWallet();

  if (process.argv.includes('--report')) {
    await report(config, wallet);
  } else {
    await monitor(config, wallet);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
