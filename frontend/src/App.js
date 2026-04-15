import React, { useEffect } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import useAuthStore from './store/authStore';
import useAlertStore from './store/alertStore';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Alerts from './pages/Alerts';
import Predictions from './pages/Predictions';
import Sales from './pages/Sales';
import Suppliers from './pages/Suppliers';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import { alertsApi } from './api/api';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30000 } },
});

function AlertPoller() {
  const { accessToken } = useAuthStore();
  const { setUnreadAlertCount } = useAlertStore();

  useEffect(() => {
    if (!accessToken) return;
    const poll = async () => {
      try {
        const res = await alertsApi.list();
        const unread = (res.data.data || []).filter(a => !a.is_read).length;
        setUnreadAlertCount(unread);
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 60000);
    return () => clearInterval(id);
  }, [accessToken, setUnreadAlertCount]);

  return null;
}

function App() {
  const { accessToken } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="bottom-right" richColors theme="dark" />
        <AlertPoller />
        <Routes>
          <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/register" element={accessToken ? <Navigate to="/" replace /> : <Register />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
