const { ethers } = require('ethers');

function formatBalance(balance, decimals = 18, precision = 6) {
  const formatted = ethers.utils.formatUnits(balance, decimals);
  const num = parseFloat(formatted);
  
  // For very small balances, show more precision
  if (num < 0.000001 && num > 0) {
    return num.toExponential(precision);
  }
  
  // For normal balances, trim unnecessary decimals
  return num.toFixed(precision).replace(/\.?0+$/, '');
}

function formatAddress(address, length = 10) {
  if (!address || address.length < length) return address;
  return `${address.slice(0, length)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

module.exports = {
  formatBalance,
  formatAddress,
  formatTimestamp
};
