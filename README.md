# Salt SDK Skill & CLI

A comprehensive OpenClaw skill and CLI tool for working with Salt SDK - MPC-orchestrated blockchain transactions.

## What is Salt?

Salt is an MPC (Multi-Party Computation) orchestration system that enables secure, distributed signing for blockchain transactions. It separates transaction coordination from execution, allowing multiple parties to collectively sign transactions without any single party having full control.

## Features

### OpenClaw Skill

- **Auto-discovery**: Automatically triggers when working with Salt SDK operations
- **Progressive loading**: Loads only what's needed (metadata → quick start → detailed reference)
- **Comprehensive reference**: Full API docs, troubleshooting, and code patterns
- **Working examples**: Scripts for common operations

### CLI Tool

A command-line tool for both humans and agents to interact with Salt SDK.

**Current Commands:**

- `salt status` - Check Salt status: view invites, organizations, accounts, and balances

**Coming Soon:**

- `salt send` - Send native tokens
- `salt transfer` - Transfer ERC20 tokens
- `salt deploy` - Deploy smart contracts
- `salt invite accept` - Accept organization invitations
- `salt account create` - Participate in account creation

## Installation

### For OpenClaw Agents

Install the skill package directly from the GitHub release:

```bash
openclaw skills install https://github.com/KagamiDigital/salt-agent-skill/releases/download/v1.0.0/salt-sdk.skill
```

The skill will be installed to `~/.openclaw/workspace/skills/salt-sdk/` and automatically discovered when working with Salt operations.

### For Manual/Development Installation

Clone or download the repository and place in the OpenClaw skills directory:

```bash
# Clone to skills directory
git clone https://github.com/KagamiDigital/salt-agent-skill.git ~/.openclaw/workspace/skills/salt-sdk
cd ~/.openclaw/workspace/skills/salt-sdk
npm install
```

### As CLI Tool (for humans)

```bash
# Install dependencies
npm install

# Link globally (for development)
npm link

# Or install from package
npm install -g salt-cli
```

## CLI Usage

### Prerequisites: Wallet Setup

**REQUIRED**: You need a wallet to use Salt CLI. 

#### Check if Wallet Exists

The CLI looks for wallet configuration at:
- `~/.openclaw/workspace/.agent-wallet.json`
- `.agent-wallet.json` (current directory)
- `~/.salt-cli.json`

#### Create a Wallet (if needed)

**Quick method:**
```bash
node scripts/create-wallet.js
```

This will:
- Generate a new random wallet
- Save to `~/.openclaw/workspace/.agent-wallet.json`
- Display your address and mnemonic
- Set secure file permissions (0600)

**Manual method:**
```javascript
const { ethers } = require('ethers');
const fs = require('fs');

const wallet = ethers.Wallet.createRandom();

const config = {
  privateKey: wallet.privateKey,
  address: wallet.address,
  mnemonic: wallet.mnemonic.phrase
};

fs.writeFileSync('.agent-wallet.json', JSON.stringify(config, null, 2));
console.log('Address:', wallet.address);
console.log('Mnemonic:', wallet.mnemonic.phrase);
```

**⚠️ Security:**
- Never share private key or mnemonic
- Backup mnemonic securely
- Don't commit wallet files to git (already in .gitignore)

#### Fund Your Wallet

**Testnet (Arbitrum Sepolia):**
- Use faucet: https://faucet.quicknode.com/arbitrum/sepolia
- Paste your wallet address to receive test ETH

**Mainnet (Arbitrum One):**
- Transfer ETH from another wallet
- Bridge from Ethereum: https://bridge.arbitrum.io/

### Configuration

Wallet configuration file format:

- `.agent-wallet.json` (current directory)
- `~/.openclaw/workspace/.agent-wallet.json`
- `~/.salt-cli.json`

**Format:**
```json
{
  "privateKey": "0x...",
  "address": "0x..."
}
```

Or with mnemonic:
```json
{
  "mnemonic": "word1 word2 ...",
  "address": "0x..."
}
```

**RPC Configuration (optional):**

Create `.rpc-config.json`:
```json
{
  "ARBITRUM_SEPOLIA": {
    "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc"
  },
  "ARBITRUM_ONE": {
    "rpcUrl": "https://arb1.arbitrum.io/rpc"
  }
}
```

### Commands

#### `salt status`

Check Salt status: view pending invitations, organizations, accounts, and balances.

**Usage:**
```bash
# Mainnet (default)
salt status

# Testnet
salt status -t
salt status --testnet

# Mainnet (explicit)
salt status -m
salt status --mainnet
```

**Output:**
- Wallet address and balance
- Pending organization invitations
- All organizations you're part of
- All accounts with:
  - Name
  - Account ID
  - Public address (for receiving funds)
  - Number of signers
  - Native token balance

## Skill Structure

```
salt-sdk/
├── SKILL.md              # Quick-start guide (loaded on trigger)
├── references/
│   ├── REFERENCE.md      # Complete API reference
│   └── PATTERNS.md       # Advanced code patterns
├── scripts/
│   ├── send-transaction.js
│   └── check-status.js
├── bin/
│   └── salt.js           # CLI entry point
├── lib/
│   ├── commands/
│   │   └── init.js       # Command implementations
│   └── utils/
│       ├── config.js     # Config loading
│       └── format.js     # Formatting utilities
└── package.json
```

## Development

### Version Control

The skill is version-controlled with git:

```bash
cd skills/salt-sdk
git status
git add .
git commit -m "Your message"
```

### Adding New Commands

1. Create command file in `lib/commands/`
2. Add command to `bin/salt.js`
3. Update this README
4. Test thoroughly
5. Commit changes

### Packaging Skill

To create a distributable `.skill` file:

```bash
python3 /path/to/openclaw/skills/skill-creator/scripts/package_skill.py /path/to/salt-sdk
```

This creates `salt-sdk.skill` that can be shared with other OpenClaw users.

## Key Concepts

### Two-Network Model

- **Orchestration chain**: Where Salt coordinates signing (TESTNET: 421614, MAINNET: 42161)
- **Destination chain**: Where transaction executes (any supported blockchain)
- **Critical**: Signer must match orchestration chain, NOT destination chain

### Account Identity

- `account.address` = vault/orchestration contract (internal use)
- `account.publicKey` = external receiving address (**use for receiving funds**)

### Value Semantics

- Native transfers: Use decimal strings (`'0.1'`, `'1.5'`)
- ERC20 transfers: Set `value: '0'`, encode amount in calldata

## Resources

- **Skill docs**: See `SKILL.md` for quick start
- **Complete reference**: See `references/REFERENCE.md`
- **Code patterns**: See `references/PATTERNS.md`
- **Example scripts**: See `scripts/`

## Version

Current version: **0.1.0**

## License

MIT

## Contributing

This skill is actively maintained. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Or reach out to discuss improvements!
