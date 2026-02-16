# Token Sweeper Strategy

A generalized automation strategy for Salt SDK that monitors a Salt account for token deposits and automatically sweeps them into any DeFi protocol or smart contract.

**Key Features:**
- 🔧 **Fully configurable** - works with any ERC20 token, any protocol, any EVM chain
- 📦 **Protocol templates** - pre-configured for Aave, Compound, and more
- 🔔 **Notifications** - Telegram, Discord, or any OpenClaw-supported channel
- 📊 **State tracking** - maintains sweep history and statistics
- 🛡️ **Safe** - uses Salt's MPC for secure transaction signing

## Quick Start

### 1. Initialize Configuration

```bash
# From anywhere in your system
node ~/.openclaw/workspace/skills/salt-sdk/strategies/token-sweeper/sweeper.js --init

# Or use a shorter alias
cd ~/.openclaw/workspace/skills/salt-sdk/strategies/token-sweeper
node sweeper.js --init
```

This creates `sweeper-config.json` with a template configuration.

### 2. Or Use a Protocol Template

Copy a pre-configured protocol template:

```bash
# Aave V3 on Arbitrum Sepolia
cp protocols/aave-v3-arb-sepolia.json config.json

# Compound V3 on Arbitrum Mainnet
cp protocols/compound-v3-mainnet.json config.json
```

### 3. Configure Your Details

Edit `config.json` with your specific values:

```json
{
  "account": {
    "id": "YOUR_SALT_ACCOUNT_ID",        // From salt status
    "publicKey": "YOUR_SALT_PUBLIC_KEY"  // The external receiving address
  },
  "notifications": {
    "target": "YOUR_TELEGRAM_USER_ID"    // From Telegram
  }
}
```

**Finding your Salt account ID:**
```bash
salt status -t  # testnet
salt status -m  # mainnet
```

**Finding your Telegram user ID:**
Send a message to your bot, then check the conversation metadata in OpenClaw.

### 4. Run the Sweeper

```bash
# Define path for convenience (or use full path)
SWEEPER=~/.openclaw/workspace/skills/salt-sdk/strategies/token-sweeper/sweeper.js

# Start monitoring (runs as background process)
nohup node $SWEEPER > sweeper.log 2>&1 &

# View logs
tail -f sweeper.log

# Check status
node $SWEEPER --report

# Stop
node $SWEEPER --stop
```

**Note:** The sweeper uses relative paths to find Salt SDK dependencies, so it works from any directory.

## Configuration Reference

### Full Config Schema

```json
{
  "name": "my-sweeper",
  "chain": {
    "id": 421614,
    "name": "Arbitrum Sepolia",
    "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
    "explorer": "https://sepolia.arbiscan.io"
  },
  "token": {
    "address": "0x...",
    "symbol": "USDC",
    "decimals": 6
  },
  "account": {
    "id": "salt-account-id",
    "publicKey": "0x..."
  },
  "protocol": {
    "name": "Aave V3",
    "address": "0x...",
    "action": "supply",
    "actionAbi": "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
    "actionParams": ["${token.address}", "${amount}", "${account.publicKey}", 0]
  },
  "polling": {
    "intervalSeconds": 60,
    "sweepThreshold": 0.01
  },
  "notifications": {
    "enabled": true,
    "channel": "telegram",
    "target": "user-id-or-chat-id"
  }
}
```

### Configuration Fields

#### `chain`
- **`id`**: Chain ID (421614 = Arb Sepolia, 42161 = Arb One, etc.)
- **`name`**: Human-readable chain name
- **`rpcUrl`**: RPC endpoint for the chain
- **`explorer`**: Block explorer base URL (for transaction links)

#### `token`
- **`address`**: ERC20 token contract address
- **`symbol`**: Token symbol (for logging)
- **`decimals`**: Token decimals (6 for USDC, 18 for most tokens)

#### `account`
- **`id`**: Salt account ID (from `salt status`)
- **`publicKey`**: Salt account public key / external receiving address

#### `protocol`
- **`name`**: Protocol name (for logging)
- **`address`**: Target protocol contract address
- **`action`**: Function name to call (e.g., "supply", "deposit", "mint")
- **`actionAbi`**: Full function signature with types
- **`actionParams`**: Array of parameters (supports template variables)

**Template Variables:**
- `${token.address}` - Replaced with token address
- `${amount}` - Replaced with sweep amount
- `${account.publicKey}` - Replaced with account public key

#### `polling`
- **`intervalSeconds`**: How often to check for deposits (default: 60)
- **`sweepThreshold`**: Minimum balance to trigger sweep (decimal string)

