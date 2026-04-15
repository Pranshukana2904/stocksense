import { create } from 'zustand';

const useAuthStore = create((set) => ({
  accessToken: localStorage.getItem('ss_token') || null,
  user: (() => { try { return JSON.parse(localStorage.getItem('ss_user') || 'null'); } catch { return null; } })(),

  setToken: (token) => {
    localStorage.setItem('ss_token', token);
    set({ accessToken: token });
  },

  setUser: (user) => {
    localStorage.setItem('ss_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('ss_token');
    localStorage.removeItem('ss_user');
    set({ accessToken: null, user: null });
  },
}));

export default useAuthStore;
