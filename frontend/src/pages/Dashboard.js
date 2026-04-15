import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar
} from 'recharts';
import { Package, AlertTriangle, TrendingUp, ShoppingCart, RefreshCw, ArrowRight, Zap, ChevronUp } from 'lucide-react';
import { salesApi, alertsApi, predictionsApi, productsApi } from '../api/api';
import { formatCurrency, formatDateShort, getDaysUntilStockoutColor, timeAgo } from '../utils/formatters';
import { toast } from 'sonner';

const KPICard = ({ icon: Icon, label, value, subtext, color, testid }) => (
  <div className={`card p-6 animate-fade-in hover:border-[#8B949E]/50 transition-all duration-200`} data-testid={testid}>
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
    </div>
    <p className="font-mono font-bold text-2xl text-[#E6EDF3] mb-1">{value}</p>
    <p className="text-[#8B949E] text-xs font-mono uppercase tracking-widest">{label}</p>
    {subtext && <p className="text-[#8B949E] text-xs font-body mt-1">{subtext}</p>}
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 shadow-xl">
      <p className="font-mono text-xs text-[#8B949E] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-sm" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const [timeRange, setTimeRange] = useState(30);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ['sales-summary'],
    queryFn: () => salesApi.summary().then(r => r.data.data),
  });

  const { data: alertsList = [] } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => alertsApi.list().then(r => r.data.data || []),
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => predictionsApi.list().then(r => r.data.data || []),
  });

  const { data: salesData } = useQuery({
    queryKey: ['sales-chart', timeRange],
    queryFn: async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);
      const res = await salesApi.list({ start_date: startDate.toISOString().slice(0, 10), limit: 5000 });
      return res.data.data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-dashboard'],
    queryFn: () => productsApi.list({ limit: 5 }).then(r => r.data.data || []),
  });

  // Build chart data
  const chartData = React.useMemo(() => {
    const byDate = {};
    (salesData || []).forEach(s => {
      byDate[s.sale_date] = (byDate[s.sale_date] || 0) + s.quantity_sold;
    });
    const today = new Date();
    const points = [];
    for (let i = timeRange; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      points.push({ date: formatDateShort(ds), historical: byDate[ds] || 0, predicted: null });
    }
    const avgPred = predictions.reduce((s, p) => s + (p.average_daily_demand || 0), 0);
    for (let i = 1; i <= Math.min(15, timeRange); i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      points.push({ date: formatDateShort(d.toISOString().slice(0, 10)), historical: null, predicted: Math.round(avgPred) });
    }
    return points;
  }, [salesData, predictions, timeRange]);

  // Revenue trend for BarChart
  const revenueData = React.useMemo(() => {
    const byDate = {};
    (salesData || []).forEach(s => {
      byDate[s.sale_date] = (byDate[s.sale_date] || 0) + (s.total_amount || 0);
    });
    return Object.entries(byDate).slice(-14).map(([date, revenue]) => ({
      date: formatDateShort(date), revenue: Math.round(revenue)
    }));
  }, [salesData]);

  const predictedMonthlyRevenue = predictions.reduce((sum, p) => {
    return sum + ((p.total_predicted_demand || p.predicted_demand || 0)) * (p.selling_price || 0);
  }, 0);

  const lowStockAlerts = alertsList.filter(a => a.type === 'LOW_STOCK').slice(0, 5);

  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await predictionsApi.insights();
      setInsights(res.data.data || []);
      toast.success('Insights refreshed');
    } catch {
      toast.error('Failed to fetch AI insights');
    } finally {
      setInsightsLoading(false);
    }
  };

  useEffect(() => {
    predictionsApi.insights().then(r => setInsights(r.data.data || [])).catch(() => {});
  }, []);

  const severityStyle = (severity) => {
    if (severity === 'critical') return 'border-l-4 border-[#EF4444] bg-[#EF4444]/5';
    if (severity === 'warning') return 'border-l-4 border-[#F59E0B] bg-[#F59E0B]/5';
    return 'border-l-4 border-[#818CF8] bg-[#818CF8]/5';
  };

  const severityDot = (severity) => {
    if (severity === 'critical') return 'bg-[#EF4444]';
    if (severity === 'warning') return 'bg-[#F59E0B]';
    return 'bg-[#818CF8]';
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Dashboard</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">Real-time inventory overview</p>
        </div>
        <div className="font-mono text-xs text-[#8B949E]">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-cards">
        <KPICard icon={Package} label="Total Products" value={summary?.total_products ?? '—'}
          subtext="Across all categories" color="bg-[#818CF8]/10 text-[#818CF8]" testid="kpi-total-products" />
        <KPICard icon={AlertTriangle} label="Low Stock" value={summary?.low_stock_count ?? '—'}
          subtext="Below reorder level" color="bg-[#F59E0B]/10 text-[#F59E0B]" testid="kpi-low-stock" />
        <KPICard icon={Package} label="Out of Stock" value={summary?.out_of_stock_count ?? '—'}
          subtext="Needs immediate action" color="bg-[#EF4444]/10 text-[#EF4444]" testid="kpi-out-of-stock" />
        <KPICard icon={TrendingUp} label="Predicted Revenue" value={formatCurrency(predictedMonthlyRevenue)}
          subtext="Next 30 days forecast" color="bg-[#00D4AA]/10 text-[#00D4AA]" testid="kpi-predicted-revenue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Forecast Chart */}
        <div className="lg:col-span-2 card p-6" data-testid="sales-forecast-chart">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-[#E6EDF3] text-base">Sales Forecast</h3>
              <p className="text-[#8B949E] text-xs font-body">Historical + predicted demand</p>
            </div>
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <button key={d} onClick={() => setTimeRange(d)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${timeRange === d ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30' : 'text-[#8B949E] hover:text-[#E6EDF3]'}`}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fill: '#8B949E', fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#8B949E' }} />
              <Area type="monotone" dataKey="historical" name="Historical" stroke="#00D4AA" fill="url(#tealGrad)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="predicted" name="Predicted" stroke="#818CF8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock Panel */}
        <div className="card p-6" data-testid="low-stock-panel">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-[#E6EDF3] text-base">Low Stock</h3>
            <Link to="/alerts" className="text-[#00D4AA] text-xs font-mono flex items-center gap-1 hover:text-[#00D4AA]/80">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {lowStockAlerts.length === 0 ? (
              <p className="text-[#8B949E] text-sm text-center py-4">All stock levels healthy!</p>
            ) : lowStockAlerts.map(alert => {
              const pct = alert.reorder_level > 0 ? Math.min(100, (alert.current_stock / alert.reorder_level) * 100) : 0;
              const color = alert.type === 'OUT_OF_STOCK' ? '#EF4444' : '#F59E0B';
              return (
                <div key={alert.id} className="space-y-1" data-testid={`low-stock-${alert.product_id}`}>
                  <div className="flex justify-between items-center">
                    <p className="text-[#E6EDF3] text-sm font-medium truncate max-w-[160px]">{alert.product_name}</p>
                    <span className="font-mono text-xs" style={{ color }}>{alert.current_stock} left</span>
                  </div>
                  <div className="h-1.5 bg-[#30363D] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Revenue Trend + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="card p-6" data-testid="revenue-trend">
          <h3 className="font-display font-bold text-[#E6EDF3] text-base mb-4">Revenue Trend (14d)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={revenueData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#8B949E', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} formatter={v => formatCurrency(v)} />
              <Bar dataKey="revenue" name="Revenue" fill="#00D4AA" opacity={0.8} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="lg:col-span-2 card p-6 overflow-hidden" data-testid="top-products-table">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-[#E6EDF3] text-base">Recent Products</h3>
            <Link to="/inventory" className="text-[#00D4AA] text-xs font-mono flex items-center gap-1 hover:text-[#00D4AA]/80">
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#30363D]">
                  {['Product', 'Category', 'Stock', 'Status'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-mono uppercase tracking-wider text-[#8B949E]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map(p => (
                  <tr key={p.id} className="table-row-hover">
                    <td className="py-2.5 px-3 text-[#E6EDF3] text-sm font-medium">{p.name}</td>
                    <td className="py-2.5 px-3 text-[#8B949E] text-xs font-mono">{p.category_name}</td>
                    <td className="py-2.5 px-3 font-mono text-sm text-[#E6EDF3]">{p.current_stock}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                        p.stock_status === 'in_stock' ? 'badge-healthy' :
                        p.stock_status === 'low_stock' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {p.stock_status === 'in_stock' ? 'In Stock' : p.stock_status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card p-6" data-testid="ai-insights-panel">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#818CF8]" />
            <h3 className="font-display font-bold text-[#E6EDF3] text-base">AI Insights</h3>
            <span className="badge-indigo">GPT-4o</span>
          </div>
          <button onClick={fetchInsights} disabled={insightsLoading} className="btn-ai text-xs py-1 px-3"
            data-testid="refresh-insights-btn">
            <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
            {insightsLoading ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.slice(0, 6).map((ins, i) => (
            <div key={i} className={`p-4 rounded-lg ${severityStyle(ins.severity)}`} data-testid={`insight-${i}`}>
              <div className="flex items-start gap-2 mb-2">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${severityDot(ins.severity)}`} />
                <p className="font-body font-semibold text-[#E6EDF3] text-sm">{ins.title}</p>
              </div>
              <p className="text-[#8B949E] text-xs font-body leading-relaxed">{ins.description}</p>
              {ins.affectedProduct && (
                <p className="text-[#818CF8] text-xs font-mono mt-2">{ins.affectedProduct}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