#### `notifications`
- **`enabled`**: Enable/disable notifications
- **`channel`**: OpenClaw channel (telegram, discord, whatsapp, etc.)
- **`target`**: Target user ID or chat ID

## Protocol Examples

### Aave V3 - Supply USDC

```json
{
  "protocol": {
    "name": "Aave V3",
    "address": "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff",
    "action": "supply",
    "actionAbi": "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
    "actionParams": ["${token.address}", "${amount}", "${account.publicKey}", 0]
  }
}
```

### Compound V3 - Supply USDC

```json
{
  "protocol": {
    "name": "Compound V3",
    "address": "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
    "action": "supply",
    "actionAbi": "function supply(address asset, uint256 amount)",
    "actionParams": ["${token.address}", "${amount}"]
  }
}
```

### Uniswap V3 - Add Liquidity Single-Sided

```json
{
  "protocol": {
    "name": "Uniswap V3 Position Manager",
    "address": "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    "action": "increaseLiquidity",
    "actionAbi": "function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline))",
    "actionParams": [{
      "tokenId": "YOUR_POSITION_TOKEN_ID",
      "amount0Desired": "${amount}",
      "amount1Desired": 0,
      "amount0Min": 0,
      "amount1Min": 0,
      "deadline": 9999999999
    }]
  }
}
```

### Custom Contract Call

```json
{
  "protocol": {
    "name": "My Custom Vault",
    "address": "0xYourContractAddress",
    "action": "deposit",
    "actionAbi": "function deposit(uint256 amount, address recipient)",
    "actionParams": ["${amount}", "${account.publicKey}"]
  }
}
```

## Advanced Usage

### Multiple Sweepers

Run multiple sweepers with different configs:

```bash
# Sweeper 1: USDC → Aave
SWEEPER_CONFIG=aave-config.json nohup node sweeper.js > aave.log 2>&1 &

# Sweeper 2: DAI → Compound
SWEEPER_CONFIG=compound-config.json nohup node sweeper.js > compound.log 2>&1 &
```

### Custom Wallet Location

```bash
WALLET_CONFIG=/path/to/wallet.json node sweeper.js
```

### Monitoring & Reports

```bash
# Get current status
node sweeper.js --report

# Output:
# {
#   "name": "aave-usdc-sweep",
#   "account": "0x...",
#   "chain": "Arbitrum Sepolia",
#   "token": "USDC",
#   "balance": "0.0",
#   "protocol": "Aave V3",
#   "sweepCount": 5,
#   "totalSwept": "10.5",
#   "lastSweep": "2026-02-16T19:18:06.683Z",
#   "lastTxHash": "0x...",
#   "explorerLink": "https://..."
# }
```

## How It Works

1. **Monitor**: Polls the Salt account for token balance every N seconds
2. **Threshold Check**: When balance ≥ `sweepThreshold`, triggers sweep
3. **Approve**: Submits ERC20 approval via Salt MPC
4. **Execute**: Calls the protocol function via Salt MPC
5. **Notify**: Sends notification with transaction link
6. **Track**: Updates state file with sweep statistics

## Troubleshooting

### "No wallet found"

Ensure you have a wallet config at one of these locations:
- `.agent-wallet.json` (current directory)
- `~/.openclaw/workspace/.agent-wallet.json`
- `~/.salt-cli.json`

Create one with:
```bash
node ../../scripts/create-wallet.js
```

### "Config file not found"

Run `node sweeper.js --init` to create a template, or set `SWEEPER_CONFIG`:
```bash
SWEEPER_CONFIG=/path/to/config.json node sweeper.js
```

### "Approval failed" or "Action failed"

- Check that your Salt account has enough gas (ETH) for transactions
- Verify protocol contract address is correct for your chain
- Ensure ABI and parameters match the actual contract function
- Check logs for specific error messages

### Process Keeps Getting Killed

If running via `exec`, use `nohup` with background mode:
```bash
nohup node sweeper.js > sweeper.log 2>&1 &
```

To stop:
```bash
node sweeper.js --stop
# or
pkill -f "node.*sweeper.js"
```

## Security Notes

- ✅ Uses Salt MPC for secure transaction signing
- ✅ No private keys are exposed to the protocol
- ✅ State files contain no sensitive data
- ⚠️ Ensure your wallet has sufficient gas
- ⚠️ Test on testnet first before mainnet
- ⚠️ Review protocol contracts before use

## Contributing

Found a useful protocol configuration? Submit a PR with your template in `protocols/`!

## License

MIT - Same as Salt SDK skill
