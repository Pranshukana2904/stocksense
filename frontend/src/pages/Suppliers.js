import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Truck, X, Mail, Phone, MapPin } from 'lucide-react';
import { suppliersApi } from '../api/api';
import { toast } from 'sonner';

const SupplierModal = ({ supplier, onClose, onSave }) => {
  const [form, setForm] = useState({
    name: supplier?.name || '', email: supplier?.email || '',
    phone: supplier?.phone || '', address: supplier?.address || '',
  });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) return toast.error('Name and email are required');
    setLoading(true);
    try {
      if (supplier) { await suppliersApi.update(supplier.id, form); toast.success('Supplier updated'); }
      else { await suppliersApi.create(form); toast.success('Supplier created'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    finally { setLoading(false); }
  };
  const inp = (label, key, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-[#8B949E] text-xs font-medium mb-1.5">{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder} className="input-dark" />
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-md" data-testid="supplier-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h2 className="font-display font-bold text-[#E6EDF3]">{supplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {inp('Company Name *', 'name', 'text', 'Sharma Electronics Pvt Ltd')}
          {inp('Email *', 'email', 'email', 'orders@company.in')}
          {inp('Phone', 'phone', 'tel', '+91-11-4567-8901')}
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Address</label>
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="input-dark resize-none h-20" placeholder="Full business address" />
          </div>
        </form>
        <div className="px-6 py-4 border-t border-[#30363D] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" data-testid="save-supplier-btn">
            {loading ? 'Saving...' : supplier ? 'Update' : 'Create Supplier'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Suppliers = () => {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then(r => r.data.data || []),
  });

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name}"?`)) return;
    try { await suppliersApi.delete(id); qc.invalidateQueries(['suppliers']); toast.success('Supplier deleted'); }
    catch (err) { toast.error(err.response?.data?.detail || 'Cannot delete supplier'); }
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Suppliers</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { setEditSupplier(null); setShowModal(true); }} className="btn-primary" data-testid="add-supplier-btn">
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card h-48 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="suppliers-grid">
          {suppliers.map(s => (
            <div key={s.id} className="card p-6 hover:border-[#8B949E]/50 transition-all duration-200" data-testid={`supplier-${s.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[#818CF8]/10 border border-[#818CF8]/20 flex items-center justify-center">
                  <Truck size={18} className="text-[#818CF8]" strokeWidth={1.5} />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditSupplier(s); setShowModal(true); }}
                    className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#818CF8] transition-colors" data-testid={`edit-sup-${s.id}`}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(s.id, s.name)}
                    className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#EF4444] transition-colors" data-testid={`delete-sup-${s.id}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-display font-bold text-[#E6EDF3] text-base mb-3">{s.name}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#8B949E]">
                  <Mail size={12} className="flex-shrink-0" />
                  <span className="truncate font-mono text-xs">{s.email}</span>
                </div>
                {s.phone && (
                  <div className="flex items-center gap-2 text-[#8B949E]">
                    <Phone size={12} className="flex-shrink-0" />
                    <span className="font-mono text-xs">{s.phone}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-start gap-2 text-[#8B949E]">
                    <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                    <span className="text-xs">{s.address}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-[#30363D]">
                <span className="font-mono text-xs text-[#00D4AA]">{s.product_count || 0} products linked</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <SupplierModal supplier={editSupplier} onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); qc.invalidateQueries(['suppliers']); }} />
      )}
    </div>
  );
};

export default Suppliers;
