#!/usr/bin/env node

const { program } = require('commander');
const { initCommand } = require('../lib/commands/init');
const { submitCommand } = require('../lib/commands/submit');
const { invitesCommand } = require('../lib/commands/invites');
const { listenCommand } = require('../lib/commands/listen');
const { stopCommand } = require('../lib/commands/stop');

program
  .name('salt')
  .description('CLI for Salt SDK - MPC-orchestrated blockchain transactions')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Salt: check invites, list accounts, start nudge listener')
  .option('-t, --testnet', 'Use testnet (Arbitrum Sepolia)')
  .option('-m, --mainnet', 'Use mainnet (Arbitrum One)')
  .option('--no-listen', 'Do not start nudge listener')
  .action(initCommand);

program
  .command('submit')
  .description('Submit transaction (native send, ERC20, contract call, or deployment)')
  .option('-t, --testnet', 'Use testnet (Arbitrum Sepolia)')
  .option('-m, --mainnet', 'Use mainnet (Arbitrum One)')
  .option('--to <address>', 'Recipient address (omit for contract deployment)')
  .option('--value <amount>', 'Native token amount (decimal string, e.g., "0.01")', '0')
  .option('--data <hex>', 'Transaction data (hex string)', '0x')
  .option('--account <id>', 'Account ID to use (default: first account)')
  .option('--chain <chainId>', 'Destination chain ID (default: same as environment)')
  .option('--deploy', 'Deploy contract (--to is ignored)')
  .action(submitCommand);

program
  .command('invites [action]')
  .description('Manage organization invitations (actions: list, accept, accept-all)')
  .option('-t, --testnet', 'Use testnet (Arbitrum Sepolia)')
  .option('-m, --mainnet', 'Use mainnet (Arbitrum One)')
  .option('--id <inviteId>', 'Invitation ID (for accept action)')
  .action(invitesCommand);

program
  .command('listen')
  .description('Start nudge listener for account creation participation')
  .option('-t, --testnet', 'Use testnet (Arbitrum Sepolia)')
  .option('-m, --mainnet', 'Use mainnet (Arbitrum One)')
  .action(listenCommand);

program
  .command('stop')
  .description('Stop running nudge listener')
  .option('-t, --testnet', 'Stop testnet listener')
  .option('-m, --mainnet', 'Stop mainnet listener')
  .action(stopCommand);

program.parse();
