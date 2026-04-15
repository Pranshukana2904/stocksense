import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Plus, Search, Download } from 'lucide-react';
import { salesApi, productsApi } from '../api/api';
import { formatCurrency, formatDate, formatDateShort } from '../utils/formatters';
import { toast } from 'sonner';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 shadow-xl">
      <p className="font-mono text-xs text-[#8B949E] mb-1">{label}</p>
      <p className="font-mono text-sm text-[#00D4AA]">Revenue: {formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

const Sales = () => {
  const qc = useQueryClient();
  const [form, setForm] = useState({ product_id: '', quantity_sold: 1, sale_date: new Date().toISOString().slice(0, 10) });
  const [productSearch, setProductSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const { data: summary } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: () => salesApi.summary().then(r => r.data.data),
  });

  const { data: salesResp } = useQuery({
    queryKey: ['sales-list', page, dateFrom, dateTo],
    queryFn: () => salesApi.list({ page, limit: 20, start_date: dateFrom || undefined, end_date: dateTo || undefined }).then(r => r.data),
  });
  const sales = salesResp?.data || [];
  const pagination = salesResp?.pagination;

  const { data: products = [] } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => productsApi.list({ limit: 200 }).then(r => r.data.data || []),
  });

  const filteredProds = products.filter(p =>
    productSearch === '' || p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.sku.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const selectedProduct = products.find(p => p.id === form.product_id);
  const totalAmount = selectedProduct ? selectedProduct.selling_price * form.quantity_sold : 0;

  const handleRecord = async (e) => {
    e.preventDefault();
    if (!form.product_id) return toast.error('Select a product');
    if (form.quantity_sold < 1) return toast.error('Quantity must be at least 1');
    setSubmitting(true);
    try {
      await salesApi.record(form);
      toast.success('Sale recorded successfully');
      setForm({ product_id: '', quantity_sold: 1, sale_date: new Date().toISOString().slice(0, 10) });
      setProductSearch('');
      qc.invalidateQueries(['sales-list']);
      qc.invalidateQueries(['sales-summary']);
      qc.invalidateQueries(['products']);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record sale');
    } finally { setSubmitting(false); }
  };

  // Revenue trend
  const revenueByDay = {};
  sales.forEach(s => { revenueByDay[s.sale_date] = (revenueByDay[s.sale_date] || 0) + (s.total_amount || 0); });
  const revenueChartData = Object.entries(revenueByDay).slice(-14).map(([date, rev]) => ({
    date: formatDateShort(date), revenue: Math.round(rev)
  }));

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Sales</h1>
        <p className="text-[#8B949E] text-sm font-body mt-1">Record and track sales transactions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="sales-summary-cards">
        {[
          { label: "Today's Revenue", value: formatCurrency(summary?.today_revenue), sub: `${summary?.today_units || 0} units`, color: 'text-[#00D4AA]' },
          { label: 'This Week', value: formatCurrency(summary?.week_revenue), sub: `${summary?.week_units || 0} units`, color: 'text-[#818CF8]' },
          { label: 'This Month', value: formatCurrency(summary?.month_revenue), sub: `${summary?.month_units || 0} units`, color: 'text-[#F59E0B]' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="card p-5">
            <p className="text-[#8B949E] text-xs font-mono uppercase tracking-wider mb-2">{label}</p>
            <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
            <p className="text-[#8B949E] text-xs font-mono mt-1">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record Sale Form */}
        <div className="card p-6" data-testid="record-sale-form">
          <h3 className="font-display font-bold text-[#E6EDF3] mb-4">Record Sale</h3>
          <form onSubmit={handleRecord} className="space-y-4">
            <div className="relative">
              <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Product</label>
              <input
                value={selectedProduct ? selectedProduct.name : productSearch}
                onChange={e => { setProductSearch(e.target.value); setForm({ ...form, product_id: '' }); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search product..." className="input-dark" data-testid="sale-product-search"
              />
              {showDropdown && filteredProds.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden shadow-xl">
                  {filteredProds.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setForm({ ...form, product_id: p.id }); setProductSearch(p.name); setShowDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#30363D] transition-colors" data-testid={`sale-product-${p.id}`}>
                      <p className="text-[#E6EDF3] text-sm font-medium">{p.name}</p>
                      <p className="text-[#8B949E] text-xs font-mono">Stock: {p.current_stock} | {formatCurrency(p.selling_price)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Quantity</label>
              <input type="number" min="1" value={form.quantity_sold}
                onChange={e => setForm({ ...form, quantity_sold: +e.target.value })}
                className="input-dark" data-testid="sale-quantity" />
            </div>
            <div>
              <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Sale Date</label>
              <input type="date" value={form.sale_date} onChange={e => setForm({ ...form, sale_date: e.target.value })}
                className="input-dark" data-testid="sale-date" />
            </div>
            {selectedProduct && (
              <div className="bg-[#0D1117] rounded-lg p-3 border border-[#30363D]">
                <p className="text-[#8B949E] text-xs font-mono">Total Amount</p>
                <p className="font-mono font-bold text-[#00D4AA] text-xl">{formatCurrency(totalAmount)}</p>
                <p className="text-[#8B949E] text-xs font-mono mt-1">Available stock: {selectedProduct.current_stock}</p>
              </div>
            )}
            <button type="submit" disabled={submitting || !form.product_id} className="w-full btn-primary py-2.5" data-testid="record-sale-btn">
              {submitting ? 'Recording...' : <><Plus size={16} /> Record Sale</>}
            </button>
          </form>
        </div>

        {/* Revenue Chart */}
        <div className="lg:col-span-2 card p-6">
          <h3 className="font-display font-bold text-[#E6EDF3] mb-4">Revenue Trend (14 days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueChartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#8B949E', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" fill="#00D4AA" opacity={0.8} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sales Table */}
      <div className="card overflow-hidden" data-testid="sales-table">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h3 className="font-display font-bold text-[#E6EDF3]">Transaction History</h3>
          <div className="flex gap-3 items-center">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="input-dark w-auto text-xs py-1" placeholder="From" />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="input-dark w-auto text-xs py-1" placeholder="To" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#0D1117] border-b border-[#30363D]">
                {['Product', 'Category', 'Qty Sold', 'Sale Date', 'Total Amount'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-[#8B949E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-[#8B949E] text-sm">No sales records found</td></tr>
              ) : sales.map(s => (
                <tr key={s.id} className="table-row-hover">
                  <td className="py-3 px-4 text-[#E6EDF3] text-sm font-medium">{s.product_name}</td>
                  <td className="py-3 px-4 text-[#8B949E] text-xs">{s.category_name}</td>
                  <td className="py-3 px-4 font-mono text-sm text-[#E6EDF3] font-bold">{s.quantity_sold}</td>
                  <td className="py-3 px-4 font-mono text-xs text-[#8B949E]">{formatDate(s.sale_date)}</td>
                  <td className="py-3 px-4 font-mono text-sm text-[#00D4AA] font-bold">{formatCurrency(s.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#30363D]">
            <p className="text-[#8B949E] text-xs font-mono">{pagination.total} transactions</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p+1)} className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sales;
