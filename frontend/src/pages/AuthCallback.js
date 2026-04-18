import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import useAuthStore from '../store/authStore';
import { toast } from 'sonner';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();
  const processed = useRef(false);

  useEffect(() => {
    // Prevent double-processing under React StrictMode
    if (processed.current) return;
    processed.current = true;

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error || !code) {
      toast.error('Google sign-in was cancelled or failed');
      navigate('/login', { replace: true });
      return;
    }

    const exchange = async () => {
      try {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUri = window.location.origin + '/auth/callback';
        const res = await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/auth/google/callback`,
          { code, redirect_uri: redirectUri }
        );
        const { access_token, user } = res.data.data;
        setToken(access_token);
        setUser(user);
        toast.success(`Welcome, ${user.name}!`);
        navigate('/', { replace: true });
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Google sign-in failed');
        navigate('/login', { replace: true });
      }
    };

    exchange();
  }, [navigate, searchParams, setToken, setUser]);

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4AA] mx-auto mb-4"></div>
        <p className="text-[#8B949E] font-body text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
