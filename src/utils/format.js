export function formatCurrency(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(value);
}

export function formatQuantity(value, decimals = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(iso) {
  if (!iso) return '--';
  const date = new Date(iso);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncateAddress(address, chars = 4) {
  if (!address) return '';
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
