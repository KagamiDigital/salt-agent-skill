# Salt SDK Complete Reference

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Complete API Reference](#complete-api-reference)
3. [Troubleshooting Matrix](#troubleshooting-matrix)
4. [Transaction Lifecycle](#transaction-lifecycle)
5. [Robos and MPC Signing](#robos-and-mpc-signing)
6. [RPC Health Requirements](#rpc-health-requirements)

---

## Core Concepts

### Two-Network Model Deep Dive

Salt's architecture separates coordination from execution:

**Orchestration Network:**
- Where Salt coordinates MPC signing
- TESTNET: Arbitrum Sepolia (421614)
- MAINNET: Arbitrum One (42161)
- Handles: API calls, websocket connections, signature collection
- **Your signer MUST be on this chain**

**Destination Network:**
- Where the final transaction executes
- Can be any supported blockchain
- Examples: Ethereum mainnet (1), Polygon (137), Base (8453)
- **Your signer does NOT need to be on this chain**

**Common mistake**: Switching signer to match destination chain instead of orchestration chain.

**Why this matters**: SDK's `assertCorrectChain` validates that your signer matches the orchestration chain. If mismatched, authentication will fail.

### Account Identity Deep Dive

`SaltAccount` has two addresses with different purposes:

**`account.address` (vault address):**
- The orchestration contract address
- Used internally by Salt for coordination
- **DO NOT** share this for receiving funds
- Used in: vault operations, internal channels

**`account.publicKey` (external identity):**
- The actual blockchain address for this account
- **USE THIS** for receiving funds
- Share this address with others
- This is what appears on block explorers

**In SDK internals:**
```javascript
// SDK maps these automatically
vaultAddress ← account.address
vaultPublicKey ← account.publicKey
```

### Value Semantics Deep Dive

Salt's underlying `submitTransaction` uses `parseEther` for native values.

**For Native Transfers:**
```javascript
// ✅ Correct - decimal string
value: '0.1'   // 0.1 ETH
value: '1.5'   // 1.5 ETH

// ❌ Wrong - wei string
value: '100000000000000000'  // Will be parsed as massive amount
```

**For ERC20 Transfers:**
```javascript
// ✅ Correct - value is '0', amount in calldata
{
  value: '0',
  data: iface.encodeFunctionData('transfer', [to, parseUnits('10', 6)])
}

// ❌ Wrong - value not '0'
{
  value: '10',  // Don't do this for ERC20
  data: transferData
}
```

---

## Complete API Reference

### Authentication

**`authenticate(signer)`**
- Authenticates with Salt using an ethers signer
- Returns: Promise<void>
- Requirements: Signer must be on orchestration chain
- Side effects: Sets internal auth token, opens websocket connection

**`setAuthToken(token)`**
- Sets authentication token manually (for reusing sessions)
- Use case: Avoid re-authenticating on every script run
- Returns: void

### Organization Management

**`getOrganisations()`**
- Returns: `Promise<Organisation[]>`
- Fields: `{ _id, name, ... }`

**`getOrganisationsInvitations()`**
- Returns: `Promise<{ invitations: Invitation[] }>`
- Invitation fields: `{ _id, organisationId, ... }`
- **Note**: Use `_id` not `id`

**`acceptOrganisationInvitation(invitationId)`**
- Param: `invitationId` (string) - the `_id` from invitation
- Returns: Promise<void>

### Account Management

**`getAccounts(organisationId)`**
- Returns: `Promise<SaltAccount[]>`
- Fields: `{ id, address, publicKey, ... }`

**`getAccount(accountId)`**
- Returns: `Promise<SaltAccount>`
- Use for: Getting single account details

**`getAccountTokens(accountId)`**
- Returns: Promise<Token[]>
- **Note**: Non-exhaustive list, may not include all tokens

**`getAccountNonce(accountId, chainId)`**
- Returns: Promise<number>
- Use for: Checking transaction nonce

### Transaction Submission

**`submitTx(params)`**

Params:
```typescript
{
  accountId: string,       // Salt account ID
  to: string | null,       // Recipient (null for contract deployment)
  value: string,           // Decimal string for native, '0' for ERC20
  chainId: number,         // Destination chain
  data: string,            // Hex data ('0x' for simple transfers)
  signer: ethers.Signer    // Must match orchestration chain
}
```

Returns: `Transaction` object

**Transaction object methods:**
- `tx.wait()` - Wait for transaction to complete (ALWAYS call this)
- Returns result with: `{ state, broadcastReceipt, txHash, ... }`

### Gas Management

**`getGasPrice(chainId)`**
- Returns: Promise<GasPrice>
- Use for: Getting current gas prices for a chain

### Nudges (Account Creation)

**`listenToAccountNudges(signer)`**
- Starts listening for account creation requests
- Returns: NudgeListener object
- Must keep running to participate in account creation

**NudgeListener methods:**
- `getNudgeQueue()` - Get pending nudges
- `getIsProcessingNudge()` - Check if currently processing
- `getAccounts()` - Get accounts created via nudges
- `disableNudgeListener()` - Temporarily pause
- `enableNudgeListener()` - Resume listening

### Robo Status

**`getRoboStatus(accountId)`**
- Returns: `Promise<{ id, online }>`
- Use before: Transaction submission, account creation
- **Note**: May return 403 (permission denied) but operations can still work
- Robos are non-human signers that participate silently in MPC

---

## Troubleshooting Matrix

### InvalidAuthToken

**Symptoms:**
- "Invalid auth token" error
- API calls rejected after authentication

**Causes:**
- Token expired
- Token not properly saved/loaded
- Websocket disconnected

**Fix:**
1. Re-authenticate with signer: `await salt.authenticate(signer)`
2. Verify token storage if using `setAuthToken`
3. Check websocket connection status

### InvalidSigner

**Symptoms:**
- "Invalid signer" error
- Authentication fails

**Causes:**
- Signer object missing required methods
- Signer not connected to provider
- Signer is null/undefined

**Fix:**
1. Ensure signer has `getAddress()` method
2. Connect signer to provider: `new ethers.Wallet(key, provider)`
3. Verify signer object is valid

### WrongChain / Chain Mismatch

**Symptoms:**
- "Wrong chain" error
- `assertCorrectChain` fails

**Causes:**
- Signer on wrong chain (most common)
- Provider connected to destination chain instead of orchestration

**Fix:**
1. Determine orchestration chain:
   - TESTNET → 421614 (Arbitrum Sepolia)
   - MAINNET → 42161 (Arbitrum One)
2. Connect signer to orchestration chain RPC
3. Verify: `await signer.getChainId()` matches orchestration

### InvalidChain

**Symptoms:**
- "Invalid chain" or "Unsupported chainId" error

**Causes:**
- Destination chainId not supported by Salt
- ChainId typo (e.g., 1 instead of 11155111)

**Fix:**
1. Verify chainId is correct for destination network
2. Check Salt SDK supported chains documentation
3. Common chains: 1 (Ethereum), 137 (Polygon), 42161 (Arbitrum One)

### SaltAccountError

**Symptoms:**
- "Account not found" error
- "Access denied" to account

**Causes:**
- AccountId doesn't exist
- Caller doesn't have access to account
- AccountId typo

**Fix:**
1. List accounts: `await salt.getAccounts(orgId)`
2. Verify accountId matches exactly
3. Check organization membership

### SocketConnectError

**Symptoms:**
- Websocket connection fails
- "Unable to connect" errors
- Transactions hang indefinitely

**Causes:**
- Network connectivity issues
- Firewall blocking websocket
- Salt service unavailable

**Fix:**
1. Check internet connectivity
2. Verify websocket ports (typically 443) not blocked
3. Try re-authenticating: `await salt.authenticate(signer)`
4. Check Salt service status

### ValidationError / InvalidAddress / InvalidValue

**Symptoms:**
- "Invalid address" error
- "Invalid value" error
- Parameter validation fails

**Causes:**
- Malformed address (not checksummed, wrong length)
- Invalid value format (wei instead of decimal)
- Missing required parameters

**Fix:**
1. Validate address format: 42 characters, starts with 0x
2. Use decimal strings for value: `'0.1'` not `'100000000000000000'`
3. For contract deployment: use `to: null`, not empty string or zero address
4. Check all required params are present

### InsufficientGas

**Symptoms:**
- Transaction fails at BROADCAST stage
- "Out of gas" errors
- "Insufficient funds for gas" errors

**Causes:**
- Gas price too low
- Gas limit too low
- Insufficient balance in account

**Fix:**
1. Check account balance: `provider.getBalance(account.publicKey)`
2. Get current gas price: `await salt.getGasPrice(chainId)`
3. Verify destination chain has sufficient balance
4. Wait for gas prices to decrease if using low-gas chain

### Transaction Stuck in State

**Symptoms:**
- Transaction stays in PROPOSE/SIGN/COMBINE
- Never reaches BROADCAST

**Causes:**
- Robos offline (can't collect signatures)
- Network issues
- MPC signing coordination failure

**Fix:**
1. Check robo status: `await salt.getRoboStatus(accountId)`
2. Wait longer (MPC can take 30-60 seconds)
3. Check websocket connection
4. If robos offline, wait for them to come back online
5. Re-submit transaction if stuck >5 minutes

---

## Transaction Lifecycle

### State Flow

```
[*] → PROPOSE → SIGN → COMBINE → BROADCAST → SUCCESS
                 ↓        ↓          ↓          ↓
               FAILURE  FAILURE   FAILURE   FAILURE
```

### State Descriptions

**PROPOSE:**
- Transaction proposal created in Salt system
- Sent to all signers for approval
- Waiting for MPC coordination to begin

**SIGN:**
- Signers (including robos) collecting partial signatures
- MPC signing in progress
- Can take 30-60 seconds

**COMBINE:**
- Partial signatures being combined into final signature
- Final transaction being assembled
- Quick step (usually <5 seconds)

**BROADCAST:**
- Final transaction being broadcast to destination chain
- Waiting for on-chain confirmation
- Time depends on destination chain block time

**SUCCESS:**
- Transaction confirmed on destination chain
- Terminal state
- Transaction hash available in `result.broadcastReceipt.transactionHash`

**FAILURE:**
- Transaction failed at some stage
- Terminal state
- Check error message for details

### Extracting Results

```javascript
const result = await tx.wait();

// State (always lowercase)
if (result.state === 'success') {
  // Extract transaction hash
  const txHash = result.broadcastReceipt?.transactionHash || result.txHash;
  
  // For contract deployment
  const contractAddress = result.broadcastReceipt?.contractAddress;
  
  // Full receipt
  const receipt = result.broadcastReceipt;
}
```

**Important notes:**
- `result.state` is lowercase: `'success'` not `'SUCCESS'`
- Transaction hash location: `broadcastReceipt.transactionHash` (primary), fallback to `result.txHash`
- Contract address: `broadcastReceipt.contractAddress`

---

## Robos and MPC Signing

### What are Robos?

Robos are non-human, non-agent signers that participate in MPC signing:
- Silent participants (no UI interaction)
- Run 24/7 in Salt infrastructure
- Required for both account creation and transaction execution
- Each account has multiple signers: humans + agents + robos

### Why Robos Matter

**For Account Creation:**
- New accounts need threshold signatures from all parties
- Robos must be online to participate in setup
- If robos offline, account creation will hang

**For Transactions:**
- Each transaction needs threshold signatures
- Robos must sign along with human/agent
- If robos offline, transactions will hang in SIGN state

### Checking Robo Status

```javascript
try {
  const status = await salt.getRoboStatus(accountId);
  if (status.online) {
    console.log('✅ Robos online, safe to proceed');
  } else {
    console.warn('⚠️  Robos offline, operations may fail');
  }
} catch (err) {
  if (err.message.includes('403')) {
    // Permission denied - endpoint not accessible
    // Operations may still work, this is non-blocking
    console.warn('Robo status check not available (403)');
  } else {
    throw err;
  }
}
```

**Best practice:**
- Check before submitting transactions
- Check before participating in account creation
- Don't block on 403 errors (common permission issue)
- Wait for robos to come online if critical operation

---

## RPC Health Requirements

RPC quality directly impacts transaction reliability and perceived status.

### Why RPC Health Matters

**Poor RPC symptoms:**
- Transactions appear stuck
- Status updates delayed
- Receipt queries fail
- Nonce mismatches

**Root causes:**
- Rate limiting
- Slow response times
- Stale data
- Wrong chain

### Minimum Health Checks

Before retrying failed transactions:

1. **Connectivity**: Provider responds to basic calls
   ```javascript
   await provider.getBlockNumber(); // Should be fast
   ```

2. **Correct Chain**: Provider is on expected chain
   ```javascript
   const chainId = (await provider.getNetwork()).chainId;
   // Verify matches expectation
   ```

3. **Not Rate Limited**: Responses return without 429 errors
   ```javascript
   // Watch for rate limit errors in try/catch
   ```

4. **Fresh Data**: Recent block numbers
   ```javascript
   const block = await provider.getBlock('latest');
   const age = Date.now() / 1000 - block.timestamp;
   // Should be <60 seconds for active chains
   ```

### Operational Best Practices

**For production agents:**
- Maintain fallback RPC endpoints
- Rotate providers on failures
- Monitor RPC response times
- Cache provider health status

**RPC config pattern:**
```javascript
const RPC_ENDPOINTS = {
  ARBITRUM_SEPOLIA: [
    'https://sepolia-rollup.arbitrum.io/rpc',
    'https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY',
    // Fallbacks...
  ]
};

// Try endpoints in order until one works
for (const rpcUrl of RPC_ENDPOINTS.ARBITRUM_SEPOLIA) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    await provider.getBlockNumber(); // Health check
    // Use this provider
    break;
  } catch (err) {
    // Try next endpoint
    continue;
  }
}
```

**Before retries:**
- Validate provider health first
- Switch to fallback RPC if needed
- Don't brute-force retry without checking

### Common RPC Issues

**Alchemy/Infura rate limits:**
- Symptom: 429 Too Many Requests
- Fix: Use API key, upgrade tier, or add fallback

**Stale block data:**
- Symptom: Receipt not found for known transaction
- Fix: Switch to different RPC, wait longer, query directly on-chain

**Wrong network:**
- Symptom: Transaction not found, nonce mismatch
- Fix: Verify RPC URL matches expected chain

**Slow responses:**
- Symptom: Operations timeout
- Fix: Use faster RPC, add request timeout, switch provider
