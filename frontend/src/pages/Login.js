import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import { authApi } from '../api/api';
import useAuthStore from '../store/authStore';
import { toast } from 'sonner';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setToken, setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const res = await authApi.login(form);
      const { access_token, user } = res.data.data;
      setToken(access_token);
      setUser(user);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: window.location.origin + '/auth/callback',
  });

  return (
    <div className="min-h-screen bg-[#0D1117] flex">
      {/* Left – Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src="https://static.prod-images.emergentagent.com/jobs/ed841615-37b6-4660-8a51-12701ce9d1a9/images/0010bc0402e94fd45a8d1f99cef8a11f43b42bfc036e040858c16e8f647ce7f1.png"
          alt="StockSense background"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D1117]/60 via-[#0D1117]/40 to-[#00D4AA]/10" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00D4AA]/20 border border-[#00D4AA]/40 flex items-center justify-center">
              <Package size={20} className="text-[#00D4AA]" />
            </div>
            <span className="font-display font-bold text-[#E6EDF3] text-xl">StockSense</span>
          </div>
          <div>
            <h2 className="font-display font-black text-4xl text-[#E6EDF3] leading-tight mb-4">
              Manage inventory<br />with precision.
            </h2>
            <p className="text-[#8B949E] text-base font-body leading-relaxed max-w-sm">
              AI-powered alerts, real-time tracking, and predictive analytics to keep your business running smoothly.
            </p>
            <div className="flex gap-8 mt-8">
              {[['20+', 'Products tracked'], ['90 days', 'Sales history'], ['AI insights', 'Powered by GPT-4o']].map(([v, l]) => (
                <div key={l}>
                  <p className="font-mono font-bold text-[#00D4AA] text-lg">{v}</p>
                  <p className="text-[#8B949E] text-xs font-body">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right – Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <Package size={20} className="text-[#00D4AA]" />
              <span className="font-display font-bold text-[#E6EDF3]">StockSense</span>
            </div>
            <h1 className="font-display font-bold text-3xl text-[#E6EDF3] mb-2">Sign in</h1>
            <p className="text-[#8B949E] font-body text-sm">Enter your credentials to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@stocksense.com"
                className="input-dark"
                data-testid="login-email"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[#8B949E] text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="input-dark pr-10"
                  data-testid="login-password"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B949E] hover:text-[#E6EDF3] transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full btn-primary py-2.5 mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">Sign in <ArrowRight size={16} /></span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#30363D]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[#0D1117] text-[#8B949E] font-body">or continue with</span>
            </div>
          </div>

          {/* Google Sign-In */}
          <div data-testid="google-login-btn">
            <button
              type="button"
              onClick={() => googleLogin()}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-800 font-medium text-sm rounded-md border border-gray-300 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Sign in with Google
            </button>
          </div>

          <div className="mt-4 p-4 bg-[#161B22] rounded-lg border border-[#30363D]">
            <p className="text-[#8B949E] text-xs font-mono mb-2">Demo credentials:</p>
            <p className="text-[#00D4AA] text-xs font-mono">admin@stocksense.com / Admin@123</p>
          </div>

          <p className="text-center text-[#8B949E] text-sm mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#00D4AA] hover:text-[#00D4AA]/80 transition-colors">
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
