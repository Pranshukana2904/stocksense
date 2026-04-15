import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, RefreshCw, Zap, X } from 'lucide-react';
import { predictionsApi } from '../api/api';
import { formatCurrency, getDaysUntilStockoutColor, getConfidenceLabel } from '../utils/formatters';
import { toast } from 'sonner';

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-3 shadow-xl">
      <p className="font-mono text-xs text-[#8B949E] mb-1">{label}</p>
      <p className="font-mono text-sm text-[#818CF8]">Predicted: {payload[0]?.value} units</p>
    </div>
  );
};

const PredictionModal = ({ item, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    predictionsApi.product(item.product_id)
      .then(r => setDetail(r.data.data))
      .catch(() => toast.error('Failed to load prediction details'))
      .finally(() => setLoading(false));
  }, [item.product_id]);

  if (!detail && !loading) return null;

  const stockoutDay = detail ? detail.days_until_stockout : null;
  const chartData = (detail?.forecast_array || []).map((d, i) => ({
    date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    qty: d.predicted_qty,
    isStockout: stockoutDay && i >= stockoutDay,
  }));

  const restock = Math.max(0, (detail?.total_predicted_demand || 0) - (item.current_stock || 0));
  const estRevenue = (detail?.total_predicted_demand || 0) * (item.selling_price || 0);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="prediction-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <div>
            <h3 className="font-display font-bold text-[#E6EDF3]">{item.product_name}</h3>
            <p className="text-[#8B949E] text-xs font-mono">30-Day Demand Forecast</p>
          </div>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="h-48 animate-pulse bg-[#30363D]/30 rounded" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363D" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#8B949E', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis tick={{ fill: '#8B949E', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="qty" name="Predicted" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.isStockout ? '#EF4444' : '#818CF8'} opacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Predicted Demand', value: `${detail.total_predicted_demand} units` },
                  { label: 'Recommended Restock', value: `${restock} units` },
                  { label: 'Est. Revenue', value: formatCurrency(estRevenue) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0D1117] rounded-lg p-3 border border-[#30363D]">
                    <p className="text-[#8B949E] text-xs font-mono">{label}</p>
                    <p className="text-[#E6EDF3] font-mono font-bold text-lg mt-1">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#818CF8]" /><span className="text-[#8B949E]">Stock available</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-[#EF4444]" /><span className="text-[#8B949E]">Potential stockout</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Predictions = () => {
  const [selected, setSelected] = useState(null);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const { data: predictions = [], isLoading, refetch } = useQuery({
    queryKey: ['predictions'],
    queryFn: () => predictionsApi.list().then(r => r.data.data || []),
  });

  useEffect(() => {
    predictionsApi.insights().then(r => setInsights(r.data.data || [])).catch(() => {});
  }, []);

  const refreshInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await predictionsApi.insights();
      setInsights(res.data.data || []);
      toast.success('Insights refreshed');
    } catch { toast.error('Failed to refresh insights'); }
    finally { setInsightsLoading(false); }
  };

  const severityStyle = (s) => s === 'critical' ? 'border-l-[#EF4444] bg-[#EF4444]/5' : s === 'warning' ? 'border-l-[#F59E0B] bg-[#F59E0B]/5' : 'border-l-[#818CF8] bg-[#818CF8]/5';
  const severityText = (s) => s === 'critical' ? 'text-[#EF4444]' : s === 'warning' ? 'text-[#F59E0B]' : 'text-[#818CF8]';

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Predictions</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">AI-powered 30-day demand forecast</p>
        </div>
        <button onClick={() => refetch()} className="btn-secondary" data-testid="refresh-predictions-btn">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Prediction Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-6 h-52 animate-pulse"><div className="h-4 bg-[#30363D]/50 rounded mb-3" /><div className="h-3 bg-[#30363D]/30 rounded" /></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="prediction-cards">
          {predictions.map(item => {
            const dColor = getDaysUntilStockoutColor(item.days_until_stockout);
            return (
              <div key={item.product_id} className="card p-5 hover:border-[#8B949E]/50 transition-all duration-200" data-testid={`pred-${item.product_id}`}>
                <h4 className="font-display font-bold text-[#E6EDF3] text-sm mb-1 truncate">{item.product_name}</h4>
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#0D1117] rounded-lg p-2.5 border border-[#30363D]">
                      <p className="text-[#8B949E] text-xs font-mono">Current Stock</p>
                      <p className="font-mono font-bold text-[#E6EDF3] text-base">{item.current_stock}</p>
                    </div>
                    <div className="bg-[#0D1117] rounded-lg p-2.5 border border-[#30363D]">
                      <p className="text-[#8B949E] text-xs font-mono">Predicted (30d)</p>
                      <p className="font-mono font-bold text-[#818CF8] text-base">{item.predicted_demand}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[#8B949E] text-xs font-mono">Days until stockout</p>
                      <p className={`font-mono font-bold text-base ${dColor}`}>
                        {item.days_until_stockout >= 999 ? '∞' : item.days_until_stockout}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#8B949E] text-xs font-mono">Avg daily</p>
                      <p className="font-mono text-sm text-[#E6EDF3]">{item.average_daily_demand}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-mono text-[#8B949E] mb-1">
                      <span>Confidence</span>
                      <span>{getConfidenceLabel(item.confidence_score)} ({Math.round(item.confidence_score * 100)}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#30363D] rounded-full">
                      <div className="h-full bg-[#818CF8] rounded-full" style={{ width: `${item.confidence_score * 100}%` }} />
                    </div>
                  </div>
                  {item.restock_recommended && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded p-2 text-[#F59E0B] text-xs font-mono">Restock recommended</div>
                  )}
                </div>
                <button onClick={() => setSelected(item)} className="w-full mt-4 btn-ai text-xs py-1.5" data-testid={`view-details-${item.product_id}`}>
                  View 30-Day Forecast
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Insights */}
      <div className="card p-6" data-testid="predictions-ai-insights">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-[#818CF8]" />
            <h3 className="font-display font-bold text-[#E6EDF3]">AI Business Insights</h3>
          </div>
          <button onClick={refreshInsights} disabled={insightsLoading} className="btn-ai text-xs py-1 px-3" data-testid="refresh-ai-insights-btn">
            <RefreshCw size={12} className={insightsLoading ? 'animate-spin' : ''} />
            {insightsLoading ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>
        <div className="space-y-3">
          {insights.map((ins, i) => (
            <div key={i} className={`p-4 rounded-lg border-l-4 ${severityStyle(ins.severity)}`} data-testid={`prediction-insight-${i}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-body font-semibold text-[#E6EDF3] text-sm">{ins.title}</p>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded border ${severityText(ins.severity)} bg-transparent border-current/30`}>{ins.severity}</span>
                  </div>
                  <p className="text-[#8B949E] text-sm font-body leading-relaxed">{ins.description}</p>
                  {ins.affectedProduct && <p className={`text-xs font-mono mt-2 ${severityText(ins.severity)}`}>{ins.affectedProduct}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && <PredictionModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default Predictions;
