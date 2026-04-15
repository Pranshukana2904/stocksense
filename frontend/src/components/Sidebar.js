import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Bell, TrendingUp, ShoppingCart,
  Truck, FolderOpen, Settings, LogOut, ChevronRight
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import useAlertStore from '../store/alertStore';
import { authApi } from '../api/api';
import { toast } from 'sonner';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/alerts', label: 'Alerts', icon: Bell, badge: true },
  { to: '/predictions', label: 'Predictions', icon: TrendingUp },
  { to: '/sales', label: 'Sales', icon: ShoppingCart },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/categories', label: 'Categories', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const { unreadAlertCount } = useAlertStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role) => {
    const map = {
      ADMIN: 'bg-[#818CF8]/10 text-[#818CF8] border-[#818CF8]/20',
      MANAGER: 'bg-[#00D4AA]/10 text-[#00D4AA] border-[#00D4AA]/20',
      STAFF: 'bg-[#8B949E]/10 text-[#8B949E] border-[#8B949E]/20',
    };
    return map[role] || map.STAFF;
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-[#0D1117] border-r border-[#30363D] flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#30363D]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00D4AA]/20 border border-[#00D4AA]/30 flex items-center justify-center">
            <Package size={16} className="text-[#00D4AA]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="font-display font-bold text-[#E6EDF3] text-base leading-none">StockSense</h1>
            <p className="text-[#8B949E] text-[10px] font-mono mt-0.5">Inventory Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon, exact, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            data-testid={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative group ${
                isActive
                  ? 'bg-[#161B22] text-[#E6EDF3] border-l-2 border-[#00D4AA] pl-[10px]'
                  : 'text-[#8B949E] hover:bg-[#161B22] hover:text-[#E6EDF3] border-l-2 border-transparent'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.5} className="flex-shrink-0" />
            <span className="font-body font-medium flex-1">{label}</span>
            {badge && unreadAlertCount > 0 && (
              <span className="bg-[#EF4444] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                {unreadAlertCount > 99 ? '99+' : unreadAlertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div className="px-3 pb-4 border-t border-[#30363D] pt-4">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#161B22] border border-[#30363D]">
          <div className="w-8 h-8 rounded-full bg-[#30363D] flex items-center justify-center flex-shrink-0">
            <span className="text-[#E6EDF3] text-xs font-mono font-bold">{getInitials(user?.name)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#E6EDF3] text-sm font-medium truncate">{user?.name || 'User'}</p>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRoleBadge(user?.role)}`}>
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-btn"
          className="w-full mt-2 flex items-center gap-3 px-3 py-2 rounded-lg text-[#8B949E] hover:bg-[#161B22] hover:text-[#EF4444] transition-all duration-200 text-sm group"
        >
          <LogOut size={16} strokeWidth={1.5} />
          <span className="font-body font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
