export const formatCurrency = (amount, currency = '₹') => {
  if (amount === null || amount === undefined) return `${currency}0`;
  return `${currency}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
};

export const getStockStatusColor = (status) => {
  switch (status) {
    case 'out_of_stock': return { text: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/20', label: 'Out of Stock' };
    case 'low_stock': return { text: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/20', label: 'Low Stock' };
    default: return { text: 'text-[#00D4AA]', bg: 'bg-[#00D4AA]/10', border: 'border-[#00D4AA]/20', label: 'In Stock' };
  }
};

export const getDaysUntilStockoutColor = (days) => {
  if (days <= 7) return 'text-[#EF4444]';
  if (days <= 30) return 'text-[#F59E0B]';
  return 'text-[#00D4AA]';
};

export const getConfidenceLabel = (score) => {
  if (score >= 0.7) return 'High';
  if (score >= 0.4) return 'Medium';
  return 'Low';
};

export const truncate = (str, len = 30) => {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
};
