# Salt SDK Advanced Patterns

## Table of Contents

1. [Complete Transaction Flow](#complete-transaction-flow)
2. [ERC20 Token Operations](#erc20-token-operations)
3. [Contract Deployment](#contract-deployment)
4. [Contract Interactions](#contract-interactions)
5. [Organization & Account Management](#organization--account-management)
6. [Error Handling Patterns](#error-handling-patterns)
7. [Auth Token Persistence](#auth-token-persistence)
8. [Multi-Chain Operations](#multi-chain-operations)

---

## Complete Transaction Flow

### Standard Native Transfer (with all best practices)

```javascript
const { Salt } = require('salt-sdk');
const { ethers } = require('ethers');

async function sendNativeTokens({
  recipientAddress,
  amount, // decimal string like '0.1'
  destinationChainId = 421614, // Arbitrum Sepolia by default
  environment = 'TESTNET'
}) {
  // 1. Determine orchestration chain
  const orchestrationChainId = environment === 'TESTNET' ? 421614 : 42161;
  
  // 2. Setup provider for orchestration chain
  const rpcUrl = getOrchestrationRpc(orchestrationChainId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  
  // 3. Load signer (from private key or mnemonic)
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  // 4. Verify signer is on correct chain
  const signerChainId = (await provider.getNetwork()).chainId;
  if (signerChainId !== orchestrationChainId) {
    throw new Error(`Signer on wrong chain. Expected ${orchestrationChainId}, got ${signerChainId}`);
  }
  
  // 5. Create Salt client
  const salt = new Salt({ environment });
  await salt.authenticate(signer);
  console.log('✅ Authenticated with Salt');
  
  // 6. Get account context
  const orgs = await salt.getOrganisations();
  if (orgs.length === 0) throw new Error('No organizations found');
  
  const accounts = await salt.getAccounts(orgs[0]._id);
  if (accounts.length === 0) throw new Error('No accounts found');
  
  const account = accounts[0];
  console.log(`📋 Using account: ${account.publicKey}`);
  
  // 7. Optional: Check balance
  const destProvider = new ethers.providers.JsonRpcProvider(
    getChainRpc(destinationChainId)
  );
  const balance = await destProvider.getBalance(account.publicKey);
  console.log(`💰 Current balance: ${ethers.utils.formatEther(balance)} ETH`);
  
  if (balance.lt(ethers.utils.parseEther(amount))) {
    throw new Error('Insufficient balance');
  }
  
  // 8. Optional: Check robo status
  try {
    const roboStatus = await salt.getRoboStatus(account.id);
    if (!roboStatus.online) {
      console.warn('⚠️  Robos offline, transaction may take longer');
    }
  } catch (err) {
    // 403 is common and doesn't block operations
    if (!err.message?.includes('403')) throw err;
  }
  
  // 9. Submit transaction
  console.log('📤 Submitting transaction...');
  const tx = await salt.submitTx({
    accountId: account.id,
    to: recipientAddress,
    value: amount, // decimal string
    chainId: destinationChainId,
    data: '0x',
    signer: signer // must match orchestration chain
  });
  
  // 10. Wait for completion (ALWAYS!)
  console.log('⏳ Waiting for MPC signing and broadcast...');
  const result = await tx.wait();
  
  // 11. Extract results
  const txHash = result.broadcastReceipt?.transactionHash || result.txHash;
  
  if (result.state === 'success') {
    console.log('✅ Transaction successful!');
    console.log('TX Hash:', txHash);
    console.log('Explorer:', getExplorerUrl(destinationChainId, txHash));
    return { success: true, txHash, result };
  } else {
    console.log('❌ Transaction failed:', result.state);
    return { success: false, state: result.state, result };
  }
}

// Helper functions
function getOrchestrationRpc(chainId) {
  const rpcs = {
    421614: 'https://sepolia-rollup.arbitrum.io/rpc',
    42161: 'https://arb1.arbitrum.io/rpc'
  };
  return rpcs[chainId] || rpcs[421614];
}

function getChainRpc(chainId) {
  const rpcs = {
    1: 'https://eth.llamarpc.com',
    137: 'https://polygon-rpc.com',
    421614: 'https://sepolia-rollup.arbitrum.io/rpc',
    42161: 'https://arb1.arbitrum.io/rpc'
  };
  return rpcs[chainId];
}

function getExplorerUrl(chainId, txHash) {
  const explorers = {
    1: 'https://etherscan.io/tx/',
    137: 'https://polygonscan.com/tx/',
    421614: 'https://sepolia.arbiscan.io/tx/',
    42161: 'https://arbiscan.io/tx/'
  };
  return (explorers[chainId] || explorers[421614]) + txHash;
}
```

---

## ERC20 Token Operations

### Check ERC20 Balance

```javascript
async function getERC20Balance(tokenAddress, accountPublicKey, chainId) {
  const provider = new ethers.providers.JsonRpcProvider(getChainRpc(chainId));
  
  const erc20Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ];
  
  const token = new ethers.Contract(tokenAddress, erc20Abi, provider);
  
  const [balance, decimals, symbol] = await Promise.all([
    token.balanceOf(accountPublicKey),
    token.decimals(),
    token.symbol()
  ]);
  
  const formatted = ethers.utils.formatUnits(balance, decimals);
  
  return {
    raw: balance.toString(),
    formatted,
    decimals,
    symbol
  };
}
```

### Transfer ERC20 Tokens

```javascript
async function transferERC20({
  tokenAddress,
  recipientAddress,
  amount, // decimal amount like '10.5'
  decimals = 18,
  accountId,
  chainId = 421614,
  salt,
  signer
}) {
  // Encode transfer function call
  const erc20Abi = ['function transfer(address to, uint256 amount)'];
  const iface = new ethers.utils.Interface(erc20Abi);
  
  // Parse amount to wei equivalent for token decimals
  const amountWei = ethers.utils.parseUnits(amount, decimals);
  
  // Encode the function call
  const data = iface.encodeFunctionData('transfer', [
    recipientAddress,
    amountWei
  ]);
  
  console.log(`📤 Transferring ${amount} tokens to ${recipientAddress}`);
  
  // Submit transaction
  const tx = await salt.submitTx({
    accountId,
    to: tokenAddress, // send TO the token contract
    value: '0', // MUST be '0' for ERC20
    chainId,
    data, // encoded transfer call
    signer
  });
  
  const result = await tx.wait();
  const txHash = result.broadcastReceipt?.transactionHash;
  
  return {
    success: result.state === 'success',
    txHash,
    result
  };
}
```

### Approve ERC20 Allowance

```javascript
async function approveERC20({
  tokenAddress,
  spenderAddress,
  amount, // decimal amount or 'max' for infinite
  decimals = 18,
  accountId,
  chainId,
  salt,
  signer
}) {
  const erc20Abi = ['function approve(address spender, uint256 amount)'];
  const iface = new ethers.utils.Interface(erc20Abi);
  
  // Parse amount (or use max uint256 for infinite approval)
  const amountWei = amount === 'max'
    ? ethers.constants.MaxUint256
    : ethers.utils.parseUnits(amount, decimals);
  
  const data = iface.encodeFunctionData('approve', [
    spenderAddress,
    amountWei
  ]);
  
  console.log(`✅ Approving ${amount} tokens for ${spenderAddress}`);
  
  const tx = await salt.submitTx({
    accountId,
    to: tokenAddress,
    value: '0',
    chainId,
    data,
    signer
  });
  
  const result = await tx.wait();
  return {
    success: result.state === 'success',
    txHash: result.broadcastReceipt?.transactionHash,
    result
  };
}
```

---

## Contract Deployment

### Deploy Compiled Contract

```javascript
async function deployContract({
  bytecode, // compiled contract bytecode (with 0x prefix)
  constructorArgs = [], // constructor arguments
  constructorTypes = [], // ABI types for constructor
  accountId,
  chainId = 421614,
  salt,
  signer
}) {
  let deployData = bytecode;
  
  // If constructor has arguments, encode them
  if (constructorArgs.length > 0) {
    const abiCoder = new ethers.utils.AbiCoder();
    const encodedArgs = abiCoder.encode(constructorTypes, constructorArgs);
    // Remove '0x' from encoded args and append to bytecode
    deployData = bytecode + encodedArgs.slice(2);
  }
  
  console.log('🚀 Deploying contract...');
  console.log('   Bytecode length:', deployData.length);
  console.log('   Constructor args:', constructorArgs);
  
  // Submit deployment transaction
  const tx = await salt.submitTx({
    accountId,
    to: null, // null for contract deployment
    value: '0',
    chainId,
    data: deployData,
    signer
  });
  
  console.log('⏳ Waiting for deployment...');
  const result = await tx.wait();
  
  if (result.state === 'success') {
    const contractAddress = result.broadcastReceipt?.contractAddress;
    const txHash = result.broadcastReceipt?.transactionHash;
    
    console.log('✅ Contract deployed!');
    console.log('   Address:', contractAddress);
    console.log('   TX Hash:', txHash);
    
    return {
      success: true,
      contractAddress,
      txHash,
      result
    };
  } else {
    console.log('❌ Deployment failed:', result.state);
    return {
      success: false,
      state: result.state,
      result
    };
  }
}
```

### Deploy from Solidity Source

```javascript
const solc = require('solc');
const fs = require('fs');

async function compileAndDeploy({
  sourcePath,
  contractName,
  constructorArgs = [],
  accountId,
  chainId,
  salt,
  signer
}) {
  // Read and compile contract
  console.log('📝 Compiling contract...');
  const sourceCode = fs.readFileSync(sourcePath, 'utf8');
  
  const input = {
    language: 'Solidity',
    sources: {
      [sourcePath]: { content: sourceCode }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['evm.bytecode', 'abi']
        }
      }
    }
  };
  
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  // Check for errors
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      throw new Error('Compilation failed: ' + errors.map(e => e.message).join(', '));
    }
  }
  
  const contract = output.contracts[sourcePath][contractName];
  const bytecode = '0x' + contract.evm.bytecode.object;
  const abi = contract.abi;
  
  console.log('✅ Compiled successfully');
  console.log('   Bytecode length:', bytecode.length);
  
  // Extract constructor types from ABI
  const constructor = abi.find(item => item.type === 'constructor');
  const constructorTypes = constructor
    ? constructor.inputs.map(input => input.type)
    : [];
  
  // Deploy
  const result = await deployContract({
    bytecode,
    constructorArgs,
    constructorTypes,
    accountId,
    chainId,
    salt,
    signer
  });
  
  return {
    ...result,
    abi // include ABI for future interactions
  };
}
```

---

## Contract Interactions

### Call Contract Function (Read)

```javascript
async function readContract({
  contractAddress,
  functionName,
  args = [],
  abi,
  chainId
}) {
  const provider = new ethers.providers.JsonRpcProvider(getChainRpc(chainId));
  const contract = new ethers.Contract(contractAddress, abi, provider);
  
  const result = await contract[functionName](...args);
  return result;
}
```

### Call Contract Function (Write via Salt)

```javascript
async function writeContract({
  contractAddress,
  functionName,
  args = [],
  abi,
  value = '0', // native value to send with call
  accountId,
  chainId,
  salt,
  signer
}) {
  // Encode function call
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(functionName, args);
  
  console.log(`📤 Calling ${functionName}(${args.join(', ')})`);
  
  // Submit via Salt
  const tx = await salt.submitTx({
    accountId,
    to: contractAddress,
    value, // '0' unless sending ETH with call
    chainId,
    data,
    signer
  });
  
  const result = await tx.wait();
  const txHash = result.broadcastReceipt?.transactionHash;
  
  return {
    success: result.state === 'success',
    txHash,
    result
  };
}
```

---

## Organization & Account Management

### Accept All Pending Invitations

```javascript
async function acceptAllInvitations(salt) {
  console.log('📬 Checking for invitations...');
  
  const { invitations } = await salt.getOrganisationsInvitations();
  
  if (invitations.length === 0) {
    console.log('No pending invitations');
    return [];
  }
  
  console.log(`Found ${invitations.length} invitation(s)`);
  
  const accepted = [];
  for (const invitation of invitations) {
    console.log(`   Accepting invitation to: ${invitation.organisationName || invitation.organisationId}`);
    await salt.acceptOrganisationInvitation(invitation._id);
    accepted.push(invitation);
  }
  
  console.log(`✅ Accepted ${accepted.length} invitation(s)`);
  return accepted;
}
```

### List All Accounts Across Organizations

```javascript
async function getAllAccounts(salt) {
  const orgs = await salt.getOrganisations();
  const allAccounts = [];
  
  for (const org of orgs) {
    const accounts = await salt.getAccounts(org._id);
    allAccounts.push(...accounts.map(acc => ({
      ...acc,
      organisationId: org._id,
      organisationName: org.name
    })));
  }
  
  return allAccounts;
}
```

### Participate in Account Creation (with monitoring)

```javascript
async function participateInAccountCreation(salt, signer) {
  console.log('👂 Starting account creation listener...');
  
  const listener = await salt.listenToAccountNudges(signer);
  
  // Monitor in background
  const monitorInterval = setInterval(() => {
    const queue = listener.getNudgeQueue();
    const processing = listener.getIsProcessingNudge();
    const accounts = listener.getAccounts();
    
    console.log(`📊 Status: Queue=${queue.length}, Processing=${processing}, Accounts=${accounts.length}`);
    
    if (queue.length > 0) {
      console.log('   Pending nudges:', queue);
    }
  }, 5000);
  
  // Cleanup function
  return () => {
    clearInterval(monitorInterval);
    listener.disableNudgeListener();
    console.log('✋ Stopped account creation listener');
  };
}
```

---

## Error Handling Patterns

### Robust Transaction Submission

```javascript
async function submitTransactionRobustly({
  accountId,
  to,
  value,
  chainId,
  data = '0x',
  salt,
  signer,
  maxRetries = 3
}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 Attempt ${attempt}/${maxRetries}`);
      
      // Submit transaction
      const tx = await salt.submitTx({
        accountId,
        to,
        value,
        chainId,
        data,
        signer
      });
      
      // Wait for completion
      const result = await tx.wait();
      
      if (result.state === 'success') {
        return {
          success: true,
          txHash: result.broadcastReceipt?.transactionHash,
          result
        };
      } else {
        // Transaction failed on-chain
        console.warn(`⚠️  Transaction failed: ${result.state}`);
        if (attempt < maxRetries) {
          console.log('   Retrying...');
          await sleep(5000); // Wait before retry
          continue;
        }
        return {
          success: false,
          state: result.state,
          result
        };
      }
    } catch (err) {
      console.error(`❌ Error on attempt ${attempt}:`, err.message);
      
      // Check if retryable
      if (isRetryableError(err) && attempt < maxRetries) {
        console.log('   Retrying...');
        await sleep(5000);
        continue;
      }
      
      throw err;
    }
  }
}

function isRetryableError(err) {
  const retryableMessages = [
    'socket',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'rate limit',
    '429'
  ];
  
  const message = err.message.toLowerCase();
  return retryableMessages.some(msg => message.includes(msg));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Auth Token Persistence

### Save and Reuse Auth Token

```javascript
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, '.salt-auth-token.json');

async function authenticateWithCache(salt, signer) {
  // Try to load existing token
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const tokenData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      
      // Check if token is still valid (simple expiry check)
      if (tokenData.timestamp && Date.now() - tokenData.timestamp < 24 * 60 * 60 * 1000) {
        console.log('Using cached auth token');
        salt.setAuthToken(tokenData.token);
        return;
      }
    } catch (err) {
      console.warn('Failed to load cached token:', err.message);
    }
  }
  
  // Authenticate fresh
  console.log('Authenticating with Salt...');
  await salt.authenticate(signer);
  
  // Extract and save token (if SDK exposes it)
  // Note: As of SDK 0.0.14, token extraction may not be publicly exposed
  // This is a placeholder pattern for when it becomes available
  // const token = salt.getAuthToken(); // hypothetical
  // fs.writeFileSync(TOKEN_FILE, JSON.stringify({
  //   token,
  //   timestamp: Date.now()
  // }));
}
```

---

## Multi-Chain Operations

### Send Same Transaction to Multiple Chains

```javascript
async function multiChainTransfer({
  recipientAddress,
  amount,
  chainIds, // array like [1, 137, 42161]
  accountId,
  salt,
  signer
}) {
  console.log(`📤 Sending ${amount} to ${recipientAddress} on ${chainIds.length} chains`);
  
  const results = await Promise.allSettled(
    chainIds.map(async (chainId) => {
      console.log(`   Chain ${chainId}...`);
      
      const tx = await salt.submitTx({
        accountId,
        to: recipientAddress,
        value: amount,
        chainId,
        data: '0x',
        signer
      });
      
      const result = await tx.wait();
      return {
        chainId,
        success: result.state === 'success',
        txHash: result.broadcastReceipt?.transactionHash,
        result
      };
    })
  );
  
  // Process results
  const summary = {
    successful: [],
    failed: []
  };
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        summary.successful.push(result.value);
      } else {
        summary.failed.push(result.value);
      }
    } else {
      summary.failed.push({
        chainId: chainIds[index],
        error: result.reason.message
      });
    }
  });
  
  console.log(`✅ Successful: ${summary.successful.length}/${chainIds.length}`);
  console.log(`❌ Failed: ${summary.failed.length}/${chainIds.length}`);
  
  return summary;
}
```
