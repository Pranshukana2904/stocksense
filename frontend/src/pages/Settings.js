import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Lock, Bell, Users, Save, ChevronDown } from 'lucide-react';
import { usersApi, authApi } from '../api/api';
import useAuthStore from '../store/authStore';
import { toast } from 'sonner';

const Settings = () => {
  const { user, setUser } = useAuthStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('profile');

  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [profileLoading, setProfileLoading] = useState(false);

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data || []),
    enabled: user?.role === 'ADMIN',
  });

  const handleProfile = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const res = await usersApi.updateProfile({ name: profile.name });
      setUser({ ...user, name: res.data.data.name });
      toast.success('Profile updated');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update profile'); }
    finally { setProfileLoading(false); }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) return toast.error('New passwords do not match');
    if (pw.new_password.length < 6) return toast.error('Password must be at least 6 characters');
    setPwLoading(true);
    try {
      await usersApi.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      toast.success('Password changed successfully');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to change password'); }
    finally { setPwLoading(false); }
  };

  const handleRoleChange = async (uid, role) => {
    try {
      await usersApi.changeRole(uid, role);
      qc.invalidateQueries(['users']);
      toast.success('Role updated');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to update role'); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(user?.role === 'ADMIN' ? [{ id: 'users', label: 'User Management', icon: Users }] : []),
  ];

  const roleColors = { ADMIN: 'text-[#818CF8]', MANAGER: 'text-[#00D4AA]', STAFF: 'text-[#8B949E]' };

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-[#E6EDF3]">Settings</h1>
        <p className="text-[#8B949E] text-sm font-body mt-1">Manage your account and preferences</p>
      </div>

      <div className="flex gap-8">
        {/* Tab Nav */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${activeTab === id ? 'bg-[#161B22] text-[#E6EDF3] border-l-2 border-[#00D4AA]' : 'text-[#8B949E] hover:bg-[#161B22] hover:text-[#E6EDF3] border-l-2 border-transparent'}`}
              data-testid={`settings-tab-${id}`}>
              <Icon size={15} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 card p-6 max-w-2xl">
          {activeTab === 'profile' && (
            <div data-testid="profile-settings">
              <h2 className="font-display font-bold text-[#E6EDF3] text-lg mb-1">Profile Settings</h2>
              <p className="text-[#8B949E] text-sm mb-6">Update your personal information</p>
              <form onSubmit={handleProfile} className="space-y-4">
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Full Name</label>
                  <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                    className="input-dark" data-testid="profile-name" />
                </div>
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Email</label>
                  <input value={profile.email} disabled className="input-dark opacity-50 cursor-not-allowed" />
                  <p className="text-[#8B949E] text-xs mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-[#8B949E] text-xs font-medium mb-1.5">Role</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#0D1117] border border-[#30363D] rounded-md">
                    <span className={`font-mono text-sm ${roleColors[user?.role]}`}>{user?.role}</span>
                  </div>
                </div>
                <button type="submit" disabled={profileLoading} className="btn-primary" data-testid="save-profile-btn">
                  <Save size={14} /> {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div data-testid="password-settings">
              <h2 className="font-display font-bold text-[#E6EDF3] text-lg mb-1">Change Password</h2>
              <p className="text-[#8B949E] text-sm mb-6">Keep your account secure</p>
              <form onSubmit={handlePassword} className="space-y-4">
                {[
                  { label: 'Current Password', key: 'current_password', testid: 'current-pw' },
                  { label: 'New Password', key: 'new_password', testid: 'new-pw' },
                  { label: 'Confirm New Password', key: 'confirm', testid: 'confirm-pw' },
                ].map(({ label, key, testid }) => (
                  <div key={key}>
                    <label className="block text-[#8B949E] text-xs font-medium mb-1.5">{label}</label>
                    <input type="password" value={pw[key]} onChange={e => setPw({ ...pw, [key]: e.target.value })}
                      className="input-dark" data-testid={testid} />
                  </div>
                ))}
                <button type="submit" disabled={pwLoading} className="btn-primary" data-testid="change-pw-btn">
                  <Lock size={14} /> {pwLoading ? 'Updating...' : 'Change Password'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div data-testid="notification-settings">
              <h2 className="font-display font-bold text-[#E6EDF3] text-lg mb-1">Notification Settings</h2>
              <p className="text-[#8B949E] text-sm mb-6">Control how you receive alerts</p>
              <div className="space-y-4">
                {[
                  { label: 'Low stock email alerts', desc: 'Receive daily email when products are below reorder level', enabled: true },
                  { label: 'Out of stock alerts', desc: 'Immediate notification when a product reaches zero', enabled: true },
                  { label: 'Weekly sales report', desc: 'Every Monday morning summary of last week sales', enabled: false },
                ].map(({ label, desc, enabled }) => (
                  <div key={label} className="flex items-start justify-between p-4 bg-[#0D1117] rounded-lg border border-[#30363D]">
                    <div>
                      <p className="text-[#E6EDF3] text-sm font-medium">{label}</p>
                      <p className="text-[#8B949E] text-xs mt-0.5">{desc}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full flex items-center transition-colors cursor-pointer ${enabled ? 'bg-[#00D4AA]/30 border border-[#00D4AA]/50' : 'bg-[#30363D]'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full transition-all mx-0.5 ${enabled ? 'bg-[#00D4AA] ml-[22px]' : 'bg-[#8B949E]'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'users' && user?.role === 'ADMIN' && (
            <div data-testid="user-management">
              <h2 className="font-display font-bold text-[#E6EDF3] text-lg mb-1">User Management</h2>
              <p className="text-[#8B949E] text-sm mb-6">Manage team members and roles</p>
              <div className="space-y-3">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-[#0D1117] rounded-lg border border-[#30363D]" data-testid={`user-row-${u.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#30363D] flex items-center justify-center">
                        <span className="text-[#E6EDF3] text-xs font-mono font-bold">
                          {(u.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-[#E6EDF3] text-sm font-medium">{u.name}</p>
                        <p className="text-[#8B949E] text-xs font-mono">{u.email}</p>
                      </div>
                    </div>
                    {u.id !== user?.id ? (
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                        className="input-dark w-auto text-xs py-1" data-testid={`role-select-${u.id}`}>
                        {['ADMIN', 'MANAGER', 'STAFF'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`font-mono text-xs px-2 py-1 rounded border ${roleColors[u.role]} bg-transparent border-current/20`}>{u.role} (you)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
