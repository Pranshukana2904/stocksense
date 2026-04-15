import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Package, X, ChevronDown, RefreshCw } from 'lucide-react';
import { productsApi, categoriesApi, suppliersApi } from '../api/api';
import { formatCurrency, getStockStatusColor } from '../utils/formatters';
import { toast } from 'sonner';

const UNITS = ['pcs', 'kg', 'litre', 'box', 'pack', 'ream', 'dozen'];
const REASONS = ['Received Shipment', 'Damage', 'Audit Correction', 'Return', 'Other'];

const ProductModal = ({ product, categories, suppliers, onClose, onSave }) => {
  const [tab, setTab] = useState('basic');
  const [form, setForm] = useState({
    name: product?.name || '', sku: product?.sku || '', description: product?.description || '',
    image_url: product?.image_url || '', unit: product?.unit || 'pcs',
    cost_price: product?.cost_price || '', selling_price: product?.selling_price || '',
    current_stock: product?.current_stock ?? '', reorder_level: product?.reorder_level || 10,
    category_id: product?.category_id || '', supplier_id: product?.supplier_id || '',
  });
  const [autoSku, setAutoSku] = useState(!product);
  const [loading, setLoading] = useState(false);

  const margin = form.cost_price && form.selling_price
    ? (((form.selling_price - form.cost_price) / form.selling_price) * 100).toFixed(1)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category_id || !form.supplier_id) return toast.error('Fill in all required fields');
    setLoading(true);
    try {
      const payload = { ...form, cost_price: +form.cost_price, selling_price: +form.selling_price, current_stock: +form.current_stock, reorder_level: +form.reorder_level };
      if (autoSku) delete payload.sku;
      if (product) { await productsApi.update(product.id, payload); toast.success('Product updated'); }
      else { await productsApi.create(payload); toast.success('Product created'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save product'); }
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
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="product-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h2 className="font-display font-bold text-[#E6EDF3] text-lg">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <div className="flex border-b border-[#30363D]">
          {['basic', 'pricing'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-[#00D4AA] border-b-2 border-[#00D4AA]' : 'text-[#8B949E] hover:text-[#E6EDF3]'}`}>
              {t === 'basic' ? 'Basic Info' : 'Pricing & Stock'}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {tab === 'basic' ? (
            <div className="space-y-4">
              {inp('Product Name *', 'name', 'text', 'Samsung Smart TV 43"')}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[#8B949E] text-xs font-medium">SKU</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={autoSku} onChange={e => setAutoSku(e.target.checked)} className="w-3 h-3" />
                    <span className="text-[#8B949E] text-xs">Auto-generate</span>
                  </label>
                </div>
                <input disabled={autoSku} value={autoSku ? '(auto)' : form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  className={`input-dark ${autoSku ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="SKU-ELEC-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Category *</label>
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="input-dark" data-testid="category-select">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Supplier *</label>
                  <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="input-dark" data-testid="supplier-select">
                    <option value="">Select supplier</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="input-dark">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input-dark resize-none h-20" placeholder="Product description..." />
              </div>
              {inp('Image URL', 'image_url', 'url', 'https://example.com/image.jpg')}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {inp('Cost Price (₹) *', 'cost_price', 'number', '500')}
                {inp('Selling Price (₹) *', 'selling_price', 'number', '799')}
              </div>
              {margin && (
                <div className={`p-3 rounded-lg ${+margin > 0 ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/20' : 'bg-[#EF4444]/10 border border-[#EF4444]/20'}`}>
                  <p className="text-sm font-mono">Profit margin: <span className={+margin > 0 ? 'text-[#00D4AA]' : 'text-[#EF4444]'}>{margin}%</span></p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {inp('Current Stock *', 'current_stock', 'number', '100')}
                <div>
                  {inp('Reorder Level', 'reorder_level', 'number', '20')}
                  <p className="text-[#8B949E] text-xs mt-1">Alert triggers when stock ≤ this level</p>
                </div>
              </div>
            </div>
          )}
        </form>
        <div className="px-6 py-4 border-t border-[#30363D] flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary" data-testid="save-product-btn">
            {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StockModal = ({ product, onClose, onSave }) => {
  const [form, setForm] = useState({ quantity: product?.current_stock || 0, reason: 'Received Shipment', note: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    setLoading(true);
    try {
      await productsApi.updateStock(product.id, form);
      toast.success('Stock updated');
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-md" data-testid="stock-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h2 className="font-display font-bold text-[#E6EDF3]">Adjust Stock</h2>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-3 bg-[#0D1117] rounded-lg border border-[#30363D]">
            <p className="text-[#8B949E] text-xs font-mono">Product: <span className="text-[#E6EDF3]">{product.name}</span></p>
            <p className="text-[#8B949E] text-xs font-mono mt-1">Current Stock: <span className="text-[#00D4AA] font-bold">{product.current_stock}</span></p>
          </div>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">New Quantity</label>
            <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })}
              className="input-dark" min="0" data-testid="stock-quantity" />
          </div>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Reason</label>
            <select value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-dark" data-testid="stock-reason">
              {REASONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Note (optional)</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              className="input-dark resize-none h-16" placeholder="Additional notes..." />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-[#30363D] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-teal" data-testid="save-stock-btn">
            {loading ? 'Updating...' : 'Update Stock'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Inventory = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);

  const { data: resp, isLoading } = useQuery({
    queryKey: ['products', page, search, catFilter, statusFilter],
    queryFn: () => productsApi.list({ page, limit: 20, search: search || undefined, category_id: catFilter || undefined, stock_status: statusFilter || undefined }).then(r => r.data),
  });
  const products = resp?.data || [];
  const pagination = resp?.pagination;

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list().then(r => r.data.data || []) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => suppliersApi.list().then(r => r.data.data || []) });

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await productsApi.delete(id); qc.invalidateQueries(['products']); toast.success('Product deleted'); }
    catch (err) { toast.error(err.response?.data?.detail || 'Delete failed'); }
  };

  const refresh = () => { qc.invalidateQueries(['products']); qc.invalidateQueries(['sales-summary']); };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Inventory</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">Manage your product catalog</p>
        </div>
        <button onClick={() => { setEditProduct(null); setShowModal(true); }} className="btn-primary" data-testid="add-product-btn">
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3" data-testid="product-filters">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B949E]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or SKU..." className="input-dark pl-9" data-testid="search-input" />
        </div>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1); }} className="input-dark w-auto" data-testid="category-filter">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-dark w-auto" data-testid="status-filter">
          <option value="">All Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        <button onClick={refresh} className="btn-secondary px-3"><RefreshCw size={14} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="products-table">
            <thead>
              <tr className="bg-[#0D1117] border-b border-[#30363D]">
                {['Product', 'SKU', 'Category', 'Supplier', 'Stock', 'Reorder', 'Price', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-mono uppercase tracking-wider text-[#8B949E]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="py-3 px-4"><div className="h-4 animate-pulse bg-[#30363D]/50 rounded" /></td></tr>
                ))
              ) : products.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-[#8B949E]">
                  <Package size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No products found</p>
                </td></tr>
              ) : products.map(p => {
                const sc = getStockStatusColor(p.stock_status);
                return (
                  <tr key={p.id} className="table-row-hover" data-testid={`product-row-${p.id}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {p.image_url ? <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover bg-[#30363D]" /> :
                          <div className="w-8 h-8 rounded bg-[#30363D] flex items-center justify-center"><Package size={14} className="text-[#8B949E]" /></div>}
                        <p className="text-[#E6EDF3] text-sm font-medium">{p.name}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#8B949E]">{p.sku}</td>
                    <td className="py-3 px-4 text-xs text-[#8B949E]">{p.category_name}</td>
                    <td className="py-3 px-4 text-xs text-[#8B949E]">{p.supplier_name}</td>
                    <td className="py-3 px-4 font-mono text-sm text-[#E6EDF3] font-bold">{p.current_stock}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#8B949E]">{p.reorder_level}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#E6EDF3]">{formatCurrency(p.selling_price)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>{sc.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditProduct(p); setShowModal(true); }}
                          className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#818CF8] transition-colors" title="Edit" data-testid={`edit-${p.id}`}>
                          <Edit size={14} />
                        </button>
                        <button onClick={() => setStockProduct(p)}
                          className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#00D4AA] transition-colors" title="Adjust Stock" data-testid={`stock-${p.id}`}>
                          <RefreshCw size={14} />
                        </button>
                        <button onClick={() => handleDelete(p.id, p.name)}
                          className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#EF4444] transition-colors" title="Delete" data-testid={`delete-${p.id}`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#30363D]">
            <p className="text-[#8B949E] text-xs font-mono">Showing {(pagination.page-1)*pagination.limit+1}–{Math.min(pagination.page*pagination.limit, pagination.total)} of {pagination.total}</p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p+1)} className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal product={editProduct} categories={categories} suppliers={suppliers}
          onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); refresh(); }} />
      )}
      {stockProduct && (
        <StockModal product={stockProduct} onClose={() => setStockProduct(null)} onSave={() => { setStockProduct(null); refresh(); }} />
      )}
    </div>
  );
};

export default Inventory;
