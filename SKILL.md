---
name: salt-sdk
description: Work with Salt SDK for MPC-orchestrated blockchain transactions. Use when handling Salt SDK operations, MPC wallets, Salt accounts, blockchain transactions via Salt orchestration, account creation participation, organization invitations, or debugging Salt transaction states (propose/sign/combine/broadcast). Critical for understanding two-network model (orchestration vs destination chain) and account identity (address vs publicKey).
---

# Salt SDK Skill

## Quick Start

Salt is an MPC orchestration system that coordinates distributed signing across multiple parties. Before using Salt, understand these **non-negotiable concepts**:

### Two-Network Model

Every Salt transaction touches two networks:

- **Orchestration chain** (from `Salt({ environment })`):
  - TESTNET → Arbitrum Sepolia (421614)
  - MAINNET → Arbitrum One (42161)
  - Drives API/websocket/signing coordination
  
- **Destination chain** (from `submitTx({ chainId })`):
  - Where the transaction is finally broadcast and executed
  - Can be any supported blockchain

**Critical rule**: Signer chain MUST match orchestration chain, NOT destination chain.

### Account Identity

Salt accounts have two addresses - **never confuse them**:

- `account.address` = vault/orchestration contract (internal coordination)
- `account.publicKey` = external receiving address (**use this for receiving funds**)

### Value Semantics

For native token transfers:
- ✅ Use decimal strings: `'0.1'`, `'1.5'`
- ❌ Don't use wei strings

For ERC20 transfers:
- Set `value: '0'`
- Encode amount in calldata via ethers Interface

## Standard Workflow

```javascript
const { Salt } = require('salt-sdk');
const { ethers } = require('ethers');

// 1. Setup
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// 2. Authenticate
const salt = new Salt({ environment: 'TESTNET' }); // or 'MAINNET'
await salt.authenticate(signer);

// 3. Get account
const orgs = await salt.getOrganisations();
const accounts = await salt.getAccounts(orgs[0]._id);
const account = accounts[0];

// 4. Submit transaction
const tx = await salt.submitTx({
  accountId: account.id,
  to: recipientAddress,
  value: '0.01', // decimal string for native transfers
  chainId: 421614, // destination chain
  data: '0x',
  signer: signer // MUST match orchestration chain
});

// 5. Wait for completion (ALWAYS!)
const result = await tx.wait();
console.log('State:', result.state); // 'success' or 'failure'

// 6. Extract transaction hash
const txHash = result.broadcastReceipt?.transactionHash;
```

## Common Operations

### Check Organization Invitations

```javascript
const { invitations } = await salt.getOrganisationsInvitations();
for (const inv of invitations) {
  await salt.acceptOrganisationInvitation(inv._id); // note: _id not id
}
```

### Participate in Account Creation

```javascript
const listener = await salt.listenToAccountNudges(signer);

// Monitor queue
setInterval(() => {
  const queue = listener.getNudgeQueue();
  const processing = listener.getIsProcessingNudge();
  console.log('Pending:', queue.length, 'Processing:', processing);
}, 5000);
```

### ERC20 Transfer

```javascript
const { ethers } = require('ethers');

const erc20Abi = ['function transfer(address to, uint256 amount)'];
const iface = new ethers.utils.Interface(erc20Abi);
const amount = ethers.utils.parseUnits('10', 6); // 10 USDC (6 decimals)

const data = iface.encodeFunctionData('transfer', [recipient, amount]);

await salt.submitTx({
  accountId,
  to: tokenContractAddress,
  value: '0', // MUST be '0' for ERC20
  chainId: 421614,
  data: data,
  signer: signer
});
```

### Contract Deployment

```javascript
const tx = await salt.submitTx({
  accountId,
  to: null, // null for contract creation
  value: '0',
  chainId: 421614,
  data: compiledBytecode,
  signer: signer
});

const result = await tx.wait();
const contractAddress = result.broadcastReceipt?.contractAddress;
```

## Key APIs

- `authenticate(signer)` - Authenticate with Salt
- `getOrganisations()` - List your organizations
- `getAccounts(orgId)` - List accounts in org
- `getAccount(accountId)` - Get specific account details
- `submitTx(params)` - Submit transaction (returns Transaction object)
- `listenToAccountNudges(signer)` - Participate in account creation
- `getOrganisationsInvitations()` - Check pending invitations
- `acceptOrganisationInvitation(invitationId)` - Accept invitation

## Do's and Don'ts

**Do:**
- Always `await tx.wait()` before reporting results
- Use `account.publicKey` for receiving funds
- Use decimal strings for native transfers (`'0.1'`)
- Check signer is on orchestration chain
- Use ABI encoding for contract interactions

**Don't:**
- Use `account.address` as receiving address
- Use wei strings for native transfers
- Assume `submitTx()` return value is final result
- Use zero address (`0x0000...`) for contract deployment
- Skip the `.wait()` call

## Transaction States

`PROPOSE` → `SIGN` → `COMBINE` → `BROADCAST` → `SUCCESS` / `FAILURE`

All states are lowercase strings. Always check `result.state === 'success'`.

## Salt CLI Tool

A command-line tool for both humans and agents. Agents: read **[CLI_PATTERNS.md](CLI_PATTERNS.md)** to interpret natural language requests.

### Core Commands

**`salt init`** - Check invites, list accounts, start listener
```bash
salt init -t                    # testnet
salt init -m                    # mainnet
salt init -t --no-listen        # skip listener
```

**`salt submit`** - Universal transaction command
```bash
# Native send
salt submit --to 0x123... --value 0.01 -t

# ERC20/Contract call
salt submit --to 0xToken... --value 0 --data 0x... -t

# Deploy contract
salt submit --deploy --data 0x<bytecode> -t
```

**`salt invites`** - Manage invitations
```bash
salt invites list -t
salt invites accept --id <id> -t
salt invites accept-all -t
```

**`salt listen`** - Start nudge listener
```bash
salt listen -t                  # start listener
salt stop -t                    # stop listener
```

**`salt -help`** - Show all commands

## Detailed Reference

For complete troubleshooting, API details, and advanced patterns:

- **[CLI_PATTERNS.md](CLI_PATTERNS.md)** - How agents interpret natural language requests and map to CLI commands
- **[REFERENCE.md](references/REFERENCE.md)** - Full API reference and troubleshooting matrix
- **[PATTERNS.md](references/PATTERNS.md)** - Advanced patterns and code examples
- **[scripts/](scripts/)** - Working example scripts

Read these as needed for complex scenarios or debugging.
