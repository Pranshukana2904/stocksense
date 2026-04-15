import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { authApi } from '../api/api';
import useAuthStore from '../store/authStore';
import { toast } from 'sonner';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('Please fill in all fields');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      const res = await authApi.register(form);
      const { access_token, user } = res.data.data;
      setToken(access_token);
      setUser(user);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/20 border border-[#00D4AA]/30 flex items-center justify-center">
            <Package size={16} className="text-[#00D4AA]" />
          </div>
          <span className="font-display font-bold text-[#E6EDF3]">StockSense</span>
        </div>

        <div className="mb-6">
          <h1 className="font-display font-bold text-3xl text-[#E6EDF3] mb-2">Create account</h1>
          <p className="text-[#8B949E] font-body text-sm">Join your team's StockSense workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
          <div>
            <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Full name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Rajesh Kumar" className="input-dark" data-testid="register-name" />
          </div>
          <div>
            <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Email address</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@company.com" className="input-dark" data-testid="register-email" />
          </div>
          <div>
            <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Password</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••" className="input-dark pr-10" data-testid="register-password" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3]">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input-dark" data-testid="register-role">
              <option value="STAFF">Staff</option>
              <option value="MANAGER">Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={loading} data-testid="register-submit" className="w-full btn-primary py-2.5 mt-2">
            {loading ? 'Creating account...' : <span className="flex items-center gap-2">Create account <ArrowRight size={16} /></span>}
          </button>
        </form>

        <p className="text-center text-[#8B949E] text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#00D4AA] hover:text-[#00D4AA]/80 transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
