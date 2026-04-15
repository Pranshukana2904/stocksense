import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, FolderOpen, X, Check } from 'lucide-react';
import { categoriesApi } from '../api/api';
import { toast } from 'sonner';

const CategoryModal = ({ category, onClose, onSave }) => {
  const [form, setForm] = useState({ name: category?.name || '', description: category?.description || '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return toast.error('Category name is required');
    setLoading(true);
    try {
      if (category) { await categoriesApi.update(category.id, form); toast.success('Category updated'); }
      else { await categoriesApi.create(form); toast.success('Category created'); }
      onSave();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to save'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl w-full max-w-sm" data-testid="category-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#30363D]">
          <h2 className="font-display font-bold text-[#E6EDF3]">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Category Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Electronics" className="input-dark" data-testid="cat-name-input" autoFocus />
          </div>
          <div>
            <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-dark resize-none h-20" placeholder="Optional description..." />
          </div>
        </form>
        <div className="px-6 py-4 border-t border-[#30363D] flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary" data-testid="save-category-btn">
            {loading ? 'Saving...' : category ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Categories = () => {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then(r => r.data.data || []),
  });

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"? This will fail if products are linked.`)) return;
    try { await categoriesApi.delete(id); qc.invalidateQueries(['categories']); toast.success('Category deleted'); }
    catch (err) { toast.error(err.response?.data?.detail || 'Cannot delete this category'); }
  };

  const catColors = ['#00D4AA', '#818CF8', '#F59E0B', '#EF4444', '#06B6D4'];

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Categories</h1>
          <p className="text-[#8B949E] text-sm font-body mt-1">{categories.length} categories</p>
        </div>
        <button onClick={() => { setEditCat(null); setShowModal(true); }} className="btn-primary" data-testid="add-category-btn">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="card overflow-hidden" data-testid="categories-table">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0D1117] border-b border-[#30363D]">
              {['Category', 'Description', 'Products', 'Actions'].map(h => (
                <th key={h} className="text-left py-3 px-6 text-xs font-mono uppercase tracking-wider text-[#8B949E]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={4} className="py-3 px-6"><div className="h-4 animate-pulse bg-[#30363D]/50 rounded" /></td></tr>
              ))
            ) : categories.map((cat, idx) => (
              <tr key={cat.id} className="table-row-hover" data-testid={`category-row-${cat.id}`}>
                <td className="py-3.5 px-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${catColors[idx % catColors.length]}20`, border: `1px solid ${catColors[idx % catColors.length]}30` }}>
                      <FolderOpen size={14} style={{ color: catColors[idx % catColors.length] }} strokeWidth={1.5} />
                    </div>
                    <span className="text-[#E6EDF3] font-medium text-sm">{cat.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-6 text-[#8B949E] text-sm">{cat.description || '—'}</td>
                <td className="py-3.5 px-6 font-mono text-sm text-[#E6EDF3]">{cat.product_count}</td>
                <td className="py-3.5 px-6">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditCat(cat); setShowModal(true); }}
                      className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#818CF8] transition-colors" data-testid={`edit-cat-${cat.id}`}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#EF4444] transition-colors" data-testid={`delete-cat-${cat.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CategoryModal category={editCat} onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); qc.invalidateQueries(['categories']); }} />
      )}
    </div>
  );
};

export default Categories;
