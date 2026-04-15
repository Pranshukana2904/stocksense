import { create } from 'zustand';

const useAlertStore = create((set) => ({
  unreadAlertCount: 0,
  setUnreadAlertCount: (count) => set({ unreadAlertCount: count }),
}));

export default useAlertStore;
