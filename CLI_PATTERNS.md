# Salt CLI - Natural Language Patterns for Agents

This guide helps agents interpret natural language requests and translate them into correct Salt CLI commands.

## Request Interpretation Patterns

### Native Token Transfers

**User says:**
- "send 3 ETH to 0x123..."
- "transfer 0.5 ETH to 0xABC... from account Y"
- "send 0.01 to 0x456... on testnet"

**Agent translates to:**
```bash
salt submit --to 0x123... --value 3 -t
salt submit --to 0xABC... --value 0.5 --account <account-y-id> -t
salt submit --to 0x456... --value 0.01 -t
```

**Pattern:**
- `send/transfer X to Y` → `salt submit --to Y --value X`
- `from account Z` → add `--account <account-id>`
- `on testnet` → add `-t`
- `on mainnet` → add `-m` (or omit, it's default)

### ERC20 Token Transfers

**User says:**
- "send 10 USDC to 0x123..."
- "transfer 100 tokens at 0xUSDC... to 0xABC..."

**Agent must:**
1. Encode the transfer using ethers:
   ```javascript
   const iface = new ethers.utils.Interface(['function transfer(address to, uint256 amount)']);
   const amount = ethers.utils.parseUnits('10', 6); // USDC has 6 decimals
   const data = iface.encodeFunctionData('transfer', ['0x123...', amount]);
   ```

2. Execute:
   ```bash
   salt submit --to 0xUSDC... --value 0 --data <encoded-data> -t
   ```

**Pattern:**
- ERC20 transfers ALWAYS have `--value 0`
- Encode amount in `--data` field
- `--to` is the token contract address

### Contract Deployment

**User says:**
- "deploy this contract on testnet"
- "deploy contract with bytecode 0x608060..."
- "deploy SimpleStorage contract"

**Agent must:**
1. Compile contract if needed (get bytecode)
2. Execute:
   ```bash
   salt submit --deploy --data 0x<bytecode> -t
   ```

**Pattern:**
- Contract deployment uses `--deploy` flag
- No `--to` needed (deployment ignores it)
- Bytecode goes in `--data`
- Constructor args must be encoded and appended to bytecode

### Contract Calls

**User says:**
- "call approve on 0xUSDC... for spender 0xDEX... amount 100"
- "set value to 42 on SimpleStorage at 0x123..."

**Agent must:**
1. Encode function call:
   ```javascript
   const iface = new ethers.utils.Interface(['function approve(address spender, uint256 amount)']);
   const data = iface.encodeFunctionData('approve', ['0xDEX...', ethers.utils.parseUnits('100', 6)]);
   ```

2. Execute:
   ```bash
   salt submit --to 0xUSDC... --value 0 --data <encoded-data> -t
   ```

**Pattern:**
- `--to` is the contract address
- `--value 0` unless sending ETH with call
- Function call encoded in `--data`

### Check Balances

**User says:**
- "check my balances"
- "what's my ETH balance on testnet"
- "show account balances"

**Agent translates to:**
```bash
salt init -t
```

**Pattern:**
- `salt init` shows all accounts with balances
- Use `--no-listen` if you don't want to start listener

### Manage Invitations

**User says:**
- "check my pending invites"
- "accept all invitations"
- "accept invite ID xyz"

**Agent translates to:**
```bash
salt invites list -t
salt invites accept-all -t
salt invites accept --id xyz -t
```

**Pattern:**
- `list` shows pending invites
- `accept-all` accepts everything
- `accept --id` accepts specific one

### Account Creation Participation

**User says:**
- "start listening for account creation"
- "participate in MPC account setup"
- "listen for nudges"

**Agent translates to:**
```bash
salt listen -t
```

**To stop:**
```bash
salt stop -t
```

**Pattern:**
- Listener runs in foreground, shows status updates
- Use `salt stop` to kill running listener

## Environment Detection

**Testnet indicators:**
- "testnet", "sepolia", "test", "-t"
- Default to testnet if uncertain for safety

**Mainnet indicators:**
- "mainnet", "production", "prod", "live", "-m"
- Requires explicit mention

**Default behavior:**
- Mainnet is CLI default
- But agents should prefer testnet unless explicitly told mainnet

## Account Selection

**User says:**
- "from account Y"
- "using account CoManagedAcc"
- "from my DeFi account"

**Agent must:**
1. Match account name or ID from `salt init` output
2. Use `--account <account-id>` flag

**If not specified:**
- CLI uses first account by default
- Agent can ask user which account, or list them with `salt init -t`

## Chain Selection

**User says:**
- "on Ethereum"
- "to Polygon"
- "chain 137"

**Agent adds:**
```bash
--chain <chainId>
```

**Common chains:**
- Ethereum: 1
- Polygon: 137
- Arbitrum One: 42161
- Arbitrum Sepolia: 421614
- Base: 8453

**If not specified:**
- Defaults to orchestration chain (421614 testnet, 42161 mainnet)

## Full Example Workflow

**User:** "Send 0.5 ETH to 0x447603546Ee18245d1640Aaa5150eB3A328256EF from my CoManagedAcc account on testnet"

**Agent process:**
1. Parse intent: native ETH transfer
2. Extract: amount=0.5, to=0x4476..., account=CoManagedAcc, env=testnet
3. Get account ID: Run `salt init -t` to find CoManagedAcc ID
4. Build command:
   ```bash
   salt submit --to 0x447603546Ee18245d1640Aaa5150eB3A328256EF --value 0.5 --account 698e2425c93351e4490a358f -t
   ```
5. Execute and report results

## Error Handling

**If command fails:**
- Read error message
- Check common issues:
  - Wrong environment (testnet vs mainnet)
  - Insufficient balance
  - Invalid address
  - Missing account ID
  - Robos offline
- Suggest fixes or retry

**If uncertain:**
- Run `salt init -t` to get current state
- Ask user for clarification
- Default to safer option (testnet, dry-run if available)

## Agent Best Practices

1. **Always verify before executing:**
   - Confirm transaction details
   - Show what command will be run
   - Especially for mainnet transactions

2. **Provide feedback:**
   - Show command being executed
   - Display transaction hash and explorer link
   - Confirm success or explain failure

3. **Be context-aware:**
   - Remember account IDs from previous commands
   - Track environment (testnet/mainnet) in conversation
   - Reuse recently used addresses when appropriate

4. **Handle ambiguity:**
   - If account not specified, list accounts and ask
   - If amount unclear, confirm before sending
   - If chain not mentioned, assume orchestration chain

5. **Learn from errors:**
   - If a pattern fails, try alternative interpretation
   - Update approach based on user corrections
   - Document new patterns encountered
