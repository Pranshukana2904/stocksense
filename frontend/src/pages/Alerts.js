import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle, X, RefreshCw, AlertTriangle, Package } from 'lucide-react';
import { alertsApi, productsApi } from '../api/api';
import { timeAgo } from '../utils/formatters';
import { toast } from 'sonner';

const StockModal = ({ product, onClose, onSave }) => {
  const [qty, setQty] = useState(product?.reorder_level * 2 || 20);
  const [reason, setReason] = useState('Received Shipment');
  const [loading, setLoading] = useState(false);
  const handleSave = async () => {
    setLoading(true);
    try {
      await productsApi.updateStock(product.id, { quantity: qty, reason });
      toast.success('Stock updated');
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h3 className="font-display font-bold text-[#E6EDF3]">Restock: {product.product_name}</h3>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-[#8B949E] text-xs font-mono">Current: <span className="text-[#EF4444]">{product.current_stock}</span> | Reorder level: {product.reorder_level}</p>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">New Stock Quantity</label>
            <input type="number" value={qty} onChange={e => setQty(+e.target.value)} className="input-dark" />
          </div>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)} className="input-dark">
              {['Received Shipment', 'Return', 'Audit Correction', 'Other'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#30363D] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="btn-teal" data-testid="restock-confirm-btn">{loading ? 'Updating...' : 'Update Stock'}</button>
        </div>
      </div>
    </div>
  );
};

const Alerts = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('ALL');
  const [showResolved, setShowResolved] = useState(false);
  const [restockAlert, setRestockAlert] = useState(null);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', filter],
    queryFn: () => alertsApi.list(filter === 'ALL' ? undefined : filter).then(r => r.data.data || []),
    refetchInterval: 30000,
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ['all-alerts'],
    queryFn: () => alertsApi.list().then(r => r.data.data || []),
  });

  const lowCount = allAlerts.filter(a => a.type === 'LOW_STOCK').length;
  const outCount = allAlerts.filter(a => a.type === 'OUT_OF_STOCK').length;

  const handleRead = async (id) => {
    await alertsApi.markRead(id);
    qc.invalidateQueries(['alerts']);
    qc.invalidateQueries(['all-alerts']);
  };

  const handleResolve = async (id) => {
    await alertsApi.resolve(id);
    qc.invalidateQueries(['alerts']);
    qc.invalidateQueries(['all-alerts']);
    toast.success('Alert resolved');
  };

  const unresolved = alerts.filter(a => !a.is_resolved);
  const resolved = alerts.filter(a => a.is_resolved);

  const AlertCard = ({ alert }) => {
    const isOut = alert.type === 'OUT_OF_STOCK';
    const pct = alert.reorder_level > 0 ? Math.min(100, (alert.current_stock / alert.reorder_level) * 100) : 0;
    return (
      <div className={`card p-4 border-l-4 ${isOut ? 'border-l-[#EF4444]' : 'border-l-[#F59E0B]'} ${alert.is_read ? 'opacity-70' : ''}`}
        data-testid={`alert-card-${alert.id}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-[#EF4444]/10' : 'bg-[#F59E0B]/10'}`}>
              {isOut ? <AlertTriangle size={14} className="text-[#EF4444]" /> : <Bell size={14} className="text-[#F59E0B]" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[#E6EDF3] text-sm font-semibold">{alert.product_name}</p>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${isOut ? 'badge-danger' : 'badge-warning'}`}>
                  {isOut ? 'Out of Stock' : 'Low Stock'}
                </span>
                {!alert.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#818CF8]" />}
              </div>
              <p className="text-[#8B949E] text-xs font-mono mt-0.5">{alert.product_sku}</p>
              <p className="text-[#8B949E] text-xs font-body mt-1">{alert.message}</p>
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs font-mono text-[#8B949E]">
                  <span>Stock: {alert.current_stock} / Reorder: {alert.reorder_level}</span>
                  <span>{timeAgo(alert.created_at)}</span>
                </div>
                <div className="h-1.5 bg-[#30363D] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: isOut ? '#EF4444' : '#F59E0B' }} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {!alert.is_read && (
              <button onClick={() => handleRead(alert.id)} className="btn-secondary text-xs py-1 px-2.5" data-testid={`mark-read-${alert.id}`}>
                <CheckCircle size={12} /> Read
              </button>
            )}
            <button onClick={() => setRestockAlert(alert)} className="btn-teal text-xs py-1 px-2.5" data-testid={`reorder-${alert.id}`}>
              <Package size={12} /> Reorder
            </button>
            <button onClick={() => handleResolve(alert.id)} className="btn-secondary text-xs py-1 px-2.5" data-testid={`resolve-${alert.id}`}>
              Resolve
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Alerts</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">Stock alerts and notifications</p>
        </div>
        <button onClick={() => qc.invalidateQueries(['alerts'])} className="btn-secondary">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-3 gap-4" data-testid="alert-summary">
        {[
          { label: 'Total Alerts', value: allAlerts.length, color: 'text-[#818CF8]' },
          { label: 'Low Stock', value: lowCount, color: 'text-[#F59E0B]' },
          { label: 'Out of Stock', value: outCount, color: 'text-[#EF4444]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`font-mono font-bold text-2xl ${color}`}>{value}</p>
            <p className="text-[#8B949E] text-xs font-mono uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2" data-testid="alert-filters">
        {['ALL', 'LOW_STOCK', 'OUT_OF_STOCK'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-mono transition-all ${filter === f ? 'bg-[#00D4AA]/20 text-[#00D4AA] border border-[#00D4AA]/30' : 'btn-secondary'}`}
            data-testid={`filter-${f.toLowerCase()}`}>
            {f === 'ALL' ? 'All' : f === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-[#8B949E]">Loading alerts...</div>
        ) : unresolved.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle size={40} className="mx-auto text-[#00D4AA] mb-3 opacity-60" />
            <p className="text-[#E6EDF3] font-medium">All clear!</p>
            <p className="text-[#8B949E] text-sm">No unresolved alerts at this time.</p>
          </div>
        ) : unresolved.map(alert => <AlertCard key={alert.id} alert={alert} />)}
      </div>

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div>
          <button onClick={() => setShowResolved(!showResolved)}
            className="flex items-center gap-2 text-[#8B949E] text-sm hover:text-[#E6EDF3] transition-colors" data-testid="show-resolved-btn">
            <CheckCircle size={14} />
            {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved alert{resolved.length > 1 ? 's' : ''}
          </button>
          {showResolved && (
            <div className="mt-3 space-y-3 opacity-60">
              {resolved.map(alert => <AlertCard key={alert.id} alert={alert} />)}
            </div>
          )}
        </div>
      )}

      {restockAlert && (
        <StockModal product={restockAlert} onClose={() => setRestockAlert(null)}
          onSave={() => { setRestockAlert(null); qc.invalidateQueries(['alerts']); qc.invalidateQueries(['products']); }} />
      )}
    </div>
  );
};

export default Alerts;
